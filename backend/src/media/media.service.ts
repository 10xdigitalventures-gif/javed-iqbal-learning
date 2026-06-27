import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { spawn, spawnSync } from "child_process";
import { statSync } from "fs";
import { basename, dirname, extname, join } from "path";
import { PrismaService } from "../prisma/prisma.service";

// Server-side media inspection. We never trust a client-supplied duration; for
// audio/video we probe the actual file with ffprobe and return the real value.
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private prisma: PrismaService) {}

  // Map a MIME type to the coarse Media Library category used for filtering.
  categoryFromMime(mime: string): string {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime === "application/pdf") return "pdf";
    return "file";
  }

  // Persist an uploaded object as a reusable Media Library item.
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

  // List Media Library items. Admins may list everything; everyone else sees
  // only their own uploads. Optional `type` filters by category.
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

  // Returns the media duration in whole seconds, or null when it cannot be
  // determined (e.g. ffprobe missing or non-media file).
  probeDurationSec(filePath: string): number | null {
    try {
      const res = spawnSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          filePath,
        ],
        { encoding: "utf8", timeout: 15000 },
      );
      if (res.status !== 0) {
        this.logger.warn(`ffprobe failed for ${filePath}: ${res.stderr}`);
        return null;
      }
      const seconds = parseFloat((res.stdout || "").trim());
      if (!isFinite(seconds) || seconds <= 0) return null;
      return Math.round(seconds);
    } catch (err) {
      this.logger.warn(`ffprobe error: ${(err as Error).message}`);
      return null;
    }
  }

  // Transcode a video to a web-friendly H.264/AAC MP4 at a capped height
  // (default 720p, configurable via VIDEO_MAX_HEIGHT). Smaller file = faster
  // upload/download and smooth streaming with no visible quality loss, plus
  // guaranteed cross-platform playback. Uses async spawn so the event loop is
  // never blocked. Resolves to null on failure (caller keeps the original).
  transcodeToMp4(
    inputPath: string,
  ): Promise<{ path: string; filename: string; size: number } | null> {
    const maxHeight = Number(process.env.VIDEO_MAX_HEIGHT || 720);
    const crf = Number(process.env.VIDEO_CRF || 23);
    const preset = process.env.VIDEO_PRESET || "veryfast";
    const dir = dirname(inputPath);
    const base = basename(inputPath, extname(inputPath));
    const outName = base + "-h264.mp4";
    const outPath = join(dir, outName);
    const args = [
      "-v",
      "error",
      "-i",
      inputPath,
      // Cap height to maxHeight, keep aspect ratio, force even width (-2).
      // The min() never upscales smaller sources.
      "-vf",
      `scale=-2:'min(ih,${maxHeight})'`,
      "-c:v",
      "libx264",
      "-preset",
      preset,
      "-crf",
      String(crf),
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-y",
      outPath,
    ];
    return new Promise((resolve) => {
      try {
        const proc = spawn("ffmpeg", args, { stdio: "ignore" });
        proc.on("error", (err) => {
          this.logger.warn(`ffmpeg transcode error: ${err.message}`);
          resolve(null);
        });
        proc.on("close", (code) => {
          if (code !== 0) {
            this.logger.warn(`ffmpeg transcode exited with code ${code}`);
            resolve(null);
            return;
          }
          try {
            const size = statSync(outPath).size;
            resolve({ path: outPath, filename: outName, size });
          } catch (e) {
            this.logger.warn(
              `transcode output missing: ${(e as Error).message}`,
            );
            resolve(null);
          }
        });
      } catch (err) {
        this.logger.warn(`ffmpeg spawn failed: ${(err as Error).message}`);
        resolve(null);
      }
    });
  }

  // Compress an audio upload to a small AAC/.m4a file (default ~96 kbps, mono),
  // configurable via AUDIO_BITRATE / AUDIO_CHANNELS. Large WAV/MP3 lecture and
  // audiobook sources shrink dramatically with no audible loss for speech =
  // faster upload/download and cheaper storage, mirroring the video transcode.
  // Async spawn keeps the event loop free. Resolves to null on failure (caller
  // keeps the original file).
  transcodeAudio(
    inputPath: string,
  ): Promise<{ path: string; filename: string; size: number } | null> {
    const bitrate = process.env.AUDIO_BITRATE || "96k";
    const channels = Number(process.env.AUDIO_CHANNELS || 1);
    const dir = dirname(inputPath);
    const base = basename(inputPath, extname(inputPath));
    const outName = base + "-aac.m4a";
    const outPath = join(dir, outName);
    const args = [
      "-v",
      "error",
      "-i",
      inputPath,
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      bitrate,
      "-ac",
      String(channels),
      "-ar",
      "44100",
      "-movflags",
      "+faststart",
      "-y",
      outPath,
    ];
    return new Promise((resolve) => {
      try {
        const proc = spawn("ffmpeg", args, { stdio: "ignore" });
        proc.on("error", (err) => {
          this.logger.warn(`ffmpeg audio transcode error: ${err.message}`);
          resolve(null);
        });
        proc.on("close", (code) => {
          if (code !== 0) {
            this.logger.warn(`ffmpeg audio transcode exited with code ${code}`);
            resolve(null);
            return;
          }
          try {
            const size = statSync(outPath).size;
            resolve({ path: outPath, filename: outName, size });
          } catch (e) {
            this.logger.warn(
              `audio transcode output missing: ${(e as Error).message}`,
            );
            resolve(null);
          }
        });
      } catch (err) {
        this.logger.warn(
          `ffmpeg audio spawn failed: ${(err as Error).message}`,
        );
        resolve(null);
      }
    });
  }
}
