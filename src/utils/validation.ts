/**
 * Input validation utilities for safe command execution
 */

import { resolve } from "path";

/**
 * Validate hex color format (#RRGGBB or RRGGBB)
 */
export function isValidHexColor(color: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Sanitize hex color for shell commands (remove # prefix)
 * Throws if color format is invalid
 */
export function sanitizeHexColor(color: string): string {
  if (!isValidHexColor(color)) {
    throw new Error(`Invalid hex color format: ${color}. Expected #RRGGBB or RRGGBB.`);
  }
  return color.replace("#", "");
}

/**
 * Validate path doesn't contain injection attempts
 * Optionally checks path is within an allowed base directory
 */
export function validatePath(inputPath: string, allowedBase?: string): string {
  const resolved = resolve(inputPath);

  // Check for null bytes (path injection)
  if (resolved.includes("\0")) {
    throw new Error("Invalid path: contains null bytes");
  }

  // If allowedBase provided, ensure path is within it
  if (allowedBase) {
    const resolvedBase = resolve(allowedBase);
    if (!resolved.startsWith(resolvedBase)) {
      throw new Error(`Path escapes allowed directory: ${resolved}`);
    }
  }

  return resolved;
}

/**
 * Resolve simulator target (UDID or "booted") and validate format.
 * Returns a shell-safe target string.
 */
export function resolveTarget(udid?: string): string {
  const target = udid || "booted";
  if (target !== "booted" && !/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(target)) {
    throw new Error(`Invalid simulator UDID format: ${target}`);
  }
  return target;
}

/**
 * Escape string for shell commands using single quotes
 */
export function shellEscape(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Escape string for AppleScript (backslashes first, then quotes)
 */
export function escapeForAppleScript(text: string): string {
  return text
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/"/g, '\\"');   // Then escape quotes
}
