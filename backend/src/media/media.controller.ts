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
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "fs";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StorageService } from "./storage.service";
import { StorageService as CloudStorageService } from "../storage/storage.service";
import { MediaService } from "./media.service";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const ALLOWED_MIME_PREFIXES = ["audio/", "video/", "image/", "application/pdf"];
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller("media")
export class MediaController {
  constructor(
    private readonly storage: StorageService,
    private readonly cloud: CloudStorageService,
    private readonly media: MediaService,
  ) {}

  // Returns true when a real cloud provider is configured (Supabase/Bunny/R2).
  // When false, we keep the legacy local-disk + HMAC-signed-URL behaviour so
  // local development works without any cloud credentials.
  private cloudEnabled(): boolean {
    const p = (process.env.STORAGE_PROVIDER || "").toLowerCase();
    if (p === "supabase")
      return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
    if (p === "bunny") return !!process.env.BUNNY_STORAGE_KEY;
    if (p === "r2" || p === "s3")
      return !!(process.env.CLOUDFLARE_R2_KEY || process.env.S3_ACCESS_KEY_ID);
    return false;
  }

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
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("File is required");

    // Server-side duration verification for audio/video (never trust client).
    // ffprobe needs a real file path, so we always probe the temp disk file
    // before (optionally) pushing the bytes to the cloud.
    let durationSec: number | null = null;
    if (file.mimetype.startsWith("audio/") || file.mimetype.startsWith("video/")) {
      durationSec = this.media.probeDurationSec(file.path);
    }

    // Cloud path: push the bytes to the configured provider (e.g. Supabase),
    // remove the local temp copy, and return a short-lived signed URL.
    if (this.cloudEnabled()) {
      const key = `media/${file.filename}`;
      const buf = readFileSync(file.path);
      await this.cloud.uploadFile(key, buf, file.mimetype);
      try {
        unlinkSync(file.path);
      } catch {
        // best-effort temp cleanup; ignore if it was already removed
      }
      const url = await this.cloud.getSignedUrl(key);
      return {
        key,
        url,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        durationSec,
        storage: "cloud",
      };
    }

    // Legacy local path: file stays on disk, served via signed /media/file/:key.
    return {
      key: file.filename,
      url: this.storage.signedUrl(file.filename),
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      durationSec,
      storage: "local",
    };
  }

  // Re-sign a stored object key (signed URLs expire; clients call this to
  // refresh playback links for older messages).
  @Get("sign")
  @UseGuards(JwtAuthGuard)
  async sign(@Query("key") key: string) {
    if (!key) throw new BadRequestException("key is required");
    if (this.cloudEnabled()) return { url: await this.cloud.getSignedUrl(key) };
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
    if (this.cloudEnabled() || this.storage.isS3())
      throw new NotFoundException("Local delivery disabled when using cloud storage");
    if (!this.storage.verifyLocalSignature(key, Number(exp), sig))
      throw new BadRequestException("Invalid or expired link");
    const path = this.storage.localPath(key);
    if (!existsSync(path)) throw new NotFoundException("File not found");
    return res.sendFile(path);
  }
}
