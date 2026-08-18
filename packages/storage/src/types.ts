export interface StoredFile {
  /** Opaque path-like identifier, e.g. `interiors/<userId>/<projectId>/<filename>`. */
  key: string;
  /** Where to fetch the file from. A relative backend route for LocalStorageProvider, an absolute
   *  (typically presigned, expiring) URL for S3StorageProvider. */
  url: string;
  sizeBytes: number;
}

export interface StorageProvider {
  readonly name: string;
  save(key: string, data: Buffer, contentType: string): Promise<StoredFile>;
  /** Re-derives the fetch URL for an existing key without re-uploading (e.g. a fresh presigned URL). */
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
