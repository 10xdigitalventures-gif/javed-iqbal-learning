import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
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
import { CurrentUser, AuthUser } from "../auth/current-user.decorator";
import { isAdmin } from "../common/access";
import { StorageService } from "./storage.service";
import { StorageService as CloudStorageService } from "../storage/storage.service";
import { MediaService } from "./media.service";

// A shared link is valid for 7 days; long enough to paste into a course,
// community post or message without leaking a permanent public URL.
const SHARE_TTL_SEC = 7 * 24 * 60 * 60;

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const ALLOWED_MIME_PREFIXES = [
  "audio/",
  "video/",
  "image/",
  "application/pdf",
  // Office document types used by assignment submissions (DOC, DOCX, XLS,
  // XLSX, PPT, PPTX) and OpenDocument equivalents.
  "application/msword",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.oasis.opendocument",
  "text/plain",
  "text/csv",
];
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
      limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB
      fileFilter: (_req, file, cb) => {
        const allowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
          file.mimetype.startsWith(prefix),
        );
        cb(
          allowed ? null : new BadRequestException("Unsupported file type"),
          allowed,
        );
      },
    }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("File is required");

    // Server-side duration verification for audio/video (never trust client).
    // ffprobe needs a real file path, so we always probe the temp disk file
    // before (optionally) pushing the bytes to the cloud.
    let durationSec: number | null = null;
    if (
      file.mimetype.startsWith("audio/") ||
      file.mimetype.startsWith("video/")
    ) {
      durationSec = this.media.probeDurationSec(file.path);
    }

    // Video transcode: shrink to a web-friendly H.264/AAC MP4 (capped height,
    // default 720p) before storing. Lighter file = faster upload/download and
    // smooth streaming with no visible quality loss. On failure we silently
    // fall back to the original upload.
    let uploadPath = file.path;
    let uploadName = file.filename;
    let storedMime = file.mimetype;
    let storedSize = file.size;
    if (file.mimetype.startsWith("video/")) {
      const out = await this.media.transcodeToMp4(file.path);
      if (out) {
        try {
          if (out.path !== file.path) unlinkSync(file.path);
        } catch {
          // best-effort cleanup of the original upload
        }
        uploadPath = out.path;
        uploadName = out.filename;
        storedMime = "video/mp4";
        storedSize = out.size;
      }
    }

    // Audio transcode: shrink to a compact AAC/.m4a (default ~96 kbps mono)
    // before storing. Lectures and audiobooks get much smaller with no audible
    // loss = faster upload/download and cheaper storage. Falls back to the
    // original on failure.
    if (file.mimetype.startsWith("audio/")) {
      const out = await this.media.transcodeAudio(file.path);
      if (out) {
        try {
          if (out.path !== file.path) unlinkSync(file.path);
        } catch {
          // best-effort cleanup of the original upload
        }
        uploadPath = out.path;
        uploadName = out.filename;
        storedMime = "audio/mp4";
        storedSize = out.size;
      }
    }

    // Cloud path: push the bytes to the configured provider (e.g. Supabase),
    // remove the local temp copy, and return a short-lived signed URL.
    if (this.cloudEnabled()) {
      const key = `media/${uploadName}`;
      const buf = readFileSync(uploadPath);
      await this.cloud.uploadFile(key, buf, storedMime);
      try {
        unlinkSync(uploadPath);
      } catch {
        // best-effort temp cleanup; ignore if it was already removed
      }
      const url = await this.cloud.getSignedUrl(key);
      const asset = await this.media.recordAsset({
        ownerId: user.userId,
        key,
        mimeType: storedMime,
        filename: file.originalname,
        size: storedSize,
        durationSec,
        storage: "cloud",
      });
      return {
        assetId: asset.id,
        key,
        url,
        filename: uploadName,
        mimetype: storedMime,
        size: storedSize,
        durationSec,
        storage: "cloud",
      };
    }

    // Legacy local path: file stays on disk, served via signed /media/file/:key.
    const asset = await this.media.recordAsset({
      ownerId: user.userId,
      key: uploadName,
      mimeType: storedMime,
      filename: file.originalname,
      size: storedSize,
      durationSec,
      storage: "local",
    });
    return {
      assetId: asset.id,
      key: uploadName,
      url: this.storage.signedUrl(uploadName),
      filename: uploadName,
      mimetype: storedMime,
      size: storedSize,
      durationSec,
      storage: "local",
    };
  }

  // Helper: build a fresh, time-limited URL for a stored key regardless of the
  // active storage driver.
  private async urlForKey(key: string, ttlSec = 3600): Promise<string> {
    if (this.cloudEnabled()) return this.cloud.getSignedUrl(key, ttlSec);
    return this.storage.signedUrl(key);
  }

  // Media Library listing. Admins see every item; everyone else sees only their
  // own uploads. Optional ?type=image|video|audio|pdf|file filter. Each item
  // comes back with a fresh signed URL for inline preview.
  @Get("library")
  @UseGuards(JwtAuthGuard)
  async library(@CurrentUser() user: AuthUser, @Query("type") type?: string) {
    const ownerId = isAdmin(user) ? undefined : user.userId;
    const items = await this.media.listAssets({ ownerId, type });
    return Promise.all(
      items.map(async (it) => {
        // A single missing/inaccessible object (e.g. a row whose bytes were
        // never uploaded to the bucket) must not 500 the whole library. Return
        // the item with a null url + error note so the rest still loads.
        let url: string | null = null;
        let urlError: string | null = null;
        try {
          url = await this.urlForKey(it.key);
        } catch (e: any) {
          urlError = e?.message || "Could not generate URL";
        }
        return { ...it, url, urlError };
      }),
    );
  }

  // A longer-lived shareable link for a specific image/video/file so it can be
  // dropped into a course, community post or message.
  @Get("share/:id")
  @UseGuards(JwtAuthGuard)
  async share(@Param("id") id: string) {
    const asset = await this.media.getAsset(id);
    return {
      url: await this.urlForKey(asset.key, SHARE_TTL_SEC),
      type: asset.type,
      filename: asset.filename,
      mimeType: asset.mimeType,
      durationSec: asset.durationSec,
    };
  }

  // Remove a Media Library item (owner or admin). Best-effort storage cleanup;
  // the DB row removal is the source of truth.
  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const asset = await this.media.getAsset(id);
    if (!isAdmin(user) && asset.ownerId !== user.userId)
      throw new ForbiddenException("Not allowed to delete this item");
    try {
      if (this.cloudEnabled()) await this.cloud.deleteFile(asset.key);
    } catch {
      // ignore storage errors so the library stays consistent
    }
    return this.media.deleteAsset(id);
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
      throw new NotFoundException(
        "Local delivery disabled when using cloud storage",
      );
    if (!this.storage.verifyLocalSignature(key, Number(exp), sig))
      throw new BadRequestException("Invalid or expired link");
    const path = this.storage.localPath(key);
    if (!existsSync(path)) throw new NotFoundException("File not found");
    return res.sendFile(path);
  }
}
