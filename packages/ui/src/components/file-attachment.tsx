"use client"

import { useState } from "react"
import {
  FileText,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  File,
  X,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export interface FileAttachmentProps {
  /** The file object containing id, name, type, and url */
  file: {
    id: string
    name: string
    type: string
    url: string
    size?: number
  }
  /** Optional file size override (for display, falls back to file.size) */
  size?: number
  /** Callback when remove button is clicked */
  onRemove?: () => void
  /** Whether the file is currently uploading */
  isUploading?: boolean
  /** Optional custom className */
  className?: string
  /** Whether this is shown in a message bubble vs input area */
  variant?: "bubble" | "input"
  /** Click handler for the file */
  onClick?: () => void
}

/**
 * Get file type icon based on MIME type or file extension
 */
function getFileTypeIcon(type: string, fileName: string) {
  // Image preview takes priority - this function is for non-image files
  if (type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName)) {
    return <FileImage className="size-5 text-emerald-500" />
  }

  if (type === "application/pdf" || fileName.endsWith(".pdf")) {
    return <FileText className="size-5 text-red-500" />
  }

  // Documents
  if (
    type.includes("document") ||
    type.includes("word") ||
    type.includes("text/") ||
    /\.(doc|docx|txt|rtf|odt)$/i.test(fileName)
  ) {
    return <FileText className="size-5 text-blue-500" />
  }

  // Spreadsheets
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    /\.(xls|xlsx|csv)$/i.test(fileName)
  ) {
    return <FileSpreadsheet className="size-5 text-green-500" />
  }

  // Code files - by extension
  if (/\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(fileName)) {
    return <FileCode className="size-5 text-yellow-500" />
  }
  if (/\.(py|pyw)$/i.test(fileName)) {
    return <FileCode className="size-5 text-blue-400" />
  }
  if (/\.(java|class)$/i.test(fileName)) {
    return <FileCode className="size-5 text-orange-500" />
  }
  if (/\.(c|cpp|h|hpp|cxx|hxx)$/i.test(fileName)) {
    return <FileCode className="size-5 text-blue-600" />
  }
  if (/\.(rs|rlib)$/i.test(fileName)) {
    return <FileCode className="size-5 text-orange-700" />
  }
  if (/\.(go|mod|sum)$/i.test(fileName)) {
    return <FileCode className="size-5 text-cyan-400" />
  }
  if (/\.(rb|gemspec)$/i.test(fileName)) {
    return <FileCode className="size-5 text-red-500" />
  }
  if (/\.(php|phtml|php3|php4|php5)$/i.test(fileName)) {
    return <FileCode className="size-5 text-purple-500" />
  }
  if (/\.(swift)$/i.test(fileName)) {
    return <FileCode className="size-5 text-orange-400" />
  }
  if (/\.(kt|kts)$/i.test(fileName)) {
    return <FileCode className="size-5 text-violet-400" />
  }
  if (/\.(cs|csx|sln|csproj)$/i.test(fileName)) {
    return <FileCode className="size-5 text-green-500" />
  }
  if (/\.(scala|sc)$/i.test(fileName)) {
    return <FileCode className="size-5 text-red-600" />
  }
  if (/\.(lua)$/i.test(fileName)) {
    return <FileCode className="size-5 text-blue-500" />
  }
  if (/\.(r|R|Rmd)$/i.test(fileName)) {
    return <FileCode className="size-5 text-blue-400" />
  }
  if (/\.(jl)$/i.test(fileName)) {
    return <FileCode className="size-5 text-purple-600" />
  }
  if (/\.(elm)$/i.test(fileName)) {
    return <FileCode className="size-5 text-cyan-600" />
  }
  if (/\.(ex|exs)$/i.test(fileName)) {
    return <FileCode className="size-5 text-purple-600" />
  }
  if (/\.(hs|lhs)$/i.test(fileName)) {
    return <FileCode className="size-5 text-purple-500" />
  }
  if (/\.(ml|mli)$/i.test(fileName)) {
    return <FileCode className="size-5 text-orange-400" />
  }
  if (/\.(clj|cljs|cljc|edn)$/i.test(fileName)) {
    return <FileCode className="size-5 text-green-500" />
  }
  if (/\.(zig)$/i.test(fileName)) {
    return <FileCode className="size-5 text-yellow-600" />
  }
  if (/\.(nim)$/i.test(fileName)) {
    return <FileCode className="size-5 text-yellow-500" />
  }
  if (/\.(dart)$/i.test(fileName)) {
    return <FileCode className="size-5 text-cyan-500" />
  }
  if (/\.(sql)$/i.test(fileName)) {
    return <FileCode className="size-5 text-yellow-600" />
  }
  if (/\.(sh|bash|zsh|fish)$/i.test(fileName)) {
    return <FileCode className="size-5 text-gray-400" />
  }
  if (/\.(toml|ini|cfg|conf|config|yaml|yml|json)$/i.test(fileName)) {
    return <FileJson className="size-5 text-gray-400" />
  }
  if (/\.(html|css|scss|sass|less|styl)$/i.test(fileName)) {
    return <FileCode className="size-5 text-pink-500" />
  }
  if (/\.(vue|svelte)$/i.test(fileName)) {
    return <FileCode className="size-5 text-green-500" />
  }

  // Audio
  if (type.startsWith("audio/") || /\.(mp3|wav|ogg|flac|aac|m4a|wma|aiff)$/i.test(fileName)) {
    return <FileAudio className="size-5 text-purple-500" />
  }

  // Video
  if (type.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv|wmv|flv|m4v)$/i.test(fileName)) {
    return <FileVideo className="size-5 text-pink-500" />
  }

  // Archives
  if (
    type.includes("zip") ||
    type.includes("rar") ||
    type.includes("tar") ||
    type.includes("gzip") ||
    /\.(zip|rar|tar|gz|bz2|7z|xz)$/i.test(fileName)
  ) {
    return <FileArchive className="size-5 text-amber-500" />
  }

  return <File className="size-5 text-gray-400" />
}

/**
 * Get file extension from filename
 */
function getFileExtension(fileName: string): string {
  const parts = fileName.split(".")
  return parts.length > 1 ? parts.pop()?.toUpperCase() || "" : ""
}

/**
 * Format file size to human readable string
 */
function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return ""

  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Check if file is an image
 */
function isImageFile(type: string, fileName: string): boolean {
  return (
    type.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif|tiff|tif|webp)$/i.test(fileName)
  )
}

/**
 * FileAttachment Component
 *
 * Displays file attachments with:
 * - Image preview for image files
 * - File type icons for other file types
 * - File name as main label
 * - File type/extension as sub-label
 * - File size in corner
 */
export function FileAttachment({
  file,
  size: propSize,
  onRemove,
  isUploading,
  className,
  variant = "input",
  onClick,
}: FileAttachmentProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  const isImage = isImageFile(file.type, file.name)
  const fileExtension = getFileExtension(file.name)
  const fileSize = propSize ?? file.size

  const handleImageLoad = () => {
    setImageLoading(false)
  }

  const handleImageError = () => {
    setImageError(true)
    setImageLoading(false)
  }

  // Input variant - compact row style
  if (variant === "input") {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-2",
          "hover:bg-background/80 transition-colors cursor-pointer w-64 shrink-0",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
      >
        {/* Icon/Preview */}
        <div className="relative flex shrink-0 overflow-hidden rounded-md bg-muted/50">
          {isImage && !imageError ? (
            <div className="relative w-10 h-10">
              <img
                src={file.url}
                alt={file.name}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300 absolute inset-0",
                  imageLoading ? "opacity-0" : "opacity-100"
                )}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex w-10 h-10 items-center justify-center bg-muted/50 text-muted-foreground">
              {getFileTypeIcon(file.type, file.name)}
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex flex-col min-w-0 flex-1 justify-center overflow-hidden">
          <span className="text-sm font-medium truncate text-foreground" title={file.name}>
            {file.name}
          </span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {fileExtension && (
              <span className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px] font-medium shrink-0">
                {fileExtension}
              </span>
            )}
            {fileSize && <span className="shrink-0">{formatFileSize(fileSize)}</span>}
          </div>
        </div>

        {/* Remove Button */}
        {onRemove && (
          <button
            className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <X className="size-4 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>
    )
  }

  // Bubble variant - card style for message attachments (smaller)
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border/50 bg-muted/30",
        "w-48 shrink-0 transition-all hover:bg-muted/50",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Preview Area */}
      <div className="relative h-24 overflow-hidden bg-muted/50">
        {isImage && !imageError ? (
            <>
              <img
                src={file.url}
                alt={file.name}
                className={cn(
                  "w-full h-full object-cover transition-all duration-500 absolute inset-0",
                  imageLoading ? "scale-95 opacity-0 blur-2xl" : "scale-100 opacity-100 blur-0"
                )}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </>
          ) : (
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <div className={cn(
              "p-2 rounded-lg",
              // PDF - Red gradient
              (file.type === "application/pdf" || file.name.endsWith(".pdf")) && "bg-gradient-to-br from-red-500 to-red-600",
              // Word/Documents - Blue gradient
              (file.type.includes("document") || file.type.includes("word") || /\.(doc|docx|txt|rtf|odt)$/i.test(file.name)) && "bg-gradient-to-br from-blue-500 to-blue-600",
              // Excel/Spreadsheets - Green gradient
              (file.type.includes("spreadsheet") || file.type.includes("excel") || /\.(xls|xlsx|csv)$/i.test(file.name)) && "bg-gradient-to-br from-green-500 to-green-600",
              // Code files - language specific colors
              /\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(file.name) && "bg-gradient-to-br from-yellow-400 to-yellow-500",
              /\.(py|pyw)$/i.test(file.name) && "bg-gradient-to-br from-blue-400 to-blue-500",
              /\.(java|class)$/i.test(file.name) && "bg-gradient-to-br from-orange-500 to-orange-600",
              /\.(c|cpp|h|hpp|cxx|hxx)$/i.test(file.name) && "bg-gradient-to-br from-blue-600 to-blue-700",
              /\.(rs|rlib)$/i.test(file.name) && "bg-gradient-to-br from-orange-600 to-orange-700",
              /\.(go|mod|sum)$/i.test(file.name) && "bg-gradient-to-br from-cyan-400 to-cyan-500",
              /\.(rb|gemspec)$/i.test(file.name) && "bg-gradient-to-br from-red-500 to-red-600",
              /\.(php|phtml|php3|php4|php5)$/i.test(file.name) && "bg-gradient-to-br from-purple-500 to-purple-600",
              /\.(swift)$/i.test(file.name) && "bg-gradient-to-br from-orange-400 to-orange-500",
              /\.(kt|kts)$/i.test(file.name) && "bg-gradient-to-br from-violet-400 to-violet-500",
              /\.(cs|csx|sln|csproj)$/i.test(file.name) && "bg-gradient-to-br from-green-500 to-green-600",
              /\.(scala|sc)$/i.test(file.name) && "bg-gradient-to-br from-red-600 to-red-700",
              /\.(lua)$/i.test(file.name) && "bg-gradient-to-br from-blue-500 to-blue-600",
              /\.(r|R|Rmd)$/i.test(file.name) && "bg-gradient-to-br from-blue-400 to-blue-500",
              /\.(jl)$/i.test(file.name) && "bg-gradient-to-br from-purple-600 to-purple-700",
              /\.(elm)$/i.test(file.name) && "bg-gradient-to-br from-cyan-500 to-cyan-600",
              /\.(ex|exs)$/i.test(file.name) && "bg-gradient-to-br from-purple-600 to-purple-700",
              /\.(hs|lhs)$/i.test(file.name) && "bg-gradient-to-br from-purple-500 to-purple-600",
              /\.(ml|mli)$/i.test(file.name) && "bg-gradient-to-br from-orange-400 to-orange-500",
              /\.(clj|cljs|cljc|edn)$/i.test(file.name) && "bg-gradient-to-br from-green-500 to-green-600",
              /\.(zig)$/i.test(file.name) && "bg-gradient-to-br from-yellow-500 to-yellow-600",
              /\.(nim)$/i.test(file.name) && "bg-gradient-to-br from-yellow-500 to-yellow-600",
              /\.(dart)$/i.test(file.name) && "bg-gradient-to-br from-cyan-500 to-cyan-600",
              /\.(sql)$/i.test(file.name) && "bg-gradient-to-br from-yellow-600 to-yellow-700",
              /\.(sh|bash|zsh|fish)$/i.test(file.name) && "bg-gradient-to-br from-gray-400 to-gray-500",
              /\.(toml|ini|cfg|conf|config|yaml|yml|json)$/i.test(file.name) && "bg-gradient-to-br from-gray-400 to-gray-500",
              /\.(html|css|scss|sass|less|styl)$/i.test(file.name) && "bg-gradient-to-br from-pink-500 to-pink-600",
              /\.(vue|svelte)$/i.test(file.name) && "bg-gradient-to-br from-green-500 to-green-600",
              // Audio - Purple gradient
              (file.type.startsWith("audio") || /\.(mp3|wav|ogg|flac|aac|m4a|wma|aiff)$/i.test(file.name)) && "bg-gradient-to-br from-purple-500 to-purple-600",
              // Video - Pink gradient
              (file.type.startsWith("video") || /\.(mp4|webm|mov|avi|mkv|wmv|flv|m4v)$/i.test(file.name)) && "bg-gradient-to-br from-pink-500 to-pink-600",
              // Archives - Amber gradient
              (file.type.includes("zip") || file.type.includes("rar") || file.type.includes("tar") || file.type.includes("gzip") || /\.(zip|rar|tar|gz|bz2|7z|xz)$/i.test(file.name)) && "bg-gradient-to-br from-amber-500 to-amber-600",
              // Default - Gray gradient
              "bg-gradient-to-br from-gray-400 to-gray-500"
            )}>
              {isImage && imageError ? (
                <FileImage className="size-5 text-emerald-500" />
              ) : (
                getFileTypeIcon(file.type, file.name)
              )}
            </div>
          </div>
        )}

        {/* File Size Badge */}
        {fileSize && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-medium backdrop-blur-sm">
            {formatFileSize(fileSize)}
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="p-2 flex flex-col gap-0.5">
        <span className="font-medium text-xs truncate text-foreground" title={file.name}>
          {file.name}
        </span>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="capitalize">{fileExtension || "File"}</span>
          {fileSize && <span>{formatFileSize(fileSize)}</span>}
        </div>
      </div>
    </div>
  )
}
