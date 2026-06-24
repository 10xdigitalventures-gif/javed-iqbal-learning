import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { LibraryService } from "./library.service";
import {
  CreateBookmarkDto,
  CreateHighlightDto,
  CreateNoteDto,
  UpdateProgressDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";

@Controller("library")
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private service: LibraryService) {}

  // "My Books" shelf.
  @Get()
  myBooks(@CurrentUser() user: AuthUser) {
    return this.service.myBooks(user.userId);
  }

  @Get("continue")
  continueReading(@CurrentUser() user: AuthUser) {
    return this.service.continueReading(user.userId);
  }

  @Get("offline")
  offline(@CurrentUser() user: AuthUser) {
    return this.service.listOffline(user.userId);
  }

  @Get("access/:bookId")
  async access(@CurrentUser() user: AuthUser, @Param("bookId") bookId: string) {
    return { hasAccess: await this.service.hasAccess(user.userId, bookId) };
  }

  // Encrypted, user-bound content for the reader.
  @Get("content/:bookId")
  content(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Query("chapterId") chapterId?: string,
  ) {
    return this.service.getSecureContent(user.userId, bookId, chapterId);
  }

  // Returns a secure signed URL to a PDF or Video from the Storage Layer.
  @Get("media/:bookId")
  getSecureMediaUrl(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Query("chapterId") chapterId?: string,
  ) {
    return this.service.getSecureMediaUrl(user.userId, bookId, chapterId);
  }

  @Post("offline/:bookId")
  registerOffline(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Body() body: { sizeBytes?: number },
  ) {
    return this.service.registerOffline(user.userId, bookId, body?.sizeBytes);
  }

  // ---- Reading progress ----
  @Get("progress/:bookId")
  getProgress(@CurrentUser() user: AuthUser, @Param("bookId") bookId: string) {
    return this.service.getProgress(user.userId, bookId);
  }

  @Put("progress/:bookId")
  updateProgress(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.service.updateProgress(user.userId, bookId, dto);
  }

  // ---- Bookmarks ----
  @Get(":bookId/bookmarks")
  bookmarks(@CurrentUser() user: AuthUser, @Param("bookId") bookId: string) {
    return this.service.listBookmarks(user.userId, bookId);
  }

  @Post(":bookId/bookmarks")
  addBookmark(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Body() dto: CreateBookmarkDto,
  ) {
    return this.service.addBookmark(user.userId, bookId, dto);
  }

  @Delete("bookmarks/:id")
  removeBookmark(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.removeBookmark(user.userId, id);
  }

  // ---- Highlights ----
  @Get(":bookId/highlights")
  highlights(@CurrentUser() user: AuthUser, @Param("bookId") bookId: string) {
    return this.service.listHighlights(user.userId, bookId);
  }

  @Post(":bookId/highlights")
  addHighlight(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Body() dto: CreateHighlightDto,
  ) {
    return this.service.addHighlight(user.userId, bookId, dto);
  }

  @Delete("highlights/:id")
  removeHighlight(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.removeHighlight(user.userId, id);
  }

  // ---- Notes ----
  @Get(":bookId/notes")
  notes(@CurrentUser() user: AuthUser, @Param("bookId") bookId: string) {
    return this.service.listNotes(user.userId, bookId);
  }

  @Post(":bookId/notes")
  addNote(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.service.addNote(user.userId, bookId, dto);
  }

  @Delete("notes/:id")
  removeNote(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.removeNote(user.userId, id);
  }
}
