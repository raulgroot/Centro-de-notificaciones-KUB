/**
 * Port: StorageService
 *
 * Object storage for HTML previews and asset binaries (Freepik downloads, etc.).
 * Today implemented via Supabase Storage; portable to S3/Vercel Blob via new adapter.
 */

export interface StorageService {
  upload(path: string, data: Buffer | Uint8Array, contentType?: string): Promise<string>;
  getPublicUrl(path: string): string;
  delete(path: string): Promise<void>;
}
