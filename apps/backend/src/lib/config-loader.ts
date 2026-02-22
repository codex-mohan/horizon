/**
 * Horizon Configuration Loader
 *
 * Implements XDG-style configuration lookup with the following priority:
 * 1. HORIZON_CONFIG environment variable (explicit path)
 * 2. Monorepo config directory: config/horizon.json (for development)
 * 3. Current working directory: ./horizon.json
 * 4. Parent directories (walking up): .horizon/config.json or horizon.json
 * 5. User home directory: ~/.horizon/config.json or ~/.config/horizon/config.json
 * 6. System-wide: /etc/horizon/config.json (Unix) or %APPDATA%/horizon/config.json (Windows)
 * 7. Auto-create from config/horizon.example.json if available
 * 8. Default fallback values
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { z } from "zod";

/**
 * Workspace configuration schema
 */
export const WorkspaceConfigSchema = z.object({
  defaultPath: z.string().nullable().default(null),
  allowOverride: z.boolean().default(true),
  restrictedPaths: z.array(z.string()).default([]),
  allowedExtensions: z.array(z.string()).default([]),
});

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = z.object({
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(300000).default(30000),
});

/**
 * Full Horizon configuration schema
 */
export const HorizonConfigSchema = z.object({
  workspace: WorkspaceConfigSchema.default({}),
  agent: AgentConfigSchema.default({}),
});

export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
export type AgentConfigFile = z.infer<typeof AgentConfigSchema>;
export type HorizonConfig = z.infer<typeof HorizonConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: HorizonConfig = {
  workspace: {
    defaultPath: null,
    allowOverride: true,
    restrictedPaths: [],
    allowedExtensions: [],
  },
  agent: {
    maxRetries: 3,
    timeout: 30000,
  },
};

/**
 * Configuration file names to look for
 */
const CONFIG_FILENAMES = ["horizon.json", ".horizon.json"];

/**
 * Configuration directory names to look for
 */
const CONFIG_DIRNAMES = [".horizon", ".config/horizon"];

/**
 * Monorepo root markers
 */
const MONOREPO_MARKERS = ["pnpm-workspace.yaml", "turbo.json", "lerna.json"];

/**
 * Find monorepo root directory by looking for marker files
 */
function findMonorepoRoot(startDir: string): string | null {
  let currentDir = startDir;
  const root = parse(currentDir).root;

  while (currentDir !== root) {
    for (const marker of MONOREPO_MARKERS) {
      const markerPath = join(currentDir, marker);
      if (existsSync(markerPath)) {
        return currentDir;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Get monorepo config path (config/horizon.json)
 */
function getMonorepoConfigPath(): string | null {
  const cwd = process.cwd();
  const monorepoRoot = findMonorepoRoot(cwd);

  if (monorepoRoot) {
    const configPath = join(monorepoRoot, "config", "horizon.json");
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * Get example config path in monorepo
 */
function getMonorepoExampleConfigPath(): string | null {
  const cwd = process.cwd();
  const monorepoRoot = findMonorepoRoot(cwd);

  if (monorepoRoot) {
    const examplePath = join(monorepoRoot, "config", "horizon.example.json");
    if (existsSync(examplePath)) {
      return examplePath;
    }
  }

  return null;
}

/**
 * Find configuration file by walking up directories
 */
function findConfigInParentDirs(startDir: string): string | null {
  let currentDir = startDir;
  const root = parse(currentDir).root;

  while (currentDir !== root) {
    // Check for config files in current directory
    for (const filename of CONFIG_FILENAMES) {
      const configPath = join(currentDir, filename);
      if (existsSync(configPath)) {
        return configPath;
      }
    }

    // Check for config in config directories
    for (const dirname of CONFIG_DIRNAMES) {
      const configPath = join(currentDir, dirname, "config.json");
      if (existsSync(configPath)) {
        return configPath;
      }
    }

    // Move to parent directory
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Get user-level config path
 */
function getUserConfigPath(): string | null {
  const home = homedir();

  // Check ~/.horizon/config.json
  const horizonConfig = join(home, ".horizon", "config.json");
  if (existsSync(horizonConfig)) {
    return horizonConfig;
  }

  // Check ~/.config/horizon/config.json (XDG style)
  const xdgConfig = join(home, ".config", "horizon", "config.json");
  if (existsSync(xdgConfig)) {
    return xdgConfig;
  }

  return null;
}

/**
 * Get system-wide config path
 */
function getSystemConfigPath(): string | null {
  // Unix: /etc/horizon/config.json
  if (process.platform !== "win32") {
    const etcConfig = "/etc/horizon/config.json";
    if (existsSync(etcConfig)) {
      return etcConfig;
    }
  }

  // Windows: %APPDATA%/horizon/config.json
  if (process.platform === "win32" && process.env.APPDATA) {
    const appDataConfig = join(process.env.APPDATA, "horizon", "config.json");
    if (existsSync(appDataConfig)) {
      return appDataConfig;
    }
  }

  return null;
}

/**
 * Load and parse configuration file
 */
function loadConfigFile(configPath: string): HorizonConfig | null {
  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    const result = HorizonConfigSchema.safeParse(parsed);

    if (!result.success) {
      console.error(`[Config] Invalid config at ${configPath}:`, result.error.issues);
      return null;
    }

    console.log(`[Config] Loaded configuration from: ${configPath}`);
    return result.data;
  } catch (error) {
    console.error(`[Config] Error loading ${configPath}:`, error);
    return null;
  }
}

/**
 * Create config file from example
 */
function createConfigFromExample(targetPath: string): HorizonConfig | null {
  const examplePath = getMonorepoExampleConfigPath();

  if (!examplePath) {
    return null;
  }

  try {
    // Ensure target directory exists
    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Copy example to target
    copyFileSync(examplePath, targetPath);
    console.log(`[Config] Created configuration from example: ${targetPath}`);

    // Load and return the newly created config
    return loadConfigFile(targetPath);
  } catch (error) {
    console.error(`[Config] Failed to create config from example:`, error);
    return null;
  }
}

/**
 * Resolve workspace path with fallback chain
 */
export function resolveWorkspacePath(config: HorizonConfig): string {
  // 1. Check WORKSPACE_PATH environment variable
  if (process.env.WORKSPACE_PATH) {
    const workspacePath = resolve(process.env.WORKSPACE_PATH);
    console.log(`[Config] Using WORKSPACE_PATH: ${workspacePath}`);
    return workspacePath;
  }

  // 2. Check config file defaultPath
  if (config.workspace.defaultPath) {
    const workspacePath = resolve(config.workspace.defaultPath);
    console.log(`[Config] Using configured workspace: ${workspacePath}`);
    return workspacePath;
  }

  // 3. Fallback to current working directory
  const cwd = process.cwd();
  console.log(`[Config] Using current directory as workspace: ${cwd}`);
  return cwd;
}

/**
 * Find and load Horizon configuration
 *
 * Priority order:
 * 1. HORIZON_CONFIG environment variable (explicit path)
 * 2. Monorepo config directory: config/horizon.json (for development)
 * 3. Current working directory: ./horizon.json
 * 4. Parent directories (walking up): .horizon/config.json or horizon.json
 * 5. User home directory: ~/.horizon/config.json or ~/.config/horizon/config.json
 * 6. System-wide: /etc/horizon/config.json (Unix) or %APPDATA%/horizon/config.json (Windows)
 * 7. Auto-create from config/horizon.example.json
 * 8. Default fallback values
 */
export function loadHorizonConfig(): HorizonConfig {
  // 1. Check HORIZON_CONFIG environment variable
  if (process.env.HORIZON_CONFIG) {
    const configPath = resolve(process.env.HORIZON_CONFIG);
    if (existsSync(configPath)) {
      const config = loadConfigFile(configPath);
      if (config) {
        return config;
      }
    }
    console.warn(`[Config] HORIZON_CONFIG path does not exist: ${configPath}`);
  }

  // 2. Check monorepo config directory (for development)
  const monorepoConfigPath = getMonorepoConfigPath();
  if (monorepoConfigPath) {
    const config = loadConfigFile(monorepoConfigPath);
    if (config) {
      return config;
    }
  }

  // 3. Check current working directory
  const cwd = process.cwd();
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(cwd, filename);
    if (existsSync(configPath)) {
      const config = loadConfigFile(configPath);
      if (config) {
        return config;
      }
    }
  }

  // 4. Walk up parent directories
  const parentConfigPath = findConfigInParentDirs(dirname(cwd));
  if (parentConfigPath) {
    const config = loadConfigFile(parentConfigPath);
    if (config) {
      return config;
    }
  }

  // 5. Check user home directory
  const userConfigPath = getUserConfigPath();
  if (userConfigPath) {
    const config = loadConfigFile(userConfigPath);
    if (config) {
      return config;
    }
  }

  // 6. Check system-wide config
  const systemConfigPath = getSystemConfigPath();
  if (systemConfigPath) {
    const config = loadConfigFile(systemConfigPath);
    if (config) {
      return config;
    }
  }

  // 7. Auto-create from example (for development)
  const monorepoRoot = findMonorepoRoot(cwd);
  if (monorepoRoot) {
    const targetPath = join(monorepoRoot, "config", "horizon.json");
    const config = createConfigFromExample(targetPath);
    if (config) {
      return config;
    }
  }

  // 8. No config found, use defaults
  console.log("[Config] No configuration file found, using defaults");
  return DEFAULT_CONFIG;
}

/**
 * Global cached configuration instance
 */
let _cachedConfig: HorizonConfig | null = null;

/**
 * Get the global configuration instance (cached)
 */
export function getHorizonConfig(): HorizonConfig {
  if (!_cachedConfig) {
    _cachedConfig = loadHorizonConfig();
  }
  return _cachedConfig;
}

/**
 * Reset the cached configuration (useful for testing)
 */
export function resetConfigCache(): void {
  _cachedConfig = null;
}
