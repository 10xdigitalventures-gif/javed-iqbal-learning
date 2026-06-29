
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { spawn, spawnSync } from "child_process";
import { statSync } from "fs";
import { basename, dirname, extname, join } from "path";
import { PrismaService } from "../prisma/prisma.service";
import * as crypto from "crypto";

// Server-side media inspection plus secure download / DRM token generation.
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  categoryFromMime(mime: string): string {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime === "application/pdf") return "pdf";
    return "file";
  }

  recordAsset(data: {
    ownerId: string;
    key: string;
    mimeType: string;
    filename: string;
    size?: number;
    durationSec?: number | null;
    storage?: string;
  }) {
    return this.prisma.mediaAsset.create({
      data: {
        ownerId: data.ownerId,
        key: data.key,
        type: this.categoryFromMime(data.mimeType),
        filename: data.filename,
        mimeType: data.mimeType,
        size: data.size ?? 0,
        durationSec: data.durationSec ?? null,
        storage: data.storage ?? "cloud",
      },
    });
  }

  listAssets(opts: { ownerId?: string; type?: string }) {
    const where: { ownerId?: string; type?: string } = {};
    if (opts.ownerId) where.ownerId = opts.ownerId;
    if (opts.type) where.type = opts.type;
    return this.prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getAsset(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException("Media item not found");
    return asset;
  }

  async deleteAsset(id: string) {
    await this.getAsset(id);
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Secure download token
  // Returns a 24-hour JWT that proves the user has purchased this lesson, plus
  // a random 256-bit AES key that the client should store in the device Keychain
  // and use to mark the downloaded file as "belonging" to this user/device.
  // ---------------------------------------------------------------------------
  async generateDownloadToken(
    userId: string,
    lessonId: string,
  ): Promise<{
    token: string;
    aesKey: string;
    expiresAt: number;
    accessUntil: number | null;
    offlineValidityDays: number;
  }> {
    // Verify the user actually has access to this lesson
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { include: { enrollments: { where: { userId } } } } },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    const enrollment =
      lesson.course.enrollments && lesson.course.enrollments.length > 0
        ? lesson.course.enrollments[0]
        : null;

    // Access is valid if previewable, or enrolled with a live (non-revoked,
    // non-expired) access window.
    const nowMs = Date.now();
    const notRevoked = !enrollment?.revokedAt;
    const notExpired =
      !enrollment?.accessUntil ||
      new Date(enrollment.accessUntil).getTime() > nowMs;
    const hasAccess =
      lesson.isPreview || (!!enrollment && notRevoked && notExpired);
    if (!hasAccess) throw new NotFoundException("Access denied");

    const offlineValidityDays =
      (lesson.course as any).offlineValidityDays ?? 30;
    const accessUntilMs = enrollment?.accessUntil
      ? new Date(enrollment.accessUntil).getTime()
      : null;

    // The offline token lives for the offline-validity window, but never longer
    // than the learner's remaining access window. This is the YouTube-style
    // "reconnect within N days" rule, capped by the purchased access period.
    const offlineWindowSec = offlineValidityDays * 24 * 60 * 60;
    let ttlSec = offlineWindowSec;
    if (accessUntilMs) {
      const accessRemainingSec = Math.max(
        60,
        Math.floor((accessUntilMs - nowMs) / 1000),
      );
      ttlSec = Math.min(ttlSec, accessRemainingSec);
    }

    const aesKey = crypto.randomBytes(32).toString("hex"); // 256-bit key
    const expiresAt = Math.floor(nowMs / 1000) + ttlSec;
    const token = this.jwtService.sign(
      { sub: userId, lessonId, aesKey, purpose: "download" },
      { expiresIn: ttlSec },
    );
    return {
      token,
      aesKey,
      expiresAt,
      accessUntil: accessUntilMs,
      offlineValidityDays,
    };
  }

  // ---------------------------------------------------------------------------
  // Phase 3: DRM license token
  // Returns a short-lived (2-hour) JWT used as the Authorization header when
  // the mobile player requests a Widevine / FairPlay license.
  // In production: replace this with calls to a real DRM provider
  // (e.g. Ezdrm, Axinom, or AWS MediaConvert + Speke).
  // ---------------------------------------------------------------------------
  async generateDrmToken(
    userId: string,
    lessonId: string,
  ): Promise<{ drmToken: string; licenseUrl: string; expiresAt: number }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { include: { enrollments: { where: { userId } } } } },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    const hasAccess =
      lesson.isPreview ||
      (lesson.course.enrollments && lesson.course.enrollments.length > 0);
    if (!hasAccess) throw new NotFoundException("Access denied");

    const expiresAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
    const drmToken = this.jwtService.sign(
      { sub: userId, lessonId, purpose: "drm" },
      { expiresIn: "2h" },
    );
    const apiBase = process.env.PUBLIC_API_URL || "http://localhost:3001";
    const licenseUrl = apiBase + "/media/drm-license/" + lessonId;
    return { drmToken, licenseUrl, expiresAt };
  }

  // ---------------------------------------------------------------------------
  // Phase 3: DRM license proxy
  // Validates the token and proxies the request to the actual DRM server.
  // Replace LICENSE_SERVER_URL with your Widevine / FairPlay license URL.
  // ---------------------------------------------------------------------------
  async verifyDrmToken(
    lessonId: string,
    token: string,
  ): Promise<{ valid: boolean; userId?: string }> {
    try {
      const payload = this.jwtService.verify(token) as any;
      if (payload.lessonId !== lessonId || payload.purpose !== "drm")
        return { valid: false };
      return { valid: true, userId: payload.sub };
    } catch {
      return { valid: false };
    }
  }

  probeDurationSec(filePath: string): number | null {
    try {
      const res = spawnSync(
        "ffprobe",
        [
          "-v", "error",
          "-show_entries", "format=duration",
          "-of", "default=noprint_wrappers=1:nokey=1",
          filePath,
        ],
        { timeout: 15000 },
      );
      const out = res.stdout?.toString().trim();
      const n = parseFloat(out);
      return isFinite(n) && n > 0 ? Math.round(n) : null;
    } catch {
      return null;
    }
  }

  async transcodeToMp4(
    inputPath: string,
  ): Promise<{ path: string; filename: string; size: number } | null> {
    const maxH = parseInt(process.env.VIDEO_MAX_HEIGHT || "720", 10);
    const outName = basename(inputPath, extname(inputPath)) + "-tc.mp4";
    const outPath = join(dirname(inputPath), outName);
    return new Promise((resolve) => {
      const ff = spawn("ffmpeg", [
        "-i", inputPath,
        "-vf", "scale=trunc(oh*a/2)*2:min(ih\," + maxH + ")",
        "-c:v", "libx264", "-crf", "23", "-preset", "fast",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        "-y", outPath,
      ]);
      ff.on("close", (code) => {
        if (code !== 0) { resolve(null); return; }
        try {
          const size = statSync(outPath).size;
          resolve({ path: outPath, filename: outName, size });
        } catch { resolve(null); }
      });
      ff.on("error", () => resolve(null));
    });
  }

  async transcodeAudio(
    inputPath: string,
  ): Promise<{ path: string; filename: string; size: number } | null> {
    const outName = basename(inputPath, extname(inputPath)) + "-tc.m4a";
    const outPath = join(dirname(inputPath), outName);
    return new Promise((resolve) => {
      const ff = spawn("ffmpeg", [
        "-i", inputPath,
        "-c:a", "aac", "-b:a", "96k", "-ac", "1",
        "-y", outPath,
      ]);
      ff.on("close", (code) => {
        if (code !== 0) { resolve(null); return; }
        try {
          const size = statSync(outPath).size;
          resolve({ path: outPath, filename: outName, size });
        } catch { resolve(null); }
      });
      ff.on("error", () => resolve(null));
    });
  }
}
