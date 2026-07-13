import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request, Response } from "express";
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

const SHARE_TTL_SEC = 7 * 24 * 60 * 60;
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_UPLOAD_BYTES = Number(
  process.env.MAX_UPLOAD_BYTES || 250 * 1024 * 1024,
);
const ALLOWED_MIME_PREFIXES = [
  "audio/",
  "video/",
  "image/",
  "application/pdf",
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

  private cloudEnabled(): boolean {
    const p = (process.env.STORAGE_PROVIDER || "").toLowerCase();
    if (p === "supabase")
      return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
    if (p === "bunny") return !!process.env.BUNNY_STORAGE_KEY;
    if (p === "r2" || p === "s3")
      return !!(process.env.CLOUDFLARE_R2_KEY || process.env.S3_ACCESS_KEY_ID);
    return false;
  }

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
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        const allowed = ALLOWED_MIME_PREFIXES.some((p) =>
          file.mimetype.startsWith(p),
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
    let durationSec: number | null = null;
    if (
      file.mimetype.startsWith("audio/") ||
      file.mimetype.startsWith("video/")
    ) {
      durationSec = this.media.probeDurationSec(file.path);
    }
    let uploadPath = file.path,
      uploadName = file.filename;
    let storedMime = file.mimetype,
      storedSize = file.size;
    if (file.mimetype.startsWith("video/")) {
      const out = await this.media.transcodeToMp4(file.path);
      if (out) {
        try {
          if (out.path !== file.path) unlinkSync(file.path);
        } catch {}
        uploadPath = out.path;
        uploadName = out.filename;
        storedMime = "video/mp4";
        storedSize = out.size;
      }
    }
    if (file.mimetype.startsWith("audio/")) {
      const out = await this.media.transcodeAudio(file.path);
      if (out) {
        try {
          if (out.path !== file.path) unlinkSync(file.path);
        } catch {}
        uploadPath = out.path;
        uploadName = out.filename;
        storedMime = "audio/mp4";
        storedSize = out.size;
      }
    }
    if (this.cloudEnabled()) {
      const key = "media/" + uploadName;
      const buf = readFileSync(uploadPath);
      await this.cloud.uploadFile(key, buf, storedMime);
      try {
        unlinkSync(uploadPath);
      } catch {}
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

  private async urlForKey(key: string, ttlSec = 3600): Promise<string> {
    if (this.cloudEnabled()) return this.cloud.getSignedUrl(key, ttlSec);
    return this.storage.signedUrl(key);
  }

  @Get("library")
  @UseGuards(JwtAuthGuard)
  async library(@CurrentUser() user: AuthUser, @Query("type") type?: string) {
    const ownerId = isAdmin(user) ? undefined : user.userId;
    const items = await this.media.listAssets({ ownerId, type });
    return Promise.all(
      items.map(async (it) => {
        let url: string | null = null,
          urlError: string | null = null;
        try {
          url = await this.urlForKey(it.key);
        } catch (e: any) {
          urlError = e?.message || "Could not generate URL";
        }
        return { ...it, url, urlError };
      }),
    );
  }

  @Get("share/:id")
  @UseGuards(JwtAuthGuard)
  async share(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const asset = await this.media.getAsset(id);
    if (!isAdmin(user) && asset.ownerId !== user.userId) {
      throw new ForbiddenException("Not allowed to share this item");
    }
    return {
      url: await this.urlForKey(asset.key, SHARE_TTL_SEC),
      type: asset.type,
      filename: asset.filename,
      mimeType: asset.mimeType,
      durationSec: asset.durationSec,
    };
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const asset = await this.media.getAsset(id);
    if (!isAdmin(user) && asset.ownerId !== user.userId)
      throw new ForbiddenException("Not allowed to delete this item");
    try {
      if (this.cloudEnabled()) await this.cloud.deleteFile(asset.key);
    } catch {}
    return this.media.deleteAsset(id);
  }

  @Get("sign")
  @UseGuards(JwtAuthGuard)
  async sign(@CurrentUser() user: AuthUser, @Query("key") key: string) {
    if (!key) throw new BadRequestException("key is required");
    const allowed = await this.media.canAccessKey(user.userId, user.role, key);
    if (!allowed)
      throw new ForbiddenException("Not allowed to access this file");
    if (this.cloudEnabled()) return { url: await this.cloud.getSignedUrl(key) };
    return { url: this.storage.signedUrl(key) };
  }

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

  // ======= PHASE 2: Secure Download Token =======
  // POST /media/download-token  body: { lessonId }
  // Returns a 24-hour JWT + AES-256 key. The mobile app stores the key in the
  // device Keychain (expo-secure-store) and re-validates the token on every play.
  @Post("download-token")
  @UseGuards(JwtAuthGuard)
  async downloadToken(
    @CurrentUser() user: AuthUser,
    @Body() body: { lessonId: string },
  ) {
    if (!body?.lessonId) throw new BadRequestException("lessonId is required");
    return this.media.generateDownloadToken(user.userId, body.lessonId);
  }

  // ======= PHASE 3: DRM Token =======
  // GET /media/drm-token/:lessonId
  // Returns a 2-hour JWT that the player sends to the DRM license server.
  @Get("drm-token/:lessonId")
  @UseGuards(JwtAuthGuard)
  async drmToken(
    @CurrentUser() user: AuthUser,
    @Param("lessonId") lessonId: string,
  ) {
    return this.media.generateDrmToken(user.userId, lessonId);
  }

  // ======= PHASE 3: DRM License Proxy =======
  // POST /media/drm-license/:lessonId
  // Validates the DRM token from the Authorization header, then proxies the
  // license request to the configured DRM provider.
  // In production set DRM_LICENSE_SERVER_URL + DRM_LICENSE_AUTH_KEY env vars.
  @Post("drm-license/:lessonId")
  async drmLicense(
    @Param("lessonId") lessonId: string,
    @Headers("authorization") authHeader: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const token = (authHeader || "").replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("DRM token required");
    const result = await this.media.verifyDrmToken(lessonId, token);
    if (!result.valid)
      throw new UnauthorizedException("Invalid or expired DRM token");

    const licenseServer = process.env.DRM_LICENSE_SERVER_URL;
    if (!licenseServer) {
      // No external DRM configured - return a stub response for development
      res.status(200).send(Buffer.alloc(0));
      return;
    }

    // Proxy the raw license challenge bytes to the DRM provider
    const fetch = (await import("node-fetch")).default;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    await new Promise((resolve) => req.on("end", resolve));
    const body = Buffer.concat(chunks);

    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
    };
    if (process.env.DRM_LICENSE_AUTH_KEY) {
      headers["Authorization"] = "Bearer " + process.env.DRM_LICENSE_AUTH_KEY;
    }

    const upstream = await fetch(licenseServer, {
      method: "POST",
      headers,
      body,
    });
    const licBytes = await upstream.buffer();
    res
      .status(upstream.status)
      .set("Content-Type", "application/octet-stream")
      .send(licBytes);
  }
}
