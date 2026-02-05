/**
 * App management tools
 */

import { z } from "zod";
import { existsSync } from "fs";
import { resolve } from "path";
import { simctl } from "../../utils/exec.js";
import { shellEscape, validatePath, resolveTarget } from "../../utils/validation.js";
import { ToolResult } from "../../types/index.js";

/**
 * Input schemas for app tools
 */
export const installAppSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  appPath: z
    .string()
    .describe("Path to the .app bundle to install"),
});

export const launchAppSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier (e.g., com.company.appname)"),
  waitForDebugger: z
    .boolean()
    .optional()
    .default(false)
    .describe("Wait for a debugger to attach before launching"),
});

export const terminateAppSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier to terminate"),
});

export const uninstallAppSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier to uninstall"),
});

export const openUrlSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  url: z
    .string()
    .describe("URL or deep link to open (e.g., https://... or myapp://...)"),
});

export const listAppsSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const getAppContainerSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier"),
  container: z
    .enum(["app", "data", "groups"])
    .optional()
    .default("data")
    .describe("Container type to get path for"),
});

/**
 * Install an app on the simulator
 */
export async function installApp(
  input: z.infer<typeof installAppSchema>
): Promise<ToolResult> {
  const { udid, appPath } = input;
  const target = resolveTarget(udid);
  const fullPath = validatePath(appPath);

  if (!existsSync(fullPath)) {
    return {
      content: [
        {
          type: "text",
          text: `App bundle not found: ${fullPath}`,
        },
      ],
      isError: true,
    };
  }

  if (!fullPath.endsWith(".app")) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid app bundle: ${fullPath}. Path must end with .app`,
        },
      ],
      isError: true,
    };
  }

  try {
    simctl(`install ${target} ${shellEscape(fullPath)}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "App installed successfully",
              appPath: fullPath,
              simulator: target,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to install app: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Launch an app on the simulator
 */
export async function launchApp(
  input: z.infer<typeof launchAppSchema>
): Promise<ToolResult> {
  const { udid, bundleId, waitForDebugger } = input;
  const target = resolveTarget(udid);

  try {
    const args = waitForDebugger ? "--wait-for-debugger" : "";
    const output = simctl(`launch ${args} ${target} ${shellEscape(bundleId)}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "App launched successfully",
              bundleId,
              simulator: target,
              pid: output.trim() || undefined,
              waitingForDebugger: waitForDebugger,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to launch app: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Terminate a running app
 */
export async function terminateApp(
  input: z.infer<typeof terminateAppSchema>
): Promise<ToolResult> {
  const { udid, bundleId } = input;
  const target = resolveTarget(udid);

  try {
    simctl(`terminate ${target} ${shellEscape(bundleId)}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "App terminated successfully",
              bundleId,
              simulator: target,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to terminate app: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Uninstall an app from the simulator
 */
export async function uninstallApp(
  input: z.infer<typeof uninstallAppSchema>
): Promise<ToolResult> {
  const { udid, bundleId } = input;
  const target = resolveTarget(udid);

  try {
    simctl(`uninstall ${target} ${shellEscape(bundleId)}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "App uninstalled successfully",
              bundleId,
              simulator: target,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to uninstall app: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Open a URL or deep link in the simulator
 */
export async function openUrl(
  input: z.infer<typeof openUrlSchema>
): Promise<ToolResult> {
  const { udid, url } = input;
  const target = resolveTarget(udid);

  try {
    simctl(`openurl ${target} ${shellEscape(url)}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "URL opened successfully",
              url,
              simulator: target,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to open URL: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * List installed apps on the simulator
 */
export async function listApps(
  input: z.infer<typeof listAppsSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = resolveTarget(udid);

  try {
    const output = simctl(`listapps ${target}`);
    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to list apps: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Get the container path for an app
 */
export async function getAppContainer(
  input: z.infer<typeof getAppContainerSchema>
): Promise<ToolResult> {
  const { udid, bundleId, container } = input;
  const target = resolveTarget(udid);

  try {
    const path = simctl(`get_app_container ${target} ${shellEscape(bundleId)} ${container}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              bundleId,
              container,
              path: path.trim(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to get app container: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool definitions for registration
 */
export const appTools = [
  {
    name: "install_app",
    title: "Install App",
    description:
      "Install an iOS app (.app bundle) on the simulator. The app must be built for the simulator architecture.",
    schema: installAppSchema,
    handler: installApp,
  },
  {
    name: "launch_app",
    title: "Launch App",
    description:
      "Launch an installed app by its bundle identifier. Optionally wait for a debugger to attach.",
    schema: launchAppSchema,
    handler: launchApp,
  },
  {
    name: "terminate_app",
    title: "Terminate App",
    description: "Terminate a running app by its bundle identifier.",
    schema: terminateAppSchema,
    handler: terminateApp,
  },
  {
    name: "uninstall_app",
    title: "Uninstall App",
    description: "Uninstall an app from the simulator by its bundle identifier.",
    schema: uninstallAppSchema,
    handler: uninstallApp,
  },
  {
    name: "open_url",
    title: "Open URL",
    description:
      "Open a URL or deep link in the simulator. Use this to navigate to specific screens via URL schemes (e.g., myapp://settings).",
    schema: openUrlSchema,
    handler: openUrl,
  },
  {
    name: "list_apps",
    title: "List Apps",
    description: "List all installed apps on the simulator with their bundle identifiers.",
    schema: listAppsSchema,
    handler: listApps,
  },
  {
    name: "get_app_container",
    title: "Get App Container",
    description:
      "Get the filesystem path to an app's container (app bundle, data, or groups) for debugging or file access.",
    schema: getAppContainerSchema,
    handler: getAppContainer,
  },
];
