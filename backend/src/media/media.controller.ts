import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { existsSync, mkdirSync } from "fs";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StorageService } from "./storage.service";
import { MediaService } from "./media.service";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const ALLOWED_MIME_PREFIXES = ["audio/", "video/", "image/", "application/pdf"];
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller("media")
export class MediaController {
  constructor(
    private readonly storage: StorageService,
    private readonly media: MediaService,
  ) {}

  // Accepts a single file under field name "file". Returns a signed, expiring
  // URL plus the server-verified media duration (for audio/video).
  @Post("upload")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
          file.mimetype.startsWith(prefix),
        );
        cb(allowed ? null : new BadRequestException("Unsupported file type"), allowed);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("File is required");

    // Server-side duration verification for audio/video (never trust client).
    let durationSec: number | null = null;
    if (file.mimetype.startsWith("audio/") || file.mimetype.startsWith("video/")) {
      durationSec = this.media.probeDurationSec(file.path);
    }

    return {
      key: file.filename,
      url: this.storage.signedUrl(file.filename),
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      durationSec,
    };
  }

  // Re-sign a stored object key (signed URLs expire; clients call this to
  // refresh playback links for older messages).
  @Get("sign")
  @UseGuards(JwtAuthGuard)
  sign(@Query("key") key: string) {
    if (!key) throw new BadRequestException("key is required");
    return { url: this.storage.signedUrl(key) };
  }

  // Signed file delivery for the local storage driver. No JWT guard: access is
  // authorised by the HMAC signature + expiry in the query string.
  @Get("file/:key")
  file(
    @Param("key") key: string,
    @Query("exp") exp: string,
    @Query("sig") sig: string,
    @Res() res: Response,
  ) {
    if (this.storage.isS3())
      throw new NotFoundException("Local delivery disabled when using S3");
    if (!this.storage.verifyLocalSignature(key, Number(exp), sig))
      throw new BadRequestException("Invalid or expired link");
    const path = this.storage.localPath(key);
    if (!existsSync(path)) throw new NotFoundException("File not found");
    return res.sendFile(path);
  }
}
