export interface IStorageProvider {
  upload(path: string, file: Buffer, mimeType: string): Promise<string>;
  getUrl(path: string): string;
  getSignedUrl(path: string, expiresInSec: number): Promise<string>;
  delete(path: string): Promise<void>;
  download(path: string): Promise<Buffer>;
}
