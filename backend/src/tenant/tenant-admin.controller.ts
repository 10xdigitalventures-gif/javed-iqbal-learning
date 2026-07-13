import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { existsSync, mkdirSync } from "fs";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { CoursesService } from "../courses/courses.service";
import { PackagesService } from "../packages/packages.service";
import { BooksService } from "../books/books.service";
import { CreateCourseDto, UpdateCourseDto } from "../courses/dto";
import { CreatePackageDto, UpdatePackageDto } from "../packages/dto";
import { CreateBookDto, UpdateBookDto } from "../books/dto";
import { ActivityService } from "../activity/activity.service";

const BOOK_UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!existsSync(BOOK_UPLOAD_DIR))
  mkdirSync(BOOK_UPLOAD_DIR, { recursive: true });

@Controller("tenant-admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TENANT_ADMIN)
export class TenantAdminController {
  constructor(
    private prisma: PrismaService,
    private courses: CoursesService,
    private packages: PackagesService,
    private books: BooksService,
    private activity: ActivityService,
  ) {}

  private async tenantId(user: AuthUser) {
    const me = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { tenantId: true },
    });
    if (!me?.tenantId)
      throw new ForbiddenException("No tenant associated with this account");
    return me.tenantId;
  }

  @Get("branding")
  async branding(@CurrentUser() user: AuthUser) {
    const tenantId = await this.tenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new ForbiddenException("Tenant not found");
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      brandName: tenant.brandName ?? tenant.name,
      logoUrl: tenant.logoUrl,
      logoDarkUrl: tenant.logoDarkUrl,
      faviconUrl: tenant.faviconUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      fontFamily: tenant.fontFamily,
      tagline: tenant.tagline,
      supportEmail: tenant.supportEmail,
      customDomain: tenant.customDomain,
    };
  }

  @Patch("branding")
  async updateBranding(@CurrentUser() user: AuthUser, @Body() dto: any) {
    const tenantId = await this.tenantId(user);
    const before = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const data = {
      brandName: dto.brandName,
      logoUrl: dto.logoUrl || null,
      logoDarkUrl: dto.logoDarkUrl || null,
      faviconUrl: dto.faviconUrl || null,
      primaryColor: dto.primaryColor || null,
      secondaryColor: dto.secondaryColor || null,
      accentColor: dto.accentColor || null,
      fontFamily: dto.fontFamily || null,
      tagline: dto.tagline || null,
      supportEmail: dto.supportEmail || null,
      customDomain: dto.customDomain || null,
    };
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
    await this.activity.logFull({
      userId: user.userId,
      tenantId,
      action: "TENANT_BRANDING_UPDATED",
      entity: "tenant",
      entityId: tenantId,
      before,
      after: tenant,
      meta: { source: "tenant-admin/branding" },
    });
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      brandName: tenant.brandName ?? tenant.name,
      logoUrl: tenant.logoUrl,
      logoDarkUrl: tenant.logoDarkUrl,
      faviconUrl: tenant.faviconUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      fontFamily: tenant.fontFamily,
      tagline: tenant.tagline,
      supportEmail: tenant.supportEmail,
      customDomain: tenant.customDomain,
    };
  }

  @Get("courses/paged")
  async coursesPaged(
    @CurrentUser() user: AuthUser,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
  ) {
    return this.courses.findAllPaged({
      q,
      status,
      page,
      pageSize,
      sort,
      order,
      tenantId: await this.tenantId(user),
    } as any);
  }

  @Post("courses")
  async createCourse(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCourseDto,
  ) {
    return this.courses.create({
      ...dto,
      tenantId: await this.tenantId(user),
    } as any);
  }

  @Get("courses/:id")
  async getCourse(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.assertOwn("course", id, await this.tenantId(user));
    return this.courses.findOne(id, user.userId);
  }

  @Post("courses/modules")
  async createCourseModule(@CurrentUser() user: AuthUser, @Body() dto: any) {
    await this.assertOwn("course", dto.courseId, await this.tenantId(user));
    return this.courses.createModule(dto);
  }

  @Patch("courses/modules/:id")
  async updateCourseModule(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: any,
  ) {
    const module = await this.prisma.courseModule.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!module) throw new ForbiddenException("Module not found");
    await this.assertOwn("course", module.courseId, await this.tenantId(user));
    return this.courses.updateModule(id, dto);
  }

  @Delete("courses/modules/:id")
  async deleteCourseModule(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    const module = await this.prisma.courseModule.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!module) throw new ForbiddenException("Module not found");
    await this.assertOwn("course", module.courseId, await this.tenantId(user));
    return this.courses.removeModule(id);
  }

  @Post("courses/lessons")
  async createLesson(@CurrentUser() user: AuthUser, @Body() dto: any) {
    await this.assertOwn("course", dto.courseId, await this.tenantId(user));
    return this.courses.addLesson(dto);
  }

  @Patch("courses/lessons/:id")
  async updateLesson(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: any,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!lesson) throw new ForbiddenException("Lesson not found");
    await this.assertOwn("course", lesson.courseId, await this.tenantId(user));
    return this.courses.updateLesson(id, dto);
  }

  @Delete("courses/lessons/:id")
  async deleteLesson(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!lesson) throw new ForbiddenException("Lesson not found");
    await this.assertOwn("course", lesson.courseId, await this.tenantId(user));
    return this.courses.removeLesson(id);
  }

  @Patch("courses/:id")
  async updateCourse(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    await this.assertOwn("course", id, await this.tenantId(user));
    return this.courses.update(id, dto);
  }

  @Delete("courses/:id")
  async removeCourse(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.assertOwn("course", id, await this.tenantId(user));
    return this.courses.remove(id);
  }

  @Get("packages")
  async listPackages(@CurrentUser() user: AuthUser) {
    return this.packages.listAll((await this.tenantId(user)) as any);
  }

  @Post("packages")
  async createPackage(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePackageDto,
  ) {
    return this.packages.create({
      ...dto,
      tenantId: await this.tenantId(user),
      isGlobal: false,
    } as any);
  }

  @Patch("packages/:id")
  async updatePackage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    await this.assertOwn("package", id, await this.tenantId(user));
    return this.packages.update(id, { ...dto, isGlobal: false } as any);
  }

  @Delete("packages/:id")
  async removePackage(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.assertOwn("package", id, await this.tenantId(user));
    return this.packages.remove(id);
  }

  @Get("books/paged")
  async booksPaged(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.books.listBooksPaged({
      ...query,
      tenantId: await this.tenantId(user),
    } as any);
  }

  @Post("books")
  async createBook(@CurrentUser() user: AuthUser, @Body() dto: CreateBookDto) {
    return this.books.createBook({
      ...dto,
      tenantId: await this.tenantId(user),
    } as any);
  }

  @Get("books/:idOrSlug")
  async getTenantBook(
    @CurrentUser() user: AuthUser,
    @Param("idOrSlug") idOrSlug: string,
  ) {
    const book = await this.books.getBook(idOrSlug);
    await this.assertOwn("book", book.id, await this.tenantId(user));
    return book;
  }

  @Post("books/:idOrSlug/content")
  async setTenantBookContent(
    @CurrentUser() user: AuthUser,
    @Param("idOrSlug") idOrSlug: string,
    @Body() body: { content: string },
  ) {
    const book = await this.books.getBook(idOrSlug);
    await this.assertOwn("book", book.id, await this.tenantId(user));
    return this.books.setBookContent(book.id, body.content);
  }

  @Post("books/:bookId/chapters")
  async upsertTenantChapter(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Body() dto: any,
  ) {
    await this.assertOwn("book", bookId, await this.tenantId(user));
    return this.books.upsertChapter(bookId, dto);
  }

  @Get("books/:bookId/chapters/admin")
  async tenantChapters(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
  ) {
    await this.assertOwn("book", bookId, await this.tenantId(user));
    return this.books.listChaptersAdmin(bookId);
  }

  @Patch("books/chapters/:id")
  async updateTenantChapter(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: any,
  ) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      select: { bookId: true },
    });
    if (!chapter) throw new ForbiddenException("Chapter not found");
    await this.assertOwn("book", chapter.bookId, await this.tenantId(user));
    return this.books.updateChapter(id, dto);
  }

  @Patch("books/:id")
  async updateBook(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateBookDto,
  ) {
    await this.assertOwn("book", id, await this.tenantId(user));
    return this.books.updateBook(id, dto);
  }

  @Delete("books/:id")
  async deleteBook(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.assertOwn("book", id, await this.tenantId(user));
    return this.books.deleteBook(id);
  }

  @Delete("books/chapters/:id")
  async deleteTenantChapter(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      select: { bookId: true },
    });
    if (!chapter) throw new ForbiddenException("Chapter not found");
    await this.assertOwn("book", chapter.bookId, await this.tenantId(user));
    return this.books.deleteChapter(id);
  }

  @Put("books/:bookId/chapters/reorder")
  async reorderTenantChapters(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Body() body: { chapterIds: string[] },
  ) {
    await this.assertOwn("book", bookId, await this.tenantId(user));
    return this.books.reorderChapters(bookId, body.chapterIds || []);
  }

  @Get("books/:bookId/import-jobs/:jobId")
  async getTenantImportJob(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Param("jobId") jobId: string,
  ) {
    await this.assertOwn("book", bookId, await this.tenantId(user));
    return this.books.getImportJob(jobId);
  }

  @Post("books/:bookId/import-pdf")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: BOOK_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = file.mimetype === "application/pdf";
        cb(ok ? null : new BadRequestException("Please upload a PDF file"), ok);
      },
    }),
  )
  async importTenantPdf(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Query("replace") replace?: string,
    @Query("ocr") ocr?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.assertOwn("book", bookId, await this.tenantId(user));
    if (!file) throw new BadRequestException("PDF file is required");
    return this.books.startImportJob(bookId, file.path, {
      replace: replace !== "false",
      ocr: ocr === "true",
    });
  }

  private async assertOwn(
    kind: "course" | "book" | "package",
    id: string,
    tenantId: string,
  ) {
    const model = (this.prisma as any)[kind];
    const row = await model.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!row)
      throw new ForbiddenException("This item is outside your tenant scope");
  }
}
