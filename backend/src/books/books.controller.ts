import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { existsSync, mkdirSync } from "fs";
import { Role } from "@prisma/client";
import { BooksService } from "./books.service";
import {
  CreateBookDto,
  CreateBundleDto,
  CreateBundleOfferDto,
  CreateCategoryDto,
  CreateChapterDto,
  UpdateBookDto,
  UpdateBundleDto,
  UpdateBundleOfferDto,
  UpdateCategoryDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

const BOOK_UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!existsSync(BOOK_UPLOAD_DIR))
  mkdirSync(BOOK_UPLOAD_DIR, { recursive: true });

// Browsing the catalog requires a logged-in user; mutations require ADMIN.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BooksController {
  constructor(private service: BooksService) {}

  // ---- Categories ----
  @Get("categories")
  listCategories() {
    return this.service.listCategories();
  }

  @Post("categories")
  @Roles(Role.ADMIN)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch("categories/:id")
  @Roles(Role.ADMIN)
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  @Roles(Role.ADMIN)
  deleteCategory(@Param("id") id: string) {
    return this.service.deleteCategory(id);
  }

  // ---- Bundles (declared before :idOrSlug so the literal path wins) ----
  @Get("books/bundles")
  listBundles(@Query("featured") featured?: string) {
    return this.service.listBundles({ featured: featured === "true" });
  }

  @Get("books/bundles/all")
  @Roles(Role.ADMIN)
  listAllBundles() {
    return this.service.listBundles({ includeUnpublished: true });
  }

  @Get("books/bundles/:idOrSlug")
  getBundle(@Param("idOrSlug") idOrSlug: string) {
    return this.service.getBundle(idOrSlug);
  }

  @Post("books/bundles")
  @Roles(Role.ADMIN)
  createBundle(@Body() dto: CreateBundleDto) {
    return this.service.createBundle(dto);
  }

  @Patch("books/bundles/:id")
  @Roles(Role.ADMIN)
  updateBundle(@Param("id") id: string, @Body() dto: UpdateBundleDto) {
    return this.service.updateBundle(id, dto);
  }

  @Delete("books/bundles/:id")
  @Roles(Role.ADMIN)
  deleteBundle(@Param("id") id: string) {
    return this.service.deleteBundle(id);
  }

  // ---- Bundle offers (pricing tiers) ----
  @Get("books/bundle-offers/all")
  listAllBundleOffers() {
    return this.service.listAllBundleOffers();
  }

  @Post("books/bundle-offers")
  @Roles(Role.ADMIN)
  createBundleOffer(@Body() dto: CreateBundleOfferDto) {
    return this.service.createBundleOffer(dto);
  }

  @Patch("books/bundle-offers/:id")
  @Roles(Role.ADMIN)
  updateBundleOffer(
    @Param("id") id: string,
    @Body() dto: UpdateBundleOfferDto,
  ) {
    return this.service.updateBundleOffer(id, dto);
  }

  @Delete("books/bundle-offers/:id")
  @Roles(Role.ADMIN)
  removeBundleOffer(@Param("id") id: string) {
    return this.service.removeBundleOffer(id);
  }

  @Get("books/bundles/:id/offers")
  listBundleOffers(@Param("id") id: string) {
    return this.service.listBundleOffers(id);
  }

  // ---- Books ----
  @Get("books")
  listBooks(
    @Query("categoryId") categoryId?: string,
    @Query("featured") featured?: string,
    @Query("q") q?: string,
  ) {
    return this.service.listBooks({
      categoryId,
      featured: featured === "true",
      q,
    });
  }

  @Get("books/all")
  @Roles(Role.ADMIN)
  listAllBooks(@Query("q") q?: string) {
    return this.service.listBooks({ q, includeUnpublished: true });
  }

  // Paginated / searchable / sortable list for the admin library table.
  @Get("books/all/paged")
  @Roles(Role.ADMIN)
  listAllBooksPaged(
    @Query("q") q?: string,
    @Query("categoryId") categoryId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
  ) {
    return this.service.listBooksPaged({
      q,
      categoryId,
      status,
      page,
      pageSize,
      sort,
      order,
    });
  }

  // Poll the status / progress of a background PDF import job (see import-pdf).
  @Get("books/import-jobs/:jobId")
  @Roles(Role.ADMIN)
  getImportJob(@Param("jobId") jobId: string) {
    return this.service.getImportJob(jobId);
  }

  @Get("books/:idOrSlug")
  getBook(@Param("idOrSlug") idOrSlug: string) {
    return this.service.getBook(idOrSlug);
  }

  @Get("books/:idOrSlug/preview")
  preview(@Param("idOrSlug") idOrSlug: string) {
    return this.service.preview(idOrSlug);
  }

  @Post("books")
  @Roles(Role.ADMIN)
  createBook(@Body() dto: CreateBookDto) {
    return this.service.createBook(dto);
  }

  @Patch("books/:id")
  @Roles(Role.ADMIN)
  updateBook(@Param("id") id: string, @Body() dto: UpdateBookDto) {
    return this.service.updateBook(id, dto);
  }

  @Delete("books/:id")
  @Roles(Role.ADMIN)
  deleteBook(@Param("id") id: string) {
    return this.service.deleteBook(id);
  }

  @Post("books/:idOrSlug/content")
  @Roles(Role.ADMIN)
  async setBookContent(
    @Param("idOrSlug") idOrSlug: string,
    @Body() body: { content: string },
  ) {
    const book = await this.service.getBook(idOrSlug);
    return this.service.setBookContent(book.id, body.content);
  }

  // ---- Chapters (admin) ----
  @Post("books/:bookId/chapters")
  @Roles(Role.ADMIN)
  upsertChapter(
    @Param("bookId") bookId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.service.upsertChapter(bookId, dto);
  }

  // Admin chapter list including contentKey (for the chapter editor).
  @Get("books/:bookId/chapters/admin")
  @Roles(Role.ADMIN)
  listChaptersAdmin(@Param("bookId") bookId: string) {
    return this.service.listChaptersAdmin(bookId);
  }

  // Reorder chapters by passing the full ordered list of chapter ids.
  @Put("books/:bookId/chapters/reorder")
  @Roles(Role.ADMIN)
  reorderChapters(
    @Param("bookId") bookId: string,
    @Body() body: { chapterIds: string[] },
  ) {
    return this.service.reorderChapters(bookId, body.chapterIds || []);
  }

  // Upload a PDF and auto-create chapters from its extracted text. Pass
  // ?replace=false to append instead of replacing existing chapters. The PDF
  // itself is never stored or rendered - only the extracted text is kept.
  @Post("books/:bookId/import-pdf")
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: BOOK_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
      fileFilter: (_req, file, cb) => {
        const ok = file.mimetype === "application/pdf";
        cb(ok ? null : new BadRequestException("Please upload a PDF file"), ok);
      },
    }),
  )
  async importPdf(
    @Param("bookId") bookId: string,
    @Query("replace") replace?: string,
    @Query("ocr") ocr?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("PDF file is required");
    // OCR can run for several minutes; if we processed it inside this request
    // the proxy/gateway would cut the connection with a 504. Instead we start a
    // background job and return its id immediately, then the UI polls for
    // progress. The temp upload is cleaned up by the job when it finishes.
    return this.service.startImportJob(bookId, file.path, {
      replace: replace !== "false",
      ocr: ocr === "true",
    });
  }

  @Delete("chapters/:id")
  @Roles(Role.ADMIN)
  deleteChapter(@Param("id") id: string) {
    return this.service.deleteChapter(id);
  }

  @Post("books/:bookId/chapters/:chapterId/content")
  @Roles(Role.ADMIN)
  async setChapterContent(
    @Param("chapterId") chapterId: string,
    @Body() body: { content: string },
  ) {
    return this.service.setChapterContent(chapterId, body.content);
  }
}
