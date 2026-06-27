import { IStorageProvider } from "./interfaces";
import { InternalServerErrorException } from "@nestjs/common";
import { createHash, createHmac } from "crypto";

// Real S3-compatible storage provider (AWS S3, Cloudflare R2, Backblaze B2,
// MinIO, etc). Uses AWS Signature V4 implemented with Node's crypto only -- no
// AWS SDK dependency required. Uploads/downloads/deletes use header-based
// signing with an UNSIGNED-PAYLOAD body hash (valid over HTTPS, and avoids
// hashing multi-GB files); reads expose short-lived presigned GET URLs.
export class S3Provider implements IStorageProvider {
  // Config is read from process.env lazily (via getters) so values set through
  // the admin Settings screen take effect without a server restart.
  private get bucket() {
    return process.env.S3_BUCKET || "";
  }
  private get region() {
    return process.env.S3_REGION || "us-east-1";
  }
  private get accessKey() {
    return process.env.S3_ACCESS_KEY_ID || "";
  }
  private get secretKey() {
    return process.env.S3_SECRET_ACCESS_KEY || "";
  }
  private get endpoint() {
    return (process.env.S3_ENDPOINT || "").replace(/\/+$/, "");
  }
  private get publicUrl() {
    return (process.env.S3_PUBLIC_URL || "").replace(/\/+$/, "");
  }
  // Custom endpoints (R2/MinIO) need path-style addressing; AWS uses
  // virtual-hosted style unless explicitly forced.
  private get forcePathStyle() {
    return (
      (process.env.S3_FORCE_PATH_STYLE || "").toLowerCase() === "true" ||
      !!this.endpoint
    );
  }

  private assertConfigured() {
    if (!this.bucket || !this.accessKey || !this.secretKey)
      throw new InternalServerErrorException("S3 not configured");
  }

  // Resolve the host, canonical URI and scheme for a given object key.
  private target(key: string): { host: string; canonicalUri: string; scheme: string } {
    const encKey = encodeS3Key(key);
    if (this.endpoint) {
      // Endpoints may include a base path, e.g. Supabase S3:
      //   https://<project-ref>.supabase.co/storage/v1/s3
      // Split the hostname from the base path so SigV4 signs the correct
      // canonical URI and host header (path-style: <base>/<bucket>/<key>).
      const u = new URL(this.endpoint);
      const scheme = u.protocol.replace(":", "");
      const basePath = u.pathname.replace(/\/+$/, "");
      return {
        host: u.host,
        canonicalUri: basePath + "/" + this.bucket + "/" + encKey,
        scheme,
      };
    }
    if (this.forcePathStyle) {
      return {
        host: "s3." + this.region + ".amazonaws.com",
        canonicalUri: "/" + this.bucket + "/" + encKey,
        scheme: "https",
      };
    }
    return {
      host: this.bucket + ".s3." + this.region + ".amazonaws.com",
      canonicalUri: "/" + encKey,
      scheme: "https",
    };
  }

  // Header-signed SigV4 request (PUT/GET/DELETE) via global fetch.
  private async signedRequest(
    method: string,
    key: string,
    body?: Buffer,
    contentType?: string,
  ) {
    this.assertConfigured();
    const { host, canonicalUri, scheme } = this.target(key);
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = "UNSIGNED-PAYLOAD";

    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) headers["content-type"] = contentType;

    const signedKeys = Object.keys(headers)
      .map((h) => h.toLowerCase())
      .sort();
    const canonicalHeaders = signedKeys
      .map((h) => h + ":" + headers[h] + "\n")
      .join("");
    const signedHeaders = signedKeys.join(";");

    const canonicalRequest = [
      method,
      canonicalUri,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = dateStamp + "/" + this.region + "/s3/aws4_request";
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const signingKey = getSigningKey(this.secretKey, dateStamp, this.region, "s3");
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");
    const authorization =
      "AWS4-HMAC-SHA256 Credential=" +
      this.accessKey +
      "/" +
      credentialScope +
      ", SignedHeaders=" +
      signedHeaders +
      ", Signature=" +
      signature;

    // `host` is a forbidden fetch header (set automatically from the URL); keep
    // it in the signature but not in the outgoing header list.
    const fetchHeaders: Record<string, string> = {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    };
    if (contentType) fetchHeaders["content-type"] = contentType;

    return fetch(scheme + "://" + host + canonicalUri, {
      method,
      headers: fetchHeaders,
      body: body ? new Uint8Array(body) : undefined,
    });
  }

  async upload(path: string, file: Buffer, mimeType: string): Promise<string> {
    const res = await this.signedRequest("PUT", path, file, mimeType);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new InternalServerErrorException(
        "S3 upload failed (" + res.status + ") " + detail.slice(0, 200),
      );
    }
    return path;
  }

  getUrl(path: string): string {
    if (this.publicUrl) return this.publicUrl + "/" + encodeS3Key(path);
    const { host, canonicalUri, scheme } = this.target(path);
    return scheme + "://" + host + canonicalUri;
  }

  async getSignedUrl(path: string, expiresInSec: number): Promise<string> {
    this.assertConfigured();
    return this.presignGet(path, expiresInSec);
  }

  async delete(path: string): Promise<void> {
    const res = await this.signedRequest("DELETE", path);
    if (!res.ok && res.status !== 404)
      throw new InternalServerErrorException("S3 delete failed (" + res.status + ")");
  }

  async download(path: string): Promise<Buffer> {
    const res = await this.signedRequest("GET", path);
    if (!res.ok)
      throw new InternalServerErrorException("S3 download failed (" + res.status + ")");
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  // Presigned GET URL (query-string SigV4) for short-lived inline access.
  private presignGet(key: string, expiresIn: number): string {
    const { host, canonicalUri, scheme } = this.target(key);
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = dateStamp + "/" + this.region + "/s3/aws4_request";
    const params: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": this.accessKey + "/" + credentialScope,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresIn),
      "X-Amz-SignedHeaders": "host",
    };
    const canonicalQuery = Object.keys(params)
      .sort()
      .map((k) => encodeRfc3986(k) + "=" + encodeRfc3986(params[k]))
      .join("&");
    const canonicalRequest = [
      "GET",
      canonicalUri,
      canonicalQuery,
      "host:" + host + "\n",
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const signingKey = getSigningKey(this.secretKey, dateStamp, this.region, "s3");
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");
    return (
      scheme + "://" + host + canonicalUri + "?" + canonicalQuery +
      "&X-Amz-Signature=" + signature
    );
  }
}

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data as any).digest("hex");
}

function getSigningKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = createHmac("sha256", "AWS4" + secret).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

// Encode an object key for S3 paths (preserve slashes).
function encodeS3Key(key: string): string {
  return key.split("/").map((seg) => encodeRfc3986(seg)).join("/");
}
