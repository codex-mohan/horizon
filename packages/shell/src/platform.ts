/**
 * Platform detection and cross-platform utilities
 */

export interface PlatformInfo {
    os: "windows" | "macos" | "linux" | "unknown";
    arch: "x64" | "arm64" | "arm" | "unknown";
    shell: string;
    homeDir: string;
    tempDir: string;
    pathSeparator: string;
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
}

/**
 * Detect the current operating system
 */
export function detectOS(): PlatformInfo["os"] {
    const platform = process.platform;

    switch (platform) {
        case "win32":
            return "windows";
        case "darwin":
            return "macos";
        case "linux":
            return "linux";
        default:
            return "unknown";
    }
}

/**
 * Get comprehensive platform information
 */
export function getPlatformInfo(): PlatformInfo {
    const os = detectOS();
    const arch = process.arch as PlatformInfo["arch"];

    let shell: string;
    let pathSeparator: string;

    if (os === "windows") {
        shell = process.env.COMSPEC || "cmd.exe";
        pathSeparator = "\\";
    } else {
        shell = process.env.SHELL || "/bin/sh";
        pathSeparator = "/";
    }

    return {
        os,
        arch: ["x64", "arm64", "arm"].includes(arch) ? arch : "unknown",
        shell,
        homeDir: process.env.HOME || process.env.USERPROFILE || "",
        tempDir: process.env.TMPDIR || process.env.TEMP || "/tmp",
        pathSeparator,
        isWindows: os === "windows",
        isMac: os === "macos",
        isLinux: os === "linux",
    };
}

/**
 * Convert a path to the current platform's format
 */
export function normalizePath(path: string): string {
    const info = getPlatformInfo();

    if (info.isWindows) {
        return path.replace(/\//g, "\\");
    } else {
        return path.replace(/\\/g, "/");
    }
}

/**
 * Join paths using the platform-appropriate separator
 */
export function joinPaths(...parts: string[]): string {
    const info = getPlatformInfo();
    return parts.join(info.pathSeparator);
}
