import { useCallback } from "react";
import { toast } from "sonner";
import type { AttachedFile } from "@/lib/file-processing";

export interface ClipboardPasteOptions {
  maxFileSize?: number;
  onFilesPasted: (files: AttachedFile[]) => void;
  existingFiles?: AttachedFile[];
}

export interface ClipboardPasteResult {
  files: File[];
  hasText: boolean;
  textContent: string;
}

/**
 * Extracts files from clipboard data
 */
function extractFilesFromClipboard(clipboardData: DataTransfer): File[] {
  const files: File[] = [];
  const items = clipboardData.items;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }
  }

  return files;
}

/**
 * Checks if clipboard contains text content
 */
function getTextContent(clipboardData: DataTransfer): string {
  return clipboardData.getData("text/plain") || "";
}

/**
 * Creates AttachedFile objects from File objects
 */
function createAttachedFiles(
  files: File[],
  maxFileSize: number,
  _existingFiles: AttachedFile[]
): { validFiles: AttachedFile[]; errors: string[] } {
  const validFiles: AttachedFile[] = [];
  const errors: string[] = [];

  files.forEach((file) => {
    if (file.size > maxFileSize) {
      errors.push(`File "${file.name}" exceeds the size limit.`);
    } else {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).slice(2, 11);

      validFiles.push({
        id: `file-${timestamp}-${randomId}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        file,
      });
    }
  });

  return { validFiles, errors };
}

/**
 * Hook for handling clipboard paste events with file support
 *
 * @param options - Configuration options for paste handling
 * @returns Object with paste handler function
 *
 * @example
 * ```tsx
 * const { handlePaste } = useClipboardPaste({
 *     maxFileSize: 100 * 1024 * 1024,
 *     onFilesPasted: (files) => setAttachedFiles(prev => [...prev, ...files]),
 *     existingFiles: attachedFiles,
 * });
 *
 * <textarea onPaste={handlePaste} />
 * ```
 */
export function useClipboardPaste(options: ClipboardPasteOptions) {
  const {
    maxFileSize = 100 * 1024 * 1024,
    onFilesPasted,
    existingFiles = [],
  } = options;

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLElement>) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const pastedFiles = extractFilesFromClipboard(clipboardData);
      const _textContent = getTextContent(clipboardData);

      // If there are files in the clipboard, handle them
      if (pastedFiles.length > 0) {
        event.preventDefault();

        const { validFiles, errors } = createAttachedFiles(
          pastedFiles,
          maxFileSize,
          existingFiles
        );

        // Show error messages
        errors.forEach((error) => {
          toast.error(error);
        });

        // Add valid files to the list
        if (validFiles.length > 0) {
          const updatedFiles = [...existingFiles, ...validFiles];
          onFilesPasted(updatedFiles);

          const fileCount = validFiles.length;
          toast.success(
            `Attached ${fileCount} file${fileCount > 1 ? "s" : ""} from clipboard`
          );
        }

        return;
      }

      // If no files but has text, let the default paste behavior handle it
      // This allows normal text pasting to work as expected
    },
    [maxFileSize, onFilesPasted, existingFiles]
  );

  return { handlePaste };
}

/**
 * Standalone function to check if clipboard contains files
 * Useful for showing UI indicators before paste
 */
export function clipboardContainsFiles(
  clipboardData: DataTransfer | null
): boolean {
  if (!clipboardData) {
    return false;
  }

  const items = clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === "file") {
      return true;
    }
  }
  return false;
}

/**
 * Gets file count from clipboard
 */
export function getClipboardFileCount(
  clipboardData: DataTransfer | null
): number {
  if (!clipboardData) {
    return 0;
  }

  let count = 0;
  const items = clipboardData.items;

  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === "file") {
      count++;
    }
  }

  return count;
}
