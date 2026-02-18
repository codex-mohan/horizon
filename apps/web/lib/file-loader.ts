/**
 * File Content Loader
 *
 * Extracts text content from various file types for AI processing.
 * Supports: PDF, Word (docx), Excel (xlsx), CSV, plain text, code files, images
 */

import mammoth from "mammoth";
import Papa from "papaparse";
import * as pdfjs from "pdfjs-dist";
import * as XLSX from "xlsx";

// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

export interface ExtractedContent {
  text: string;
  success: boolean;
  error?: string;
  metadata?: {
    pages?: number;
    sheets?: string[];
    rows?: number;
    columns?: number;
  };
}

/**
 * Extract text content from a PDF file
 */
async function extractPdfContent(file: File): Promise<ExtractedContent> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    return {
      text: fullText.trim(),
      success: true,
      metadata: { pages: numPages },
    };
  } catch (error) {
    return {
      text: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to extract PDF content",
    };
  }
}

/**
 * Extract text content from a Word document (docx)
 */
async function extractWordContent(file: File): Promise<ExtractedContent> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    return {
      text: result.value,
      success: true,
    };
  } catch (error) {
    return {
      text: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to extract Word content",
    };
  }
}

/**
 * Extract content from Excel file (xlsx, xls)
 */
async function extractExcelContent(file: File): Promise<ExtractedContent> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    let fullText = "";
    const sheetNames: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      sheetNames.push(sheetName);
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      fullText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
    }

    // Get dimensions of first sheet
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(firstSheet["!ref"] || "A1");

    return {
      text: fullText.trim(),
      success: true,
      metadata: {
        sheets: sheetNames,
        rows: range.e.r - range.s.r + 1,
        columns: range.e.c - range.s.c + 1,
      },
    };
  } catch (error) {
    return {
      text: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to extract Excel content",
    };
  }
}

/**
 * Extract content from CSV file
 */
async function extractCsvContent(file: File): Promise<ExtractedContent> {
  try {
    const text = await file.text();

    return new Promise((resolve) => {
      Papa.parse(text, {
        complete: (results) => {
          const formattedText = (results.data as string[][])
            .map((row) => row.join("\t"))
            .join("\n");

          resolve({
            text: formattedText,
            success: true,
            metadata: {
              rows: results.data.length,
              columns: (results.data[0] as string[])?.length || 0,
            },
          });
        },
        error: (error) => {
          resolve({
            text: "",
            success: false,
            error: error.message,
          });
        },
      });
    });
  } catch (error) {
    return {
      text: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to extract CSV content",
    };
  }
}

/**
 * Extract content from plain text or code files
 */
async function extractTextContent(file: File): Promise<ExtractedContent> {
  try {
    const text = await file.text();
    return {
      text,
      success: true,
    };
  } catch (error) {
    return {
      text: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to read text file",
    };
  }
}

/**
 * Extract image as base64 data URL
 */
async function extractImageContent(file: File): Promise<ExtractedContent> {
  try {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          text: `[Image: ${file.name}]`,
          success: true,
          metadata: {
            dataUrl: reader.result as string,
          },
        });
      };
      reader.onerror = () => {
        resolve({
          text: "",
          success: false,
          error: "Failed to read image file",
        });
      };
      reader.readAsDataURL(file);
    });
  } catch (error) {
    return {
      text: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to extract image content",
    };
  }
}

/**
 * Main function to extract content from any supported file type
 */
export async function extractFileContent(file: File): Promise<ExtractedContent> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const mimeType = file.type;

  // PDF files
  if (mimeType === "application/pdf" || extension === "pdf") {
    return extractPdfContent(file);
  }

  // Word documents
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    return extractWordContent(file);
  }

  // Excel files
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    ["xlsx", "xls"].includes(extension)
  ) {
    return extractExcelContent(file);
  }

  // CSV files
  if (mimeType === "text/csv" || extension === "csv") {
    return extractCsvContent(file);
  }

  // Image files
  if (mimeType.startsWith("image/")) {
    return extractImageContent(file);
  }

  // Text and code files
  const textExtensions = [
    "txt",
    "md",
    "markdown",
    "json",
    "xml",
    "yaml",
    "yml",
    "html",
    "css",
    "js",
    "jsx",
    "ts",
    "tsx",
    "py",
    "java",
    "c",
    "cpp",
    "h",
    "hpp",
    "cs",
    "go",
    "rs",
    "rb",
    "php",
    "swift",
    "kt",
    "scala",
    "sh",
    "bash",
    "zsh",
    "sql",
    "graphql",
    "env",
    "ini",
    "cfg",
    "conf",
    "log",
    "toml",
  ];

  if (mimeType.startsWith("text/") || textExtensions.includes(extension) || extension === "") {
    return extractTextContent(file);
  }

  // Unknown file type - try to read as text
  try {
    const text = await file.text();
    if (text) {
      return {
        text: `[Binary file content as text]\n${text}`,
        success: true,
      };
    }
  } catch {
    // Fall through to error
  }

  return {
    text: `[Unsupported file type: ${file.name}]`,
    success: false,
    error: `Unsupported file type: ${extension || "unknown"}`,
  };
}

/**
 * Get file type category for display
 */
export function getFileCategory(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const mimeType = file.type;

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
  if (extension === "docx" || extension === "doc") return "word";
  if (["xlsx", "xls"].includes(extension)) return "excel";
  if (extension === "csv") return "csv";

  const codeExtensions = [
    "js",
    "jsx",
    "ts",
    "tsx",
    "py",
    "java",
    "c",
    "cpp",
    "h",
    "hpp",
    "cs",
    "go",
    "rs",
    "rb",
    "php",
    "swift",
    "kt",
    "scala",
    "sh",
  ];
  if (codeExtensions.includes(extension)) return "code";

  return "document";
}
