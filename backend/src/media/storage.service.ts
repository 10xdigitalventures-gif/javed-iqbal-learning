import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "crypto";
import { join } from "path";

// Pluggable object storage with signed URLs.
//
// Two drivers:
//   - "local" (default): files live on disk under UPLOAD_DIR and are served via
//     GET /api/media/file/:key with an HMAC-signed, time-limited token.
//   - "s3": files live in any S3-compatible bucket (AWS S3, Cloudflare R2,
//     Backblaze B2, MinIO). Signed GET URLs are generated with AWS Signature V4
//     using only Node's crypto module (no SDK dependency).
type Driver = "local" | "s3";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: Driver =
    (process.env.STORAGE_DRIVER as Driver) || "local";
  private readonly uploadDir = process.env.UPLOAD_DIR || "./uploads";
  private readonly signSecret =
    process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET || "change-me";
  private readonly defaultExpiry = Number(
    process.env.MEDIA_URL_EXPIRES_SEC || 60 * 60 * 24 * 7, // 7 days
  );

  // S3 config
  private readonly s3 = {
    bucket: process.env.S3_BUCKET || "",
    region: process.env.S3_REGION || "us-east-1",
    accessKey: process.env.S3_ACCESS_KEY_ID || "",
    secretKey: process.env.S3_SECRET_ACCESS_KEY || "",
    // For R2/MinIO set an explicit endpoint, e.g. https://<acct>.r2.cloudflarestorage.com
    endpoint: process.env.S3_ENDPOINT || "",
  };

  isS3() {
    return this.driver === "s3";
  }

  // Normalise a stored media reference to a stable object key. Accepts either a
  // raw key (what we persist) or a previously-signed local URL (defensive: in
  // case a client sends back a full URL). Returns null for empty input.
  extractKey(reference?: string | null): string | null {
    if (!reference) return null;
    const marker = "/media/file/";
    const idx = reference.indexOf(marker);
    if (idx !== -1) {
      const rest = reference.slice(idx + marker.length);
      const key = rest.split("?")[0];
      try {
        return decodeURIComponent(key);
      } catch {
        return key;
      }
    }
    return reference;
  }

  localPath(key: string) {
    return join(process.cwd(), this.uploadDir, key);
  }

  // Produce a signed, expiring URL for reading an object.
  signedUrl(key: string, expiresIn = this.defaultExpiry): string {
    if (this.driver === "s3") return this.s3PresignGet(key, expiresIn);
    return this.localSignedUrl(key, expiresIn);
  }

  // ---- Local driver ----
  private apiOrigin() {
    const base = process.env.PUBLIC_API_URL || "http://localhost:4000/api";
    return base.replace(/\/$/, "");
  }

  private localSignedUrl(key: string, expiresIn: number) {
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const sig = this.localSignature(key, exp);
    const q = new URLSearchParams({ exp: String(exp), sig });
    return `${this.apiOrigin()}/media/file/${encodeURIComponent(key)}?${q.toString()}`;
  }

  private localSignature(key: string, exp: number) {
    return createHmac("sha256", this.signSecret)
      .update(`${key}:${exp}`)
      .digest("hex");
  }

  verifyLocalSignature(key: string, exp: number, sig: string): boolean {
    if (!exp || !sig) return false;
    if (Math.floor(Date.now() / 1000) > exp) return false;
    const expected = this.localSignature(key, exp);
    // constant-time-ish comparison
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++)
      diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  }

  // ---- S3 driver (SigV4 query signing, no SDK) ----
  private s3PresignGet(key: string, expiresIn: number): string {
    const { bucket, region, accessKey, secretKey, endpoint } = this.s3;
    const now = new Date();
    const amzDate = now
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8);

    const host = endpoint
      ? endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "")
      : `${bucket}.s3.${region}.amazonaws.com`;
    const canonicalUri = endpoint
      ? `/${bucket}/${encodeS3Key(key)}`
      : `/${encodeS3Key(key)}`;

    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const params: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${accessKey}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresIn),
      "X-Amz-SignedHeaders": "host",
    };
    const canonicalQuery = Object.keys(params)
      .sort()
      .map(
        (k) =>
          `${encodeRfc3986(k)}=${encodeRfc3986(params[k])}`,
      )
      .join("&");

    const canonicalHeaders = `host:${host}\n`;
    const canonicalRequest = [
      "GET",
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = getSigningKey(secretKey, dateStamp, region, "s3");
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    const scheme = endpoint && endpoint.startsWith("http://") ? "http" : "https";
    return `${scheme}://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }
}

import { createHash } from "crypto";

function sha256Hex(data: string) {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function getSigningKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string,
) {
  const kDate = createHmac("sha256", "AWS4" + secret)
    .update(dateStamp)
    .digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

function encodeRfc3986(str: string) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

// Encode an object key for S3 paths (keep slashes).
function encodeS3Key(key: string) {
  return key
    .split("/")
    .map((seg) => encodeRfc3986(seg))
    .join("/");
}
