import { Injectable } from "@nestjs/common";
import { IStorageProvider } from "./interfaces";
import { SupabaseProvider } from "./supabase.provider";
import { BunnyProvider } from "./bunny.provider";
import { R2Provider } from "./r2.provider";
import { S3Provider } from "./s3.provider";

@Injectable()
export class StorageService {
  private cached?: { name: string; instance: IStorageProvider };

  // Resolve the active provider from the CURRENT env on each access (cached by
  // name, rebuilt when STORAGE_PROVIDER changes) so switching providers in the
  // admin Settings screen takes effect without a server restart.
  private get provider(): IStorageProvider {
    const name = (process.env.STORAGE_PROVIDER || "supabase").toLowerCase();
    if (this.cached && this.cached.name === name) return this.cached.instance;
    let instance: IStorageProvider;
    if (name === "bunny") {
      instance = new BunnyProvider();
    } else if (name === "s3") {
      // Real, dependency-free S3 implementation (AWS S3, Backblaze B2, MinIO).
      instance = new S3Provider();
    } else if (name === "r2") {
      instance = new R2Provider();
    } else {
      instance = new SupabaseProvider();
    }
    this.cached = { name, instance };
    return instance;
  }

  async uploadFile(path: string, file: Buffer, mimeType: string): Promise<string> {
    return this.provider.upload(path, file, mimeType);
  }

  async uploadImage(path: string, file: Buffer): Promise<string> {
    return this.uploadFile(path, file, "image/jpeg");
  }

  async uploadPDF(path: string, file: Buffer): Promise<string> {
    return this.uploadFile(path, file, "application/pdf");
  }

  async uploadVideo(path: string, file: Buffer): Promise<string> {
    return this.uploadFile(path, file, "video/mp4");
  }

  getFileUrl(path: string): string {
    return this.provider.getUrl(path);
  }

  async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    return this.provider.getSignedUrl(path, expiresIn);
  }

  async deleteFile(path: string): Promise<void> {
    return this.provider.delete(path);
  }

  async downloadSecureFile(path: string): Promise<Buffer> {
    return this.provider.download(path);
  }
}
