import { IStorageProvider } from './interfaces';
import { InternalServerErrorException } from '@nestjs/common';

export class BunnyProvider implements IStorageProvider {
  private storageKey: string;
  private zoneName: string;
  private region: string;

  constructor() {
    this.storageKey = process.env.BUNNY_STORAGE_KEY || '';
    this.zoneName = process.env.BUNNY_ZONE_ID || ''; // Using ZONE_ID as name for endpoint
    this.region = process.env.BUNNY_REGION || '';
  }

  private getBaseUrl() {
    return this.region
      ? `https://${this.region}.storage.bunnycdn.com/${this.zoneName}`
      : `https://storage.bunnycdn.com/${this.zoneName}`;
  }

  async upload(path: string, file: Buffer, mimeType: string): Promise<string> {
    if (!this.storageKey) throw new InternalServerErrorException('BunnyCDN not configured');
    
    const url = `${this.getBaseUrl()}/${path}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        AccessKey: this.storageKey,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(file),
    });
    
    if (!res.ok) throw new InternalServerErrorException('BunnyCDN upload failed');
    return path;
  }

  getUrl(path: string): string {
    const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL || '';
    return `${pullZoneUrl}/${path}`;
  }

  async getSignedUrl(path: string, expiresInSec: number): Promise<string> {
    // BunnyCDN Token Authentication uses an MD5 hash of the URL, IP, and security key.
    // For this abstraction, we will return the base URL if token auth isn't fully set up,
    // or you can implement the specific Bunny CDN URL signing logic here.
    return this.getUrl(path); 
  }

  async delete(path: string): Promise<void> {
    if (!this.storageKey) throw new InternalServerErrorException('BunnyCDN not configured');
    
    const url = `${this.getBaseUrl()}/${path}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { AccessKey: this.storageKey },
    });
    
    if (!res.ok) throw new InternalServerErrorException('BunnyCDN delete failed');
  }

  async download(path: string): Promise<Buffer> {
    if (!this.storageKey) throw new InternalServerErrorException('BunnyCDN not configured');
    
    const url = `${this.getBaseUrl()}/${path}`;
    const res = await fetch(url, {
      headers: { AccessKey: this.storageKey },
    });
    
    if (!res.ok) throw new InternalServerErrorException('BunnyCDN download failed');
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
