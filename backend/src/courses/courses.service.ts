import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CertificatesService } from "../certificates/certificates.service";
import {
  Paginated,
  parsePagination,
  buildOrderBy,
  searchOr,
} from "../common/list-query";
import {
  CreateCourseDto,
  UpdateCourseDto,
  CreateLessonDto,
  UpdateLessonDto,
  CreateModuleDto,
  UpdateModuleDto,
  CreateQuizDto,
  UpdateQuizDto,
  CreateQuizQuestionDto,
  UpdateQuizQuestionDto,
  SubmitQuizDto,
  CreateAssignmentDto,
  UpdateAssignmentDto,
  SubmitAssignmentDto,
  GradeSubmissionDto,
} from "./dto";

// Safely parse a JSON-encoded file list ([{ key, name, size }]) into an array.
function parseFiles(raw?: string | null): any[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

@Injectable()
export class CoursesService {
  constructor(
    private prisma: PrismaService,
    private certificates: CertificatesService,
  ) {}

  private slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80);
  }

  private async uniqueSlug(base: string): Promise<string> {
    const root = this.slugify(base) || "course";
    let slug = root;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.course.findUnique({
        where: { slug },
      });
      if (!existing) return slug;
      slug = `${root}-${++n}`;
    }
  }

  // ---- Courses ----
  findAll(publishedOnly = false) {
    const where = publishedOnly ? { isPublished: true } : {};
    return this.prisma.course.findMany({
      where,
      include: {
        _count: { select: { lessons: true, enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Paginated / searchable / sortable list for the admin courses table.
  async findAllPaged(opts: {
    q?: string;
    status?: string; // "published" | "draft"
    page?: string | number;
    pageSize?: string | number;
    sort?: string;
    order?: string;
  }): Promise<Paginated<any>> {
    const where: any = {};
    if (opts.status === "published") where.isPublished = true;
    if (opts.status === "draft") where.isPublished = false;
    const search = searchOr(opts.q, ["title", "description", "slug"]);
    if (search) Object.assign(where, search);

    const orderBy = buildOrderBy(
      opts.sort,
      opts.order,
      { title: "title", price: "price", createdAt: "createdAt" },
      { createdAt: "desc" },
    );
    const { page, pageSize, skip, take } = parsePagination(
      opts.page,
      opts.pageSize,
    );

    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: {
          _count: { select: { lessons: true, enrollments: true } },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.course.count({ where }),
    ]);
    return { rows, total, page, pageSize };
  }

  async findOne(idOrSlug: string, userId?: string) {
    const course = await this.prisma.course.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        lessons: { orderBy: { index: "asc" } },
        modules: { orderBy: { index: "asc" } },
        quizzes: {
          include: { questions: { orderBy: { index: "asc" } } },
        },
        assignments: true,
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) throw new NotFoundException("Course not found");

    let enrollment = null;
    let hasAccess = false;
    const completionByLesson = new Map<string, number>();
    const completedAtByLesson = new Map<string, Date | null>();
    const positionByLesson = new Map<string, number>();
    const submissionByAssignment = new Map<string, any>();
    if (userId) {
      enrollment = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });
      hasAccess = !!enrollment;
      const completions = await this.prisma.lessonCompletion.findMany({
        where: { userId, courseId: course.id },
      });
      completions.forEach((c) => {
        completionByLesson.set(c.lessonId, c.progress);
        completedAtByLesson.set(c.lessonId, (c as any).completedAt ?? null);
        positionByLesson.set(c.lessonId, (c as any).positionSec ?? 0);
      });
      const subs = await this.prisma.assignmentSubmission.findMany({
        where: { userId, assignment: { courseId: course.id } },
      });
      subs.forEach((s) => submissionByAssignment.set(s.assignmentId, s));
    }

    // Map assignments to their linked lesson so an ASSIGNMENT lesson can carry
    // its task text, reference attachments and the learner's own submission.
    const assignmentByLesson = new Map<string, any>();
    (course.assignments || []).forEach((a: any) => {
      if (a.lessonId) assignmentByLesson.set(a.lessonId, a);
    });

    const now = Date.now();
    const HOUR = 3600 * 1000;

    // Whether a single lesson counts as completed for this learner.
    const isLessonCompleted = (l: any): boolean => {
      if (l.type === "ASSIGNMENT") {
        const a = assignmentByLesson.get(l.id);
        const sub = a ? submissionByAssignment.get(a.id) : null;
        return sub?.status === "APPROVED";
      }
      return (completionByLesson.get(l.id) ?? 0) >= 1;
    };
    // When that completion happened (drives the drip countdown).
    const lessonCompletedAt = (l: any): Date | null => {
      if (l.type === "ASSIGNMENT") {
        const a = assignmentByLesson.get(l.id);
        const sub = a ? submissionByAssignment.get(a.id) : null;
        if (sub?.status !== "APPROVED") return null;
        return sub.reviewedAt ?? sub.submittedAt ?? null;
      }
      return completedAtByLesson.get(l.id) ?? null;
    };

    // ---- Module-level gating ----
    const lessonsByModule = new Map<string, any[]>();
    course.lessons.forEach((l: any) => {
      if (!l.moduleId) return;
      const arr = lessonsByModule.get(l.moduleId) || [];
      arr.push(l);
      lessonsByModule.set(l.moduleId, arr);
    });

    const moduleMetaById = new Map<
      string,
      {
        locked: boolean;
        lockedByPrev: boolean;
        unlockAt: Date | null;
        completed: boolean;
        completedAt: Date | null;
      }
    >();
    let prevModuleCompleted = true;
    let prevModuleCompletedAt: Date | null = null;
    for (const m of course.modules as any[]) {
      const mLessons = lessonsByModule.get(m.id) || [];
      const allDone =
        mLessons.length === 0
          ? true
          : mLessons.every((l) => isLessonCompleted(l));
      // Module completed-at = the latest lesson completion time in the module.
      let mCompletedAt: Date | null = null;
      if (allDone && mLessons.length > 0) {
        for (const l of mLessons) {
          const c = lessonCompletedAt(l);
          if (c && (!mCompletedAt || c > mCompletedAt)) mCompletedAt = c;
        }
      }

      const lockedByPrev = hasAccess && !prevModuleCompleted;
      let timeLocked = false;
      let timeUnlockAt: Date | null = null;
      if (
        hasAccess &&
        !lockedByPrev &&
        m.lockMode === "BOTH" &&
        m.unlockDelayHours > 0 &&
        prevModuleCompletedAt
      ) {
        const ua = new Date(
          prevModuleCompletedAt.getTime() + m.unlockDelayHours * HOUR,
        );
        if (now < ua.getTime()) {
          timeLocked = true;
          timeUnlockAt = ua;
        }
      }
      moduleMetaById.set(m.id, {
        locked: lockedByPrev || timeLocked,
        lockedByPrev,
        unlockAt: timeUnlockAt,
        completed: allDone && mLessons.length > 0,
        completedAt: mCompletedAt,
      });

      prevModuleCompleted = allDone;
      prevModuleCompletedAt = mCompletedAt;
    }

    // Order lessons by (module order, lesson index) so module groups stay
    // contiguous and ungrouped (legacy) lessons fall at the end in their own
    // sequential flow.
    const moduleIndexById = new Map<string, number>();
    (course.modules as any[]).forEach((m) =>
      moduleIndexById.set(m.id, m.index),
    );
    const orderedLessons = [...course.lessons].sort((a: any, b: any) => {
      const ai = a.moduleId
        ? (moduleIndexById.get(a.moduleId) ?? 9999)
        : 100000;
      const bi = b.moduleId
        ? (moduleIndexById.get(b.moduleId) ?? 9999)
        : 100000;
      if (ai !== bi) return ai - bi;
      return a.index - b.index;
    });

    // ---- Lesson-level gating ----
    // Sequential gating resets at every module boundary; the module gate above
    // handles unlocking across modules.
    let prevCompleted = true;
    let prevCompletedAt: Date | null = null;
    let lastGroupKey: string | null = "__INIT__";
    const lessons = orderedLessons.map((l: any) => {
      const groupKey = l.moduleId ?? "__ungrouped__";
      const firstInGroup = groupKey !== lastGroupKey;
      if (firstInGroup) {
        prevCompleted = true;
        prevCompletedAt = null;
      }
      lastGroupKey = groupKey;

      const assignment = assignmentByLesson.get(l.id) || null;
      const isAssignment = l.type === "ASSIGNMENT";
      const mySub = assignment
        ? submissionByAssignment.get(assignment.id) || null
        : null;
      const completed = isLessonCompleted(l);
      const mMeta = l.moduleId ? moduleMetaById.get(l.moduleId) : null;

      const lockedByAccess = !hasAccess && !l.isPreview;
      const moduleLocked = !!(mMeta && mMeta.locked);
      const seqLocked = hasAccess && !firstInGroup && !prevCompleted;

      // Per-lesson time gate: only once the previous lesson in the group is done.
      let lessonTimeLocked = false;
      let lessonUnlockAt: Date | null = null;
      if (
        hasAccess &&
        !firstInGroup &&
        prevCompleted &&
        l.lockMode === "BOTH" &&
        l.unlockDelayHours > 0 &&
        prevCompletedAt
      ) {
        const ua = new Date(
          prevCompletedAt.getTime() + l.unlockDelayHours * HOUR,
        );
        if (now < ua.getTime()) {
          lessonTimeLocked = true;
          lessonUnlockAt = ua;
        }
      }

      const locked =
        lockedByAccess || moduleLocked || seqLocked || lessonTimeLocked;

      // Reason + the soonest moment the lesson becomes available (for a
      // client-side countdown). Access/sequence locks have no countdown.
      let lockReason: string | null = null;
      let unlockAt: Date | null = null;
      if (lockedByAccess) {
        lockReason = "ACCESS";
      } else if (moduleLocked) {
        if (mMeta!.lockedByPrev) {
          lockReason = "PREV_MODULE";
        } else {
          lockReason = "MODULE_TIME";
          unlockAt = mMeta!.unlockAt;
        }
      } else if (seqLocked) {
        lockReason = "PREV_LESSON";
      } else if (lessonTimeLocked) {
        lockReason = "TIME";
        unlockAt = lessonUnlockAt;
      }

      // Hide the playable source (contentKey + external videoUrl) on non-preview
      // lessons when the user is not enrolled. Thumbnails stay visible so the
      // curriculum still looks complete on the sales page.
      const base =
        hasAccess || l.isPreview
          ? { ...l }
          : { ...l, contentKey: null, videoUrl: null };
      base.locked = locked;
      base.completed = completed;
      base.lockReason = lockReason;
      base.unlockAt = unlockAt ? unlockAt.toISOString() : null;
      // Resume position (seconds) for video lessons; 0 when never watched.
      base.resumeSec = positionByLesson.get(l.id) ?? 0;
      if (isAssignment && assignment) {
        base.assignment = {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          attachments: parseFiles(assignment.attachments),
          mySubmission: mySub
            ? {
                id: mySub.id,
                status: mySub.status,
                answerText: mySub.answerText,
                attachments: parseFiles(mySub.attachments),
                contentKey: mySub.contentKey,
                grade: mySub.grade,
                feedback: mySub.feedback,
                submittedAt: mySub.submittedAt,
                reviewedAt: mySub.reviewedAt,
              }
            : null,
        };
      }
      prevCompleted = completed;
      prevCompletedAt = lessonCompletedAt(l);
      return base;
    });

    // Module summaries for grouped rendering + lock badges on the client.
    const modules = (course.modules as any[]).map((m) => {
      const meta = moduleMetaById.get(m.id)!;
      return {
        id: m.id,
        title: m.title,
        index: m.index,
        lockMode: m.lockMode,
        unlockDelayHours: m.unlockDelayHours,
        locked: meta.locked,
        lockReason: meta.locked
          ? meta.lockedByPrev
            ? "PREV_MODULE"
            : "MODULE_TIME"
          : null,
        unlockAt: meta.unlockAt ? meta.unlockAt.toISOString() : null,
        completed: meta.completed,
        lessonIds: (lessonsByModule.get(m.id) || []).map((l) => l.id),
      };
    });

    // ---- Reviews summary ----
    const reviewAgg = await this.prisma.courseReview.aggregate({
      where: { courseId: course.id },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const reviewSummary = {
      avg: reviewAgg._avg.rating
        ? Math.round(reviewAgg._avg.rating * 10) / 10
        : 0,
      count: reviewAgg._count._all,
    };
    let myReview: any = null;
    if (userId) {
      myReview = await this.prisma.courseReview.findUnique({
        where: { courseId_userId: { courseId: course.id, userId } },
      });
    }

    return {
      ...course,
      lessons,
      modules,
      enrollment,
      hasAccess,
      reviewSummary,
      myReview,
    };
  }

  async create(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        title: dto.title,
        slug: await this.uniqueSlug(dto.slug || dto.title),
        description: dto.description ?? null,
        coverUrl: dto.coverUrl ?? null,
        price: dto.price ?? 0,
        currency: dto.currency ?? "PKR",
        isPublished: dto.isPublished ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.findOne(id);
    const { slug, ...rest } = dto as any;
    return this.prisma.course.update({ where: { id }, data: { ...rest } });
  }

  async remove(id: string) {
    await this.prisma.course.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Modules (sections) ----
  listModules(courseId: string) {
    return this.prisma.courseModule.findMany({
      where: { courseId },
      orderBy: { index: "asc" },
    });
  }

  async createModule(dto: CreateModuleDto) {
    return this.prisma.courseModule.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        index: dto.index,
        lockMode: dto.lockMode ?? "SINGLE",
        unlockDelayHours: dto.unlockDelayHours ?? 0,
      },
    });
  }

  async updateModule(id: string, dto: UpdateModuleDto) {
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.index !== undefined) data.index = dto.index;
    if (dto.lockMode !== undefined) data.lockMode = dto.lockMode;
    if (dto.unlockDelayHours !== undefined)
      data.unlockDelayHours = dto.unlockDelayHours;
    return this.prisma.courseModule.update({ where: { id }, data });
  }

  async removeModule(id: string) {
    // Detach lessons (FK is SET NULL, but do it explicitly) before deleting so
    // the lessons survive as ungrouped rather than cascading away.
    await this.prisma.lesson.updateMany({
      where: { moduleId: id },
      data: { moduleId: null },
    });
    await this.prisma.courseModule.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Lessons ----
  async addLesson(dto: CreateLessonDto) {
    return this.prisma.lesson.create({
      data: {
        courseId: dto.courseId,
        index: dto.index,
        title: dto.title,
        type: dto.type ?? "VIDEO",
        moduleId: dto.moduleId ?? null,
        lockMode: dto.lockMode ?? "SINGLE",
        unlockDelayHours: dto.unlockDelayHours ?? 0,
        contentKey: dto.contentKey ?? null,
        videoUrl: dto.videoUrl ?? null,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        source: dto.source ?? "UPLOAD",
        durationSec: dto.durationSec ?? null,
        isPreview: dto.isPreview ?? false,
      },
    });
  }

  // Partial update for an existing lesson — used to assign a module, change the
  // lock mode / drip delay, or tweak basic fields without recreating it.
  async updateLesson(id: string, dto: UpdateLessonDto) {
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.index !== undefined) data.index = dto.index;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.moduleId !== undefined) data.moduleId = dto.moduleId || null;
    if (dto.lockMode !== undefined) data.lockMode = dto.lockMode;
    if (dto.unlockDelayHours !== undefined)
      data.unlockDelayHours = dto.unlockDelayHours;
    if (dto.contentKey !== undefined) data.contentKey = dto.contentKey || null;
    if (dto.videoUrl !== undefined) data.videoUrl = dto.videoUrl || null;
    if (dto.thumbnailUrl !== undefined)
      data.thumbnailUrl = dto.thumbnailUrl || null;
    if (dto.source !== undefined) data.source = dto.source;
    if (dto.durationSec !== undefined) data.durationSec = dto.durationSec;
    if (dto.isPreview !== undefined) data.isPreview = dto.isPreview;
    return this.prisma.lesson.update({ where: { id }, data });
  }

  async removeLesson(id: string) {
    await this.prisma.lesson.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Enrollment ----
  async enroll(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException("Course not found");
    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: {},
    });
  }

  myCourses(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: { _count: { select: { lessons: true } } },
        },
      },
      orderBy: { startedAt: "desc" },
    });
  }

  async updateProgress(
    userId: string,
    courseId: string,
    lessonsComplete: number,
    percentComplete: number,
  ) {
    const completed = percentComplete >= 100;
    const enrollment = await this.prisma.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: {
        lessonsComplete,
        percentComplete,
        completedAt: completed ? new Date() : null,
      },
    });
    // Auto-issue a certificate the first time the course is completed.
    if (completed) {
      await this.certificates.ensureForCompletion(userId, courseId);
    }
    return enrollment;
  }

  // ---- Quizzes ----
  async createQuiz(dto: CreateQuizDto) {
    return this.prisma.quiz.create({
      data: {
        courseId: dto.courseId,
        lessonId: dto.lessonId ?? null,
        title: dto.title,
        passScore: dto.passScore ?? 70,
        timeLimitSec: dto.timeLimitSec ?? null,
        maxAttempts: dto.maxAttempts ?? 0,
        shuffle: dto.shuffle ?? false,
      },
    });
  }

  async updateQuiz(id: string, dto: UpdateQuizDto) {
    return this.prisma.quiz.update({
      where: { id },
      data: {
        title: dto.title,
        passScore: dto.passScore,
        timeLimitSec: dto.timeLimitSec,
        maxAttempts: dto.maxAttempts,
        shuffle: dto.shuffle,
      },
    });
  }

  async removeQuiz(id: string) {
    await this.prisma.quiz.delete({ where: { id } });
    return { ok: true };
  }

  async addQuestion(dto: CreateQuizQuestionDto) {
    return this.prisma.quizQuestion.create({
      data: {
        quizId: dto.quizId,
        index: dto.index,
        prompt: dto.prompt,
        options: dto.options,
        answer: dto.answer,
        type: dto.type ?? "SINGLE",
        points: dto.points ?? 1,
        explanation: dto.explanation ?? null,
        correct: dto.correct ?? null,
      },
    });
  }

  async updateQuestion(id: string, dto: UpdateQuizQuestionDto) {
    return this.prisma.quizQuestion.update({
      where: { id },
      data: {
        index: dto.index,
        prompt: dto.prompt,
        options: dto.options,
        answer: dto.answer,
        type: dto.type,
        points: dto.points,
        explanation: dto.explanation,
        correct: dto.correct,
      },
    });
  }

  async removeQuestion(id: string) {
    await this.prisma.quizQuestion.delete({ where: { id } });
    return { ok: true };
  }

  // True when a learner's selection for one question is fully correct.
  private isQuestionCorrect(q: any, picked: number | number[]): boolean {
    if (q.type === "MULTI") {
      let correctIdx: number[] = [];
      try {
        correctIdx = q.correct ? JSON.parse(q.correct) : [];
      } catch {
        correctIdx = [];
      }
      const pickedArr = Array.isArray(picked) ? picked : [picked];
      const a = [...correctIdx].sort((x, y) => x - y);
      const b = [...pickedArr].sort((x, y) => x - y);
      return (
        a.length > 0 && a.length === b.length && a.every((v, i) => v === b[i])
      );
    }
    const single = Array.isArray(picked) ? picked[0] : picked;
    return single === q.answer;
  }

  async submitQuiz(userId: string, quizId: string, dto: SubmitQuizDto) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { index: "asc" } } },
    });
    if (!quiz) throw new NotFoundException("Quiz not found");

    // Enforce the attempt limit server-side (0 = unlimited).
    if (quiz.maxAttempts && quiz.maxAttempts > 0) {
      const used = await this.prisma.quizAttempt.count({
        where: { userId, quizId },
      });
      if (used >= quiz.maxAttempts) {
        throw new BadRequestException(
          "You have used all " + quiz.maxAttempts + " attempts for this quiz.",
        );
      }
    }

    let score = dto.score ?? 0;
    let passed = dto.passed ?? false;
    let answersJson: string | null = null;

    // Authoritative server-side grading whenever the client sends the picked
    // answers. We never trust a client-computed score. Scoring is weighted by
    // each question's points and is type-aware (SINGLE / TRUE_FALSE / MULTI).
    if (Array.isArray(dto.answers)) {
      answersJson = JSON.stringify(dto.answers);
      let earned = 0;
      let totalPoints = 0;
      quiz.questions.forEach((q, i) => {
        const pts = q.points || 1;
        totalPoints += pts;
        const picked = dto.answers![i];
        if (picked !== undefined && this.isQuestionCorrect(q, picked)) {
          earned += pts;
        }
      });
      score = totalPoints > 0 ? Math.round((earned / totalPoints) * 100) : 0;
      passed = score >= (quiz.passScore || 70);
    }

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId,
        score,
        passed,
        answers: answersJson,
        timeTakenSec: dto.timeTakenSec ?? null,
      },
    });

    // Passing a lesson-linked quiz also marks that lesson complete; otherwise
    // just refresh course progress from completed lessons.
    if (passed && quiz.lessonId) {
      await this.markLessonComplete(userId, quiz.lessonId);
    } else {
      await this.recomputeProgress(userId, quiz.courseId);
    }
    return attempt;
  }

  // Quiz attempts for review. Admin (no userId) sees everyone's attempts with
  // the learner attached; a learner sees only their own.
  quizAttempts(quizId: string, userId?: string) {
    return this.prisma.quizAttempt.findMany({
      where: { quizId, ...(userId ? { userId } : {}) },
      include: userId
        ? undefined
        : { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // Recompute enrollment progress from the number of distinct completed
  // lessons, so the progress bar reflects real lesson completions.
  async recomputeProgress(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) return null;
    const total = await this.prisma.lesson.count({ where: { courseId } });
    // Sum of per-lesson watch fractions (0..1 each) so a half-watched video
    // contributes ~half a lesson to the bar instead of nothing.
    const agg = await this.prisma.lessonCompletion.aggregate({
      where: { userId, courseId },
      _sum: { progress: true },
    });
    const fullyDone = await this.prisma.lessonCompletion.count({
      where: { userId, courseId, progress: { gte: 1 } },
    });
    const sum = agg._sum.progress ?? 0;
    const pct = total > 0 ? Math.min(100, Math.round((sum / total) * 100)) : 0;
    return this.updateProgress(userId, courseId, fullyDone, pct);
  }

  // Mark a single lesson complete (idempotent) and refresh progress.
  async markLessonComplete(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    const existing = await this.prisma.lessonCompletion.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    // Stamp the first time this lesson reached completion; keep the original
    // timestamp on re-completion so a drip countdown never restarts.
    const completedAt = (existing as any)?.completedAt ?? new Date();
    await this.prisma.lessonCompletion.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        courseId: lesson.courseId,
        progress: 1,
        completedAt,
      },
      update: { progress: 1, completedAt },
    });
    return this.recomputeProgress(userId, lesson.courseId);
  }

  // Record partial watch progress for a video lesson (0..1). Progress only ever
  // moves forward, so re-watching from the start never lowers the bar. Once it
  // reaches ~the end it is treated as fully complete.
  async updateLessonProgress(
    userId: string,
    lessonId: string,
    progress: number,
    positionSec?: number,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    const clamped = Math.max(0, Math.min(1, progress || 0));
    const value = clamped >= 0.95 ? 1 : clamped;
    const existing = await this.prisma.lessonCompletion.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    const next = existing ? Math.max(existing.progress, value) : value;
    // Record the completion moment the first time we cross the finish line.
    const completedAt =
      next >= 1 ? ((existing as any)?.completedAt ?? new Date()) : null;
    // Keep the most recent playback position when provided.
    const posData =
      typeof positionSec === "number" && positionSec >= 0
        ? { positionSec: Math.round(positionSec) }
        : {};
    await this.prisma.lessonCompletion.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        courseId: lesson.courseId,
        progress: next,
        completedAt,
        ...posData,
      },
      update: { progress: next, completedAt, ...posData },
    });
    return this.recomputeProgress(userId, lesson.courseId);
  }

  // ---- Reviews ----
  // Public list of reviews for a course, newest first.
  listReviews(courseId: string) {
    return this.prisma.courseReview.findMany({
      where: { courseId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // Create or update the current learner's review. Only enrolled learners may
  // review, so feedback reflects real course experience.
  async upsertReview(
    userId: string,
    courseId: string,
    rating: number,
    comment?: string,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException("Course not found");
    const enrolled = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrolled)
      throw new BadRequestException("Only enrolled learners can review");
    const r = Math.max(1, Math.min(5, Math.round(rating)));
    return this.prisma.courseReview.upsert({
      where: { courseId_userId: { courseId, userId } },
      create: { courseId, userId, rating: r, comment: comment ?? null },
      update: { rating: r, comment: comment ?? null },
    });
  }

  // Delete a review. A learner may delete their own; an admin may delete any.
  async deleteReview(userId: string, courseId: string, isAdmin: boolean) {
    if (isAdmin) {
      await this.prisma.courseReview.deleteMany({ where: { courseId } });
    } else {
      await this.prisma.courseReview.deleteMany({
        where: { courseId, userId },
      });
    }
    return { ok: true };
  }

  async adminDeleteReview(id: string) {
    await this.prisma.courseReview.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Lesson notes (private) ----
  listNotes(userId: string, lessonId: string) {
    return this.prisma.lessonNote.findMany({
      where: { userId, lessonId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createNote(
    userId: string,
    lessonId: string,
    body: string,
    positionSec?: number,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    return this.prisma.lessonNote.create({
      data: {
        userId,
        lessonId,
        courseId: lesson.courseId,
        body,
        positionSec:
          typeof positionSec === "number" ? Math.round(positionSec) : null,
      },
    });
  }

  async updateNote(
    userId: string,
    id: string,
    body?: string,
    positionSec?: number,
  ) {
    const note = await this.prisma.lessonNote.findUnique({ where: { id } });
    if (!note || note.userId !== userId)
      throw new NotFoundException("Note not found");
    return this.prisma.lessonNote.update({
      where: { id },
      data: {
        body: body ?? undefined,
        positionSec:
          typeof positionSec === "number" ? Math.round(positionSec) : undefined,
      },
    });
  }

  async deleteNote(userId: string, id: string) {
    const note = await this.prisma.lessonNote.findUnique({ where: { id } });
    if (!note || note.userId !== userId)
      throw new NotFoundException("Note not found");
    await this.prisma.lessonNote.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Lesson Q&A ----
  listQuestions(lessonId: string) {
    return this.prisma.lessonQuestion.findMany({
      where: { lessonId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        answers: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async askQuestion(userId: string, lessonId: string, body: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    return this.prisma.lessonQuestion.create({
      data: { userId, lessonId, courseId: lesson.courseId, body },
    });
  }

  async answerQuestion(
    userId: string,
    questionId: string,
    body: string,
    isInstructor: boolean,
  ) {
    const q = await this.prisma.lessonQuestion.findUnique({
      where: { id: questionId },
    });
    if (!q) throw new NotFoundException("Question not found");
    return this.prisma.lessonAnswer.create({
      data: { questionId, userId, body, isInstructor },
    });
  }

  // Author or an admin can toggle a question's resolved state.
  async setQuestionResolved(
    userId: string,
    questionId: string,
    resolved: boolean,
    isAdmin: boolean,
  ) {
    const q = await this.prisma.lessonQuestion.findUnique({
      where: { id: questionId },
    });
    if (!q) throw new NotFoundException("Question not found");
    if (!isAdmin && q.userId !== userId)
      throw new BadRequestException("Not allowed");
    return this.prisma.lessonQuestion.update({
      where: { id: questionId },
      data: { resolved },
    });
  }

  async deleteQuestion(userId: string, questionId: string, isAdmin: boolean) {
    const q = await this.prisma.lessonQuestion.findUnique({
      where: { id: questionId },
    });
    if (!q) throw new NotFoundException("Question not found");
    if (!isAdmin && q.userId !== userId)
      throw new BadRequestException("Not allowed");
    await this.prisma.lessonQuestion.delete({ where: { id: questionId } });
    return { ok: true };
  }

  async deleteAnswer(userId: string, answerId: string, isAdmin: boolean) {
    const a = await this.prisma.lessonAnswer.findUnique({
      where: { id: answerId },
    });
    if (!a) throw new NotFoundException("Answer not found");
    if (!isAdmin && a.userId !== userId)
      throw new BadRequestException("Not allowed");
    await this.prisma.lessonAnswer.delete({ where: { id: answerId } });
    return { ok: true };
  }

  // ---- Assignments ----
  async createAssignment(dto: CreateAssignmentDto) {
    return this.prisma.assignment.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        description: dto.description ?? null,
        lessonId: dto.lessonId ?? null,
        attachments: dto.attachments ?? null,
      },
    });
  }

  async updateAssignment(id: string, dto: UpdateAssignmentDto) {
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.lessonId !== undefined) data.lessonId = dto.lessonId || null;
    if (dto.attachments !== undefined) data.attachments = dto.attachments;
    return this.prisma.assignment.update({ where: { id }, data });
  }

  async removeAssignment(id: string) {
    await this.prisma.assignment.delete({ where: { id } });
    return { ok: true };
  }

  // Learner submits (or re-submits via "Retake") their assignment. A new or
  // edited submission always resets the review state back to UNDER_REVIEW and
  // clears any prior grade/feedback so the instructor reviews it fresh.
  async submitAssignment(
    userId: string,
    assignmentId: string,
    dto: SubmitAssignmentDto,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    return this.prisma.assignmentSubmission.upsert({
      where: { assignmentId_userId: { assignmentId, userId } },
      create: {
        userId,
        assignmentId,
        answerText: dto.answerText ?? null,
        attachments: dto.attachments ?? null,
        contentKey: dto.contentKey ?? null,
        status: "UNDER_REVIEW",
      },
      update: {
        answerText: dto.answerText ?? null,
        attachments: dto.attachments ?? null,
        contentKey: dto.contentKey ?? null,
        status: "UNDER_REVIEW",
        grade: null,
        feedback: null,
        reviewedAt: null,
        submittedAt: new Date(),
      },
    });
  }

  // The learner's own submission for one assignment (parsed file lists).
  async mySubmission(userId: string, assignmentId: string) {
    const s = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_userId: { assignmentId, userId } },
    });
    if (!s) return null;
    return {
      ...s,
      attachments: parseFiles(s.attachments),
    };
  }

  // All submissions for one assignment (admin grading view).
  async getSubmissions(assignmentId: string) {
    const subs = await this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { submittedAt: "desc" },
    });
    return subs.map((s) => ({ ...s, attachments: parseFiles(s.attachments) }));
  }

  // Every submission across a course, with the assignment + learner attached.
  // Powers the admin "submissions to review" queue.
  async courseSubmissions(courseId: string) {
    const subs = await this.prisma.assignmentSubmission.findMany({
      where: { assignment: { courseId } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignment: { select: { id: true, title: true, lessonId: true } },
      },
      orderBy: { submittedAt: "desc" },
    });
    return subs.map((s) => ({ ...s, attachments: parseFiles(s.attachments) }));
  }

  // Instructor reviews a submission. Approving it marks the linked assignment
  // lesson complete, which unlocks the next lesson for that learner.
  async gradeSubmission(id: string, dto: GradeSubmissionDto) {
    const status = dto.status ?? "APPROVED";
    const submission = await this.prisma.assignmentSubmission.update({
      where: { id },
      data: {
        grade: dto.grade ?? null,
        feedback: dto.feedback ?? null,
        status,
        reviewedAt: new Date(),
      },
      include: { assignment: { select: { lessonId: true } } },
    });
    if (status === "APPROVED" && submission.assignment?.lessonId) {
      await this.markLessonComplete(
        submission.userId,
        submission.assignment.lessonId,
      );
    }
    return submission;
  }

  // ---- Certificates ----
  async issueCertificate(userId: string, courseId: string) {
    const serial = `CRT-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
    return this.prisma.certificate.create({
      data: { userId, courseId, serial },
    });
  }

  myCertificates(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { issuedAt: "desc" },
    });
  }
}
