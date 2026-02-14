export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
  file?: File;
}

export interface FileValidationResult {
  validFiles: AttachedFile[];
  errors: string[];
}

export interface FileProcessingOptions {
  maxFileSize?: number;
  allowedTypes?: string[];
}

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Generates a unique file ID
 */
export function generateFileId(): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).slice(2, 11);
  return `file-${timestamp}-${randomId}`;
}

/**
 * Converts a File object to an AttachedFile object
 */
export function fileToAttachedFile(file: File): AttachedFile {
  return {
    id: generateFileId(),
    name: file.name,
    size: file.size,
    type: file.type,
    url: URL.createObjectURL(file),
    file,
  };
}

/**
 * Validates a single file against size limits
 */
export function validateFile(
  file: File,
  maxFileSize: number = DEFAULT_MAX_FILE_SIZE
): { isValid: boolean; error?: string } {
  if (file.size > maxFileSize) {
    return {
      isValid: false,
      error: `File "${file.name}" exceeds the ${formatFileSize(maxFileSize)} limit.`,
    };
  }

  return { isValid: true };
}

/**
 * Processes multiple files and validates them
 */
export function processFiles(
  files: File[],
  options: FileProcessingOptions = {}
): FileValidationResult {
  const { maxFileSize = DEFAULT_MAX_FILE_SIZE } = options;
  const validFiles: AttachedFile[] = [];
  const errors: string[] = [];

  files.forEach((file) => {
    const validation = validateFile(file, maxFileSize);

    if (validation.isValid) {
      validFiles.push(fileToAttachedFile(file));
    } else if (validation.error) {
      errors.push(validation.error);
    }
  });

  return { validFiles, errors };
}

/**
 * Formats file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

/**
 * Checks if a file is an image
 */
export function isImageFile(file: File | AttachedFile): boolean {
  const imageTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];
  return imageTypes.includes(file.type);
}

/**
 * Checks if a file type is supported
 */
export function isSupportedFileType(
  fileName: string,
  allowedExtensions?: string[]
): boolean {
  if (!allowedExtensions || allowedExtensions.length === 0) {
    return true;
  }

  const ext = getFileExtension(fileName);
  return allowedExtensions.includes(ext);
}

/**
 * Revokes object URLs for attached files to prevent memory leaks
 */
export function revokeFileUrls(files: AttachedFile[]): void {
  files.forEach((file) => {
    if (file.url?.startsWith("blob:")) {
      URL.revokeObjectURL(file.url);
    }
  });
}

/**
 * Creates a FileList from an array of Files
 * Useful for simulating file input changes
 */
export function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  return dataTransfer.files;
}
