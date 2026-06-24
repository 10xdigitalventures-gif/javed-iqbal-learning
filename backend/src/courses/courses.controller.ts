import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  CreateQuizDto,
  CreateQuizQuestionDto,
  SubmitQuizDto,
  CreateAssignmentDto,
  SubmitAssignmentDto,
  GradeSubmissionDto,
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

  // ---- Lessons ----
  @Post("lessons")
  @Roles(Role.ADMIN)
  addLesson(@Body() dto: CreateLessonDto) {
    return this.service.addLesson(dto);
  }

  @Delete("lessons/:id")
  @Roles(Role.ADMIN)
  removeLesson(@Param("id") id: string) {
    return this.service.removeLesson(id);
  }

  // ---- Enrollment ----
  @Post(":courseId/enroll")
  enroll(@Param("courseId") courseId: string, @CurrentUser() user: AuthUser) {
    return this.service.enroll(user.userId, courseId);
  }

  // ---- Quizzes ----
  @Post("quizzes")
  @Roles(Role.ADMIN)
  createQuiz(@Body() dto: CreateQuizDto) {
    return this.service.createQuiz(dto);
  }

  @Post("quizzes/questions")
  @Roles(Role.ADMIN)
  addQuestion(@Body() dto: CreateQuizQuestionDto) {
    return this.service.addQuestion(dto);
  }

  @Post("quizzes/:quizId/submit")
  submitQuiz(
    @Param("quizId") quizId: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.submitQuiz(user.userId, quizId, dto);
  }

  // ---- Assignments ----
  @Post("assignments")
  @Roles(Role.ADMIN)
  createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.service.createAssignment(dto);
  }

  @Get("assignments/:id/submissions")
  @Roles(Role.ADMIN)
  getSubmissions(@Param("id") id: string) {
    return this.service.getSubmissions(id);
  }

  @Patch("submissions/:id/grade")
  @Roles(Role.ADMIN)
  gradeSubmission(
    @Param("id") id: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.service.gradeSubmission(id, dto);
  }

  @Post("assignments/:id/submit")
  submitAssignment(
    @Param("id") id: string,
    @Body() dto: SubmitAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.submitAssignment(user.userId, id, dto);
  }

  // ---- Certificates ----
  @Post(":courseId/certificate")
  issueCertificate(
    @Param("courseId") courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.issueCertificate(user.userId, courseId);
  }
}
