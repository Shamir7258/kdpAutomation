export interface ExportDto {
  id: string;
  projectId: string;
  batchId: string;
  /** Filenames included in the ZIP, for display — e.g. ["interior.pdf", "cover-wrap-print.pdf",
   *  "cover-ebook.png", "metadata.txt", "README.txt"]. */
  includedFiles: string[];
  url: string;
  fileSizeBytes: number;
  createdAt: string;
}
