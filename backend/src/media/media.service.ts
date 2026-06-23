import { Injectable, Logger } from "@nestjs/common";
import { spawnSync } from "child_process";

// Server-side media inspection. We never trust a client-supplied duration; for
// audio/video we probe the actual file with ffprobe and return the real value.
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

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
}
