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
import { BooksService } from "./books.service";
import {
  CreateBookDto,
  CreateBundleDto,
  CreateCategoryDto,
  CreateChapterDto,
  UpdateBookDto,
  UpdateBundleDto,
  UpdateCategoryDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

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
