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
  /** Reads an existing key's bytes back — e.g. to bundle previously generated files into an
   *  export ZIP without needing to know which provider is active. */
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
