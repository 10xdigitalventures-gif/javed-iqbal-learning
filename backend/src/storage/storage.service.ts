import { Injectable } from "@nestjs/common";
import { IStorageProvider } from "./interfaces";
import { SupabaseProvider } from "./supabase.provider";
import { BunnyProvider } from "./bunny.provider";
import { R2Provider } from "./r2.provider";

@Injectable()
export class StorageService {
  private provider: IStorageProvider;

  constructor() {
    const providerName = process.env.STORAGE_PROVIDER || "supabase";
    
    if (providerName === "supabase") {
      this.provider = new SupabaseProvider();
    } else if (providerName === "bunny") {
      this.provider = new BunnyProvider();
    } else if (providerName === "r2" || providerName === "s3") {
      this.provider = new R2Provider();
    } else {
      this.provider = new SupabaseProvider();
    }
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
