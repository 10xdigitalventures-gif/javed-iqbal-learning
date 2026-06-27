import { IStorageProvider } from './interfaces';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InternalServerErrorException } from '@nestjs/common';

// The @supabase/supabase-js client needs the PROJECT REST URL
// (e.g. https://<ref>.supabase.co), NOT the S3-compatibility endpoint
// (https://<ref>.storage.supabase.co/storage/v1/s3). It is very easy to paste
// the S3 endpoint into the "Supabase Project URL" field by mistake, which makes
// every upload / signed URL malformed and all images appear broken. Normalise
// the value defensively so either form works.
export function normalizeSupabaseUrl(raw: string): string {
  let u = (raw || '').trim();
  if (!u) return u;
  u = u.replace(/\/+$/, '');
  // S3-compatibility host: https://<ref>.storage.supabase.co[/...] -> project URL
  const s3Host = u.match(/^https?:\/\/([a-z0-9]+)\.storage\.supabase\.co/i);
  if (s3Host) return `https://${s3Host[1]}.supabase.co`;
  // Plain project host with an accidental /storage/v1[/s3] suffix.
  u = u.replace(/\/storage\/v1(\/s3)?$/i, '');
  return u;
}

export class SupabaseProvider implements IStorageProvider {
  private client: SupabaseClient | null = null;
  private clientUrl = '';
  private clientKey = '';
  private bucket = 'consult-hub';

  // Lazily build (and rebuild) the Supabase client from the CURRENT process.env.
  // The admin Settings screen mirrors credentials into process.env live, but a
  // client created once in the constructor would keep the old/empty values until
  // a restart (NestJS runs provider constructors BEFORE SettingsService mirrors
  // the saved env, so at boot the client is always null). Resolving lazily means
  // saving the Project URL / Service role key in Settings takes effect
  // immediately - no redeploy or restart needed. The client is cached and only
  // rebuilt when the URL or key actually changes.
  private resolveClient(): SupabaseClient | null {
    const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
    const key = process.env.SUPABASE_KEY || '';
    this.bucket = process.env.SUPABASE_BUCKET || 'consult-hub';
    if (!url || !key) {
      this.client = null;
      return null;
    }
    if (!this.client || url !== this.clientUrl || key !== this.clientKey) {
      this.client = createClient(url, key);
      this.clientUrl = url;
      this.clientKey = key;
    }
    return this.client;
  }

  async upload(path: string, file: Buffer, mimeType: string): Promise<string> {
    const client = this.resolveClient();
    if (!client) throw new InternalServerErrorException('Supabase not configured');
    const { error } = await client.storage
      .from(this.bucket)
      .upload(path, file, { contentType: mimeType, upsert: true });
    if (error) throw new InternalServerErrorException(`Supabase upload error: ${error.message}`);
    return path;
  }

  getUrl(path: string): string {
    const client = this.resolveClient();
    if (!client) return '';
    const { data } = client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async getSignedUrl(path: string, expiresInSec: number): Promise<string> {
    const client = this.resolveClient();
    if (!client) throw new InternalServerErrorException('Supabase not configured');
    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSec);
    if (error) throw new InternalServerErrorException(`Supabase signed URL error: ${error.message}`);
    return data.signedUrl;
  }

  async delete(path: string): Promise<void> {
    const client = this.resolveClient();
    if (!client) throw new InternalServerErrorException('Supabase not configured');
    const { error } = await client.storage.from(this.bucket).remove([path]);
    if (error) throw new InternalServerErrorException(`Supabase delete error: ${error.message}`);
  }

  async download(path: string): Promise<Buffer> {
    const client = this.resolveClient();
    if (!client) throw new InternalServerErrorException('Supabase not configured');
    const { data, error } = await client.storage.from(this.bucket).download(path);
    if (error) throw new InternalServerErrorException(`Supabase download error: ${error.message}`);
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
