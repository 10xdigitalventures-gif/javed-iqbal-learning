import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCourseDto,
  UpdateCourseDto,
  CreateLessonDto,
  CreateQuizDto,
  CreateQuizQuestionDto,
  SubmitQuizDto,
  CreateAssignmentDto,
  SubmitAssignmentDto,
  GradeSubmissionDto,
} from "./dto";

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

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

  async findOne(idOrSlug: string, userId?: string) {
    const course = await this.prisma.course.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        lessons: { orderBy: { index: "asc" } },
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
    if (userId) {
      enrollment = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });
      hasAccess = !!enrollment;
    }

    // Hide contentKey on non-preview lessons when not enrolled
    const lessons = course.lessons.map((l) =>
      hasAccess || l.isPreview ? l : { ...l, contentKey: null },
    );

    return { ...course, lessons, enrollment, hasAccess };
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

  // ---- Lessons ----
  async addLesson(dto: CreateLessonDto) {
    return this.prisma.lesson.create({
      data: {
        courseId: dto.courseId,
        index: dto.index,
        title: dto.title,
        type: dto.type ?? "VIDEO",
        contentKey: dto.contentKey ?? null,
        durationSec: dto.durationSec ?? null,
        isPreview: dto.isPreview ?? false,
      },
    });
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
    return this.prisma.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: {
        lessonsComplete,
        percentComplete,
        completedAt: completed ? new Date() : null,
      },
    });
  }

  // ---- Quizzes ----
  async createQuiz(dto: CreateQuizDto) {
    return this.prisma.quiz.create({
      data: {
        courseId: dto.courseId,
        lessonId: dto.lessonId ?? null,
        title: dto.title,
        passScore: dto.passScore ?? 70,
      },
    });
  }

  async addQuestion(dto: CreateQuizQuestionDto) {
    return this.prisma.quizQuestion.create({ data: dto });
  }

  async submitQuiz(userId: string, quizId: string, dto: SubmitQuizDto) {
    const attempt = await this.prisma.quizAttempt.create({
      data: { userId, quizId, score: dto.score, passed: dto.passed },
    });

    // Auto-update lesson progress
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
    });
    if (quiz?.courseId) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId: quiz.courseId },
        },
      });
      if (enrollment) {
        const total = await this.prisma.lesson.count({
          where: { courseId: quiz.courseId },
        });
        const done = enrollment.lessonsComplete + 1;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        await this.updateProgress(userId, quiz.courseId, done, pct);
      }
    }
    return attempt;
  }

  // ---- Assignments ----
  async createAssignment(dto: CreateAssignmentDto) {
    return this.prisma.assignment.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        description: dto.description ?? null,
      },
    });
  }

  async submitAssignment(
    userId: string,
    assignmentId: string,
    dto: SubmitAssignmentDto,
  ) {
    return this.prisma.assignmentSubmission.upsert({
      where: { assignmentId_userId: { assignmentId, userId } },
      create: { userId, assignmentId, contentKey: dto.contentKey ?? null },
      update: {
        contentKey: dto.contentKey ?? null,
        submittedAt: new Date(),
      },
    });
  }

  getSubmissions(assignmentId: string) {
    return this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async gradeSubmission(id: string, dto: GradeSubmissionDto) {
    return this.prisma.assignmentSubmission.update({
      where: { id },
      data: { grade: dto.grade, feedback: dto.feedback ?? null },
    });
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
