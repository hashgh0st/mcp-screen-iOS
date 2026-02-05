/**
 * Utility functions for executing shell commands
 */

import { execSync, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Execute a command synchronously and return the output
 */
export function execCommand(command: string): string {
  try {
    return execSync(command, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
    }).trim();
  } catch (error) {
    if (error instanceof Error && "stderr" in error) {
      throw new Error(`Command failed: ${command}\n${(error as { stderr: string }).stderr}`);
    }
    throw error;
  }
}

/**
 * Execute a command asynchronously
 */
export async function execCommandAsync(
  command: string,
  options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  const result = await execAsync(command, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: options?.timeout,
  });
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

/**
 * Check if a command exists
 */
export function commandExists(command: string): boolean {
  if (!/^[a-zA-Z0-9_-]+$/.test(command)) {
    return false;
  }
  try {
    execSync(`which ${command}`, { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute xcrun simctl command
 */
export function simctl(args: string): string {
  return execCommand(`xcrun simctl ${args}`);
}

/**
 * Execute xcrun simctl command asynchronously
 */
export async function simctlAsync(
  args: string,
  options?: { timeout?: number }
): Promise<string> {
  const result = await execCommandAsync(`xcrun simctl ${args}`, options);
  return result.stdout;
}

/**
 * Parse JSON output from simctl
 */
export function parseSimctlJson<T>(args: string): T {
  const output = simctl(`${args} --json`);
  return JSON.parse(output) as T;
}
