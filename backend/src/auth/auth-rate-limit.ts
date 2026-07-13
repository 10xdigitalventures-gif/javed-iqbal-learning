import { TooManyRequestsException } from "@nestjs/common";

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function enforceAuthRateLimit(
  bucket: string,
  key: string,
  limit: number,
  windowSec: number,
) {
  const safeLimit = Math.max(1, limit || 1);
  const safeWindowMs = Math.max(1000, (windowSec || 60) * 1000);
  const now = Date.now();
  const bucketKey = `${bucket}:${key}`;
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + safeWindowMs });
    return;
  }
  if (current.count >= safeLimit) {
    throw new TooManyRequestsException(
      "Too many attempts. Please wait and try again.",
    );
  }
  current.count += 1;
  buckets.set(bucketKey, current);
}
