/**
 * Accessibility inspection tools for iOS Simulator
 *
 * Tools for inspecting UI elements and accessibility hierarchy
 */

import { z } from "zod";
import { simctl, execCommand } from "../../utils/exec.js";
import { ToolResult } from "../../types/index.js";

/**
 * Input schemas for accessibility tools
 */
export const describeUiSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const describePointSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  x: z
    .number()
    .describe("X coordinate to inspect"),
  y: z
    .number()
    .describe("Y coordinate to inspect"),
});

export const findElementSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  label: z
    .string()
    .optional()
    .describe("Accessibility label to search for"),
  identifier: z
    .string()
    .optional()
    .describe("Accessibility identifier to search for"),
  type: z
    .string()
    .optional()
    .describe("Element type to search for (e.g., 'button', 'textField', 'cell')"),
});

export const getScreenInfoSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

/**
 * Describe the current UI hierarchy
 */
export async function describeUi(
  input: z.infer<typeof describeUiSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = udid || "booted";

  try {
    // Try simctl ui describe command (Xcode 15+)
    const output = simctl(`ui ${target} describe`);

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  } catch (error) {
    // Try alternative: use accessibility audit
    try {
      const altOutput = simctl(`ui ${target} accessibility`);
      return {
        content: [
          {
            type: "text",
            text: altOutput,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "UI description not available",
                details: error instanceof Error ? error.message : String(error),
                hint: "This feature requires Xcode 15+ with simctl ui support. Use capture_screenshot_inline and AI vision as an alternative.",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }
}

/**
 * Describe element at specific point
 */
export async function describePoint(
  input: z.infer<typeof describePointSchema>
): Promise<ToolResult> {
  const { udid, x, y } = input;
  const target = udid || "booted";

  try {
    // Try to get element info at point
    const output = simctl(`ui ${target} describe --point ${x},${y}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              point: { x, y },
              element: output.trim(),
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
          text: JSON.stringify(
            {
              error: "Could not describe element at point",
              point: { x, y },
              details: error instanceof Error ? error.message : String(error),
              hint: "Try using capture_screenshot_inline with AI vision to identify elements",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Find element by accessibility properties
 */
export async function findElement(
  input: z.infer<typeof findElementSchema>
): Promise<ToolResult> {
  const { udid, label, identifier, type } = input;
  const target = udid || "booted";

  if (!label && !identifier && !type) {
    return {
      content: [
        {
          type: "text",
          text: "At least one search parameter (label, identifier, or type) must be provided",
        },
      ],
      isError: true,
    };
  }

  try {
    // Build search criteria
    const criteria: string[] = [];
    if (label) criteria.push(`--label "${label}"`);
    if (identifier) criteria.push(`--identifier "${identifier}"`);
    if (type) criteria.push(`--type "${type}"`);

    // Try simctl ui find command
    const output = simctl(`ui ${target} find ${criteria.join(" ")}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              searchCriteria: { label, identifier, type },
              results: output.trim(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // Fall back to full UI description with manual search hint
    try {
      const fullUi = simctl(`ui ${target} describe`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                searchCriteria: { label, identifier, type },
                note: "Direct element search not available, returning full UI hierarchy",
                hint: "Search the hierarchy below for matching elements",
                hierarchy: fullUi,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Element search not available",
                searchCriteria: { label, identifier, type },
                details: error instanceof Error ? error.message : String(error),
                hint: "Use capture_screenshot_inline with AI vision to locate elements visually",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }
}

/**
 * Get screen information (dimensions, scale)
 */
export async function getScreenInfo(
  input: z.infer<typeof getScreenInfoSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = udid || "booted";

  try {
    // Get device info from simctl list
    const listOutput = simctl("list devices --json");
    const data = JSON.parse(listOutput);

    // Find the target device
    let deviceInfo: { name: string; udid: string; state: string; deviceTypeIdentifier?: string } | null = null;
    let runtimeId: string | null = null;

    for (const [runtime, devices] of Object.entries(data.devices) as [string, Array<{ name: string; udid: string; state: string; deviceTypeIdentifier?: string }>][]) {
      for (const device of devices) {
        if (device.udid === target || (target === "booted" && device.state === "Booted")) {
          deviceInfo = device;
          runtimeId = runtime;
          break;
        }
      }
      if (deviceInfo) break;
    }

    if (!deviceInfo) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Device not found",
                target,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Get device type info for screen dimensions
    const deviceTypesOutput = simctl("list devicetypes --json");
    const deviceTypes = JSON.parse(deviceTypesOutput);

    let screenInfo: { name: string; identifier: string } | null = null;
    for (const dt of deviceTypes.devicetypes as Array<{ name: string; identifier: string }>) {
      if (dt.identifier === deviceInfo.deviceTypeIdentifier) {
        screenInfo = dt;
        break;
      }
    }

    // Known screen dimensions for common devices
    const screenDimensions: Record<string, { width: number; height: number; scale: number }> = {
      "iPhone 16 Pro Max": { width: 440, height: 956, scale: 3 },
      "iPhone 16 Pro": { width: 402, height: 874, scale: 3 },
      "iPhone 16 Plus": { width: 430, height: 932, scale: 3 },
      "iPhone 16": { width: 393, height: 852, scale: 3 },
      "iPhone 15 Pro Max": { width: 430, height: 932, scale: 3 },
      "iPhone 15 Pro": { width: 393, height: 852, scale: 3 },
      "iPhone 15 Plus": { width: 430, height: 932, scale: 3 },
      "iPhone 15": { width: 393, height: 852, scale: 3 },
      "iPhone 14 Pro Max": { width: 430, height: 932, scale: 3 },
      "iPhone 14 Pro": { width: 393, height: 852, scale: 3 },
      "iPhone SE (3rd generation)": { width: 375, height: 667, scale: 2 },
      "iPad Pro 13-inch (M4)": { width: 1032, height: 1376, scale: 2 },
      "iPad Pro 11-inch (M4)": { width: 834, height: 1210, scale: 2 },
      "iPad Pro (12.9-inch) (6th generation)": { width: 1024, height: 1366, scale: 2 },
      "iPad Air 13-inch (M2)": { width: 1032, height: 1376, scale: 2 },
      "iPad Air 11-inch (M2)": { width: 820, height: 1180, scale: 2 },
    };

    const dimensions = screenDimensions[deviceInfo.name] || null;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              device: {
                name: deviceInfo.name,
                udid: deviceInfo.udid,
                state: deviceInfo.state,
                deviceType: deviceInfo.deviceTypeIdentifier,
                runtime: runtimeId,
              },
              screen: dimensions
                ? {
                    pointWidth: dimensions.width,
                    pointHeight: dimensions.height,
                    scale: dimensions.scale,
                    pixelWidth: dimensions.width * dimensions.scale,
                    pixelHeight: dimensions.height * dimensions.scale,
                  }
                : {
                    note: "Screen dimensions not in database for this device",
                    hint: "Use capture_screenshot to determine actual pixel dimensions",
                  },
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
          text: `Failed to get screen info: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool definitions for registration
 */
export const accessibilityTools = [
  {
    name: "describe_ui",
    title: "Describe UI",
    description:
      "Get the accessibility hierarchy of the current screen. Shows all UI elements with their labels, identifiers, and frames. Useful for finding tap coordinates.",
    schema: describeUiSchema,
    handler: describeUi,
  },
  {
    name: "describe_point",
    title: "Describe Point",
    description:
      "Get information about the UI element at a specific coordinate. Useful for identifying what's at a tap location.",
    schema: describePointSchema,
    handler: describePoint,
  },
  {
    name: "find_element",
    title: "Find Element",
    description:
      "Search for UI elements by accessibility label, identifier, or type. Returns matching elements with their coordinates.",
    schema: findElementSchema,
    handler: findElement,
  },
  {
    name: "get_screen_info",
    title: "Get Screen Info",
    description:
      "Get screen dimensions and device information for the simulator. Returns point dimensions, scale factor, and pixel dimensions.",
    schema: getScreenInfoSchema,
    handler: getScreenInfo,
  },
];
