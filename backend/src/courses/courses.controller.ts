import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";
import { CoursesService } from "./courses.service";
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
  LessonProgressDto,
  CreateAssignmentDto,
  UpdateAssignmentDto,
  SubmitAssignmentDto,
  GradeSubmissionDto,
  ReviewDto,
  CreateLessonNoteDto,
  UpdateLessonNoteDto,
  AskQuestionDto,
  AnswerQuestionDto,
  CreateOfferDto,
  UpdateOfferDto,
  GrantOfferDto,
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
  CreateCommentDto,
  CreateBadgeDto,
  UpdateBadgeDto,
  CreateLiveSessionDto,
  UpdateLiveSessionDto,
} from "./dto";

@Controller("courses")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private service: CoursesService) {}

  // ---- List & View ----
  @Get()
  findAll() {
    return this.service.findAll(true);
  }

  @Get("admin")
  @Roles(Role.ADMIN)
  findAllAdmin() {
    return this.service.findAll(false);
  }

  // Paginated / searchable / sortable list for the admin courses table.
  @Get("admin/paged")
  @Roles(Role.ADMIN)
  findAllAdminPaged(
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
  ) {
    return this.service.findAllPaged({
      q,
      status,
      page,
      pageSize,
      sort,
      order,
    });
  }

  @Get("me/enrolled")
  myCourses(@CurrentUser() user: AuthUser) {
    return this.service.myCourses(user.userId);
  }

  @Get("me/certificates")
  myCertificates(@CurrentUser() user: AuthUser) {
    return this.service.myCertificates(user.userId);
  }

  @Get(":idOrSlug")
  findOne(@Param("idOrSlug") idOrSlug: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(idOrSlug, user.userId);
  }

  // ---- Admin CRUD ----
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCourseDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateCourseDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  // ---- Modules (sections) ----
  @Post("modules")
  @Roles(Role.ADMIN)
  createModule(@Body() dto: CreateModuleDto) {
    return this.service.createModule(dto);
  }

  @Patch("modules/:id")
  @Roles(Role.ADMIN)
  updateModule(@Param("id") id: string, @Body() dto: UpdateModuleDto) {
    return this.service.updateModule(id, dto);
  }

  @Delete("modules/:id")
  @Roles(Role.ADMIN)
  removeModule(@Param("id") id: string) {
    return this.service.removeModule(id);
  }

  // ---- Lessons ----
  @Post("lessons")
  @Roles(Role.ADMIN)
  addLesson(@Body() dto: CreateLessonDto) {
    return this.service.addLesson(dto);
  }

  @Patch("lessons/:id")
  @Roles(Role.ADMIN)
  updateLesson(@Param("id") id: string, @Body() dto: UpdateLessonDto) {
    return this.service.updateLesson(id, dto);
  }

  @Delete("lessons/:id")
  @Roles(Role.ADMIN)
  removeLesson(@Param("id") id: string) {
    return this.service.removeLesson(id);
  }

  // Any enrolled learner can mark a lesson complete (drives live progress).
  @Post("lessons/:id/complete")
  completeLesson(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.markLessonComplete(user.userId, id);
  }

  // Report how much of a video lesson has been watched (0..1) so the course
  // progress bar can grow gradually as the learner watches.
  @Post("lessons/:id/progress")
  lessonProgress(
    @Param("id") id: string,
    @Body() dto: LessonProgressDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateLessonProgress(
      user.userId,
      id,
      dto.progress,
      dto.positionSec,
    );
  }

  // ---- Enrollment ----
  @Post(":courseId/enroll")
  enroll(@Param("courseId") courseId: string, @CurrentUser() user: AuthUser) {
    return this.service.enroll(user.userId, courseId);
  }

  // ---- Admin: per-user access management ----
  // List learners enrolled in a course with their access status.
  @Get(":courseId/enrollments")
  @Roles(Role.ADMIN)
  listEnrollments(@Param("courseId") courseId: string) {
    return this.service.listEnrollments(courseId);
  }

  // Grant / extend access. body: { userId, days? } (days=0/null => lifetime).
  @Post(":courseId/access/grant")
  @Roles(Role.ADMIN)
  grantAccess(
    @Param("courseId") courseId: string,
    @Body() body: { userId: string; days?: number | null },
  ) {
    return this.service.grantAccess(body.userId, courseId, body.days);
  }

  // Revoke access immediately. body: { userId }.
  @Post(":courseId/access/revoke")
  @Roles(Role.ADMIN)
  revokeAccess(
    @Param("courseId") courseId: string,
    @Body() body: { userId: string },
  ) {
    return this.service.revokeAccess(body.userId, courseId);
  }

  // ---- Quizzes ----
  @Post("quizzes")
  @Roles(Role.ADMIN)
  createQuiz(@Body() dto: CreateQuizDto) {
    return this.service.createQuiz(dto);
  }

  @Patch("quizzes/:id")
  @Roles(Role.ADMIN)
  updateQuiz(@Param("id") id: string, @Body() dto: UpdateQuizDto) {
    return this.service.updateQuiz(id, dto);
  }

  @Delete("quizzes/:id")
  @Roles(Role.ADMIN)
  removeQuiz(@Param("id") id: string) {
    return this.service.removeQuiz(id);
  }

  @Post("quizzes/questions")
  @Roles(Role.ADMIN)
  addQuestion(@Body() dto: CreateQuizQuestionDto) {
    return this.service.addQuestion(dto);
  }

  @Patch("quizzes/questions/:id")
  @Roles(Role.ADMIN)
  updateQuestion(@Param("id") id: string, @Body() dto: UpdateQuizQuestionDto) {
    return this.service.updateQuestion(id, dto);
  }

  @Delete("quizzes/questions/:id")
  @Roles(Role.ADMIN)
  removeQuestion(@Param("id") id: string) {
    return this.service.removeQuestion(id);
  }

  @Post("quizzes/:quizId/submit")
  submitQuiz(
    @Param("quizId") quizId: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.submitQuiz(user.userId, quizId, dto);
  }

  @Get("quizzes/:quizId/attempts")
  @Roles(Role.ADMIN)
  quizAttempts(@Param("quizId") quizId: string) {
    return this.service.quizAttempts(quizId);
  }

  @Get("quizzes/:quizId/my-attempts")
  myQuizAttempts(
    @Param("quizId") quizId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.quizAttempts(quizId, user.userId);
  }

  // ---- Assignments ----
  @Post("assignments")
  @Roles(Role.ADMIN)
  createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.service.createAssignment(dto);
  }

  @Patch("assignments/:id")
  @Roles(Role.ADMIN)
  updateAssignment(@Param("id") id: string, @Body() dto: UpdateAssignmentDto) {
    return this.service.updateAssignment(id, dto);
  }

  @Delete("assignments/:id")
  @Roles(Role.ADMIN)
  removeAssignment(@Param("id") id: string) {
    return this.service.removeAssignment(id);
  }

  @Get("assignments/:id/submissions")
  @Roles(Role.ADMIN)
  getSubmissions(@Param("id") id: string) {
    return this.service.getSubmissions(id);
  }

  // Admin review queue: every submission across one course.
  @Get(":courseId/submissions")
  @Roles(Role.ADMIN)
  courseSubmissions(@Param("courseId") courseId: string) {
    return this.service.courseSubmissions(courseId);
  }

  @Patch("submissions/:id/grade")
  @Roles(Role.ADMIN)
  gradeSubmission(@Param("id") id: string, @Body() dto: GradeSubmissionDto) {
    return this.service.gradeSubmission(id, dto);
  }

  // The current learner's own submission for one assignment.
  @Get("assignments/:id/my-submission")
  mySubmission(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.mySubmission(user.userId, id);
  }

  @Post("assignments/:id/submit")
  submitAssignment(
    @Param("id") id: string,
    @Body() dto: SubmitAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.submitAssignment(user.userId, id, dto);
  }

  // ---- Reviews & ratings ----
  // Public list of a course's reviews (anyone signed in can read).
  @Get(":courseId/reviews")
  listReviews(@Param("courseId") courseId: string) {
    return this.service.listReviews(courseId);
  }

  // Create or update the current learner's review (enrolled learners only).
  @Post(":courseId/reviews")
  upsertReview(
    @Param("courseId") courseId: string,
    @Body() dto: ReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.upsertReview(
      user.userId,
      courseId,
      dto.rating,
      dto.comment,
    );
  }

  // Remove the current learner's own review.
  @Delete(":courseId/reviews")
  deleteMyReview(
    @Param("courseId") courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.deleteReview(
      user.userId,
      courseId,
      user.role === Role.ADMIN,
    );
  }

  // Admin moderation: delete any single review by id.
  @Delete("reviews/:id")
  @Roles(Role.ADMIN)
  adminDeleteReview(@Param("id") id: string) {
    return this.service.adminDeleteReview(id);
  }

  // ---- Lesson notes (private) ----
  @Get("lessons/:id/notes")
  lessonNotes(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.listNotes(user.userId, id);
  }

  @Post("notes")
  createNote(@Body() dto: CreateLessonNoteDto, @CurrentUser() user: AuthUser) {
    return this.service.createNote(
      user.userId,
      dto.lessonId,
      dto.body,
      dto.positionSec,
    );
  }

  @Patch("notes/:id")
  updateNote(
    @Param("id") id: string,
    @Body() dto: UpdateLessonNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateNote(user.userId, id, dto.body, dto.positionSec);
  }

  @Delete("notes/:id")
  deleteNote(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteNote(user.userId, id);
  }

  // ---- Lesson Q&A ----
  @Get("lessons/:id/questions")
  lessonQuestions(@Param("id") id: string) {
    return this.service.listQuestions(id);
  }

  @Post("questions")
  askQuestion(@Body() dto: AskQuestionDto, @CurrentUser() user: AuthUser) {
    return this.service.askQuestion(user.userId, dto.lessonId, dto.body);
  }

  @Post("questions/:id/answers")
  answerQuestion(
    @Param("id") id: string,
    @Body() dto: AnswerQuestionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const isInstructor =
      user.role === Role.ADMIN || user.role === Role.CONSULTANT;
    return this.service.answerQuestion(user.userId, id, dto.body, isInstructor);
  }

  @Patch("questions/:id/resolve")
  resolveQuestion(
    @Param("id") id: string,
    @Body() body: { resolved?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setQuestionResolved(
      user.userId,
      id,
      body?.resolved !== false,
      user.role === Role.ADMIN,
    );
  }

  @Delete("questions/:id")
  deleteQuestion(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteQuestion(
      user.userId,
      id,
      user.role === Role.ADMIN,
    );
  }

  @Delete("answers/:id")
  deleteAnswer(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteAnswer(user.userId, id, user.role === Role.ADMIN);
  }

  // ---- Certificates ----
  @Post(":courseId/certificate")
  issueCertificate(
    @Param("courseId") courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.issueCertificate(user.userId, courseId);
  }

  // ======================= Offers (access pricing tiers) =======================
  @Get(":courseId/offers")
  listOffers(@Param("courseId") courseId: string) {
    return this.service.listOffers(courseId);
  }

  @Post("offers")
  @Roles(Role.ADMIN)
  createOffer(@Body() dto: CreateOfferDto) {
    return this.service.createOffer(dto);
  }

  @Patch("offers/:id")
  @Roles(Role.ADMIN)
  updateOffer(@Param("id") id: string, @Body() dto: UpdateOfferDto) {
    return this.service.updateOffer(id, dto);
  }

  @Delete("offers/:id")
  @Roles(Role.ADMIN)
  removeOffer(@Param("id") id: string) {
    return this.service.removeOffer(id);
  }

  // Admin: directly grant a user access through an offer (manual payment).
  @Post("offers/:id/grant")
  @Roles(Role.ADMIN)
  grantOffer(@Param("id") id: string, @Body() dto: GrantOfferDto) {
    return this.service.grantOfferAccess(id, dto.userId);
  }

  // ============================= Global coupons ===============================
  @Get("coupons")
  @Roles(Role.ADMIN)
  listCoupons() {
    return this.service.listCoupons();
  }

  @Post("coupons")
  @Roles(Role.ADMIN)
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.service.createCoupon(dto);
  }

  @Patch("coupons/:id")
  @Roles(Role.ADMIN)
  updateCoupon(@Param("id") id: string, @Body() dto: UpdateCouponDto) {
    return this.service.updateCoupon(id, dto);
  }

  @Delete("coupons/:id")
  @Roles(Role.ADMIN)
  removeCoupon(@Param("id") id: string) {
    return this.service.removeCoupon(id);
  }

  // Validate a coupon at checkout (any authenticated user). Global.
  @Post("coupons/validate")
  validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.service.validateCoupon(dto.code, dto.amount);
  }

  // ========================== Course-level comments ===========================
  @Get(":courseId/comments")
  listComments(@Param("courseId") courseId: string) {
    return this.service.listComments(courseId);
  }

  @Post(":courseId/comments")
  createComment(
    @Param("courseId") courseId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createComment(courseId, user.userId, dto);
  }

  @Delete("comments/:id")
  removeComment(@Param("id") id: string) {
    return this.service.removeComment(id);
  }

  // ======================= Course badges (welcome/etc) ========================
  @Get(":courseId/badges")
  listBadges(@Param("courseId") courseId: string) {
    return this.service.listBadges(courseId);
  }

  @Post("badges")
  @Roles(Role.ADMIN)
  createBadge(@Body() dto: CreateBadgeDto) {
    return this.service.createBadge(dto);
  }

  @Patch("badges/:id")
  @Roles(Role.ADMIN)
  updateBadge(@Param("id") id: string, @Body() dto: UpdateBadgeDto) {
    return this.service.updateBadge(id, dto);
  }

  @Delete("badges/:id")
  @Roles(Role.ADMIN)
  removeBadge(@Param("id") id: string) {
    return this.service.removeBadge(id);
  }

  // ============================== Live sessions ===============================
  @Get(":courseId/live-sessions")
  listLiveSessions(@Param("courseId") courseId: string) {
    return this.service.listLiveSessions(courseId);
  }

  @Post("live-sessions")
  @Roles(Role.ADMIN)
  createLiveSession(@Body() dto: CreateLiveSessionDto) {
    return this.service.createLiveSession(dto);
  }

  @Patch("live-sessions/:id")
  @Roles(Role.ADMIN)
  updateLiveSession(
    @Param("id") id: string,
    @Body() dto: UpdateLiveSessionDto,
  ) {
    return this.service.updateLiveSession(id, dto);
  }

  @Delete("live-sessions/:id")
  @Roles(Role.ADMIN)
  removeLiveSession(@Param("id") id: string) {
    return this.service.removeLiveSession(id);
  }
}
