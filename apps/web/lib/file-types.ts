
import {
    FileText,
    FileCode,
    FileImage,
    FileVideo,
    FileAudio,
    FileSpreadsheet,
    FileArchive,
    File,
    FileJson,
} from "lucide-react";

export type FileTypeConfig = {
    icon: typeof File;
    color: string;
    bgColor: string;
};

export const DEFAULT_FILE_TYPE: FileTypeConfig = {
    icon: File,
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
};

export const FILE_TYPE_MAP: Record<string, FileTypeConfig> = {
    // Documents
    pdf: { icon: FileText, color: "text-red-500", bgColor: "bg-red-500/10" },
    doc: { icon: FileText, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    docx: { icon: FileText, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    txt: { icon: FileText, color: "text-slate-500", bgColor: "bg-slate-500/10" },

    // Code
    js: { icon: FileCode, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    ts: { icon: FileCode, color: "text-blue-600", bgColor: "bg-blue-600/10" },
    tsx: { icon: FileCode, color: "text-blue-600", bgColor: "bg-blue-600/10" },
    jsx: { icon: FileCode, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    py: { icon: FileCode, color: "text-green-500", bgColor: "bg-green-500/10" },
    css: { icon: FileCode, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
    json: { icon: FileJson, color: "text-orange-500", bgColor: "bg-orange-500/10" },

    // Media
    png: { icon: FileImage, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    jpg: { icon: FileImage, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    jpeg: { icon: FileImage, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    gif: { icon: FileImage, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    svg: { icon: FileImage, color: "text-orange-600", bgColor: "bg-orange-600/10" },
    mp4: { icon: FileVideo, color: "text-pink-500", bgColor: "bg-pink-500/10" },
    webm: { icon: FileVideo, color: "text-pink-500", bgColor: "bg-pink-500/10" },
    mp3: { icon: FileAudio, color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
    wav: { icon: FileAudio, color: "text-indigo-500", bgColor: "bg-indigo-500/10" },

    // Data
    csv: { icon: FileSpreadsheet, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    xlsx: { icon: FileSpreadsheet, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },

    // Archive
    zip: { icon: FileArchive, color: "text-amber-500", bgColor: "bg-amber-500/10" },
    rar: { icon: FileArchive, color: "text-amber-500", bgColor: "bg-amber-500/10" },
};

export function getFileTypeConfig(fileName: string): FileTypeConfig {
    const ext = fileName.split(".").pop()?.toLowerCase();
    return (ext ? FILE_TYPE_MAP[ext] : undefined) || DEFAULT_FILE_TYPE;
}
