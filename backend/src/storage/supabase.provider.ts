import { IStorageProvider } from './interfaces';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InternalServerErrorException } from '@nestjs/common';

export class SupabaseProvider implements IStorageProvider {
  private client: SupabaseClient | null = null;
  private bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_KEY || '';
    this.bucket = process.env.SUPABASE_BUCKET || 'consult-hub';
    
    if (url && key) {
      this.client = createClient(url, key);
    } else {
      console.warn('Supabase URL or Key is missing. Storage operations will fail.');
    }
  }

  async upload(path: string, file: Buffer, mimeType: string): Promise<string> {
    if (!this.client) throw new InternalServerErrorException('Supabase not configured');
    
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, file, { contentType: mimeType, upsert: true });

    if (error) throw new InternalServerErrorException(`Supabase upload error: ${error.message}`);
    return path;
  }

  getUrl(path: string): string {
    if (!this.client) return '';
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async getSignedUrl(path: string, expiresInSec: number): Promise<string> {
    if (!this.client) throw new InternalServerErrorException('Supabase not configured');
    
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSec);

    if (error) throw new InternalServerErrorException(`Supabase signed URL error: ${error.message}`);
    return data.signedUrl;
  }

  async delete(path: string): Promise<void> {
    if (!this.client) throw new InternalServerErrorException('Supabase not configured');
    
    const { error } = await this.client.storage.from(this.bucket).remove([path]);
    if (error) throw new InternalServerErrorException(`Supabase delete error: ${error.message}`);
  }

  async download(path: string): Promise<Buffer> {
    if (!this.client) throw new InternalServerErrorException('Supabase not configured');
    
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error) throw new InternalServerErrorException(`Supabase download error: ${error.message}`);
    
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
