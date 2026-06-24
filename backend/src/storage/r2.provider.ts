import { IStorageProvider } from './interfaces';
import { InternalServerErrorException } from '@nestjs/common';

// Cloudflare R2 is fully S3-compatible. You can use the AWS SDK v3 here.
// import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class R2Provider implements IStorageProvider {
  // private s3: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    const accessKeyId = process.env.CLOUDFLARE_R2_KEY || '';
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET || '';
    const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || ''; // e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    
    this.bucket = process.env.CLOUDFLARE_R2_BUCKET || 'consult-hub';
    this.publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || '';

    // this.s3 = new S3Client({
    //   region: 'auto',
    //   endpoint,
    //   credentials: { accessKeyId, secretAccessKey }
    // });
  }

  async upload(path: string, file: Buffer, mimeType: string): Promise<string> {
    // await this.s3.send(new PutObjectCommand({
    //   Bucket: this.bucket, Key: path, Body: file, ContentType: mimeType
    // }));
    return path;
  }

  getUrl(path: string): string {
    return `${this.publicUrl}/${path}`;
  }

  async getSignedUrl(path: string, expiresInSec: number): Promise<string> {
    // const command = new GetObjectCommand({ Bucket: this.bucket, Key: path });
    // return getSignedUrl(this.s3, command, { expiresIn: expiresInSec });
    return this.getUrl(path);
  }

  async delete(path: string): Promise<void> {
    // await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: path }));
  }

  async download(path: string): Promise<Buffer> {
    // const { Body } = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: path }));
    // return streamToBuffer(Body);
    return Buffer.from('');
  }
}
