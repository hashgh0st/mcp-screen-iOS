/**
 * Screenshot capture tools
 */

import { z } from "zod";
import { readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { simctl, parseSimctlJson } from "../../utils/exec.js";
import {
  SimctlListOutput,
  APP_STORE_DEVICES,
  StatusBarOptions,
  ToolResult,
} from "../../types/index.js";

/**
 * Input schemas for screenshot tools
 */
export const captureScreenshotSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  outputPath: z
    .string()
    .describe("Output file path for the screenshot (must end with .png)"),
  cleanStatusBar: z
    .boolean()
    .optional()
    .default(true)
    .describe("Set clean status bar (9:41, full battery, WiFi) before capture"),
  maskNotch: z
    .boolean()
    .optional()
    .default(true)
    .describe("Apply black mask over notch/Dynamic Island area"),
});

export const captureScreenshotInlineSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  cleanStatusBar: z
    .boolean()
    .optional()
    .default(true)
    .describe("Set clean status bar before capture"),
  maskNotch: z
    .boolean()
    .optional()
    .default(true)
    .describe("Apply black mask over notch/Dynamic Island area"),
});

export const captureAllAppStoreSchema = z.object({
  outputDir: z
    .string()
    .describe("Output directory for screenshots"),
  filenamePrefix: z
    .string()
    .optional()
    .default("screenshot")
    .describe("Prefix for screenshot filenames"),
  cleanStatusBar: z
    .boolean()
    .optional()
    .default(true)
    .describe("Set clean status bar before capture"),
  deviceClasses: z
    .array(z.enum(["iphone_6.9", "iphone_6.7", "ipad_13", "ipad_12.9"]))
    .optional()
    .default(["iphone_6.9", "ipad_13"])
    .describe("Device classes to capture (defaults to iPhone 6.9\" and iPad 13\")"),
});

export const setStatusBarSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  time: z
    .string()
    .optional()
    .default("9:41")
    .describe("Time to display (e.g., '9:41')"),
  batteryLevel: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(100)
    .describe("Battery level percentage"),
  batteryState: z
    .enum(["charging", "charged", "discharging"])
    .optional()
    .default("charged")
    .describe("Battery state"),
  wifiMode: z
    .enum(["searching", "failed", "active"])
    .optional()
    .default("active")
    .describe("WiFi mode"),
  wifiBars: z
    .number()
    .min(0)
    .max(3)
    .optional()
    .default(3)
    .describe("WiFi signal bars (0-3)"),
  cellularMode: z
    .enum(["notSupported", "searching", "failed", "active"])
    .optional()
    .default("active")
    .describe("Cellular mode"),
  cellularBars: z
    .number()
    .min(0)
    .max(4)
    .optional()
    .default(4)
    .describe("Cellular signal bars (0-4)"),
  operatorName: z
    .string()
    .optional()
    .describe("Carrier/operator name to display"),
});

export const clearStatusBarSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const validateScreenshotSchema = z.object({
  filePath: z
    .string()
    .describe("Path to the screenshot file to validate"),
  expectedDeviceClass: z
    .enum(["iphone_6.9", "iphone_6.7", "ipad_13", "ipad_12.9"])
    .optional()
    .describe("Expected App Store device class"),
});

/**
 * Apply status bar overrides
 */
function applyStatusBar(udid: string, options: StatusBarOptions): void {
  const args: string[] = [];

  if (options.time) args.push(`--time "${options.time}"`);
  if (options.batteryState) args.push(`--batteryState ${options.batteryState}`);
  if (options.batteryLevel !== undefined) args.push(`--batteryLevel ${options.batteryLevel}`);
  if (options.wifiMode) args.push(`--wifiMode ${options.wifiMode}`);
  if (options.wifiBars !== undefined) args.push(`--wifiBars ${options.wifiBars}`);
  if (options.cellularMode) args.push(`--cellularMode ${options.cellularMode}`);
  if (options.cellularBars !== undefined) args.push(`--cellularBars ${options.cellularBars}`);
  if (options.operatorName) args.push(`--operatorName "${options.operatorName}"`);

  simctl(`status_bar ${udid} override ${args.join(" ")}`);
}

/**
 * Capture a screenshot to a file
 */
export async function captureScreenshot(
  input: z.infer<typeof captureScreenshotSchema>
): Promise<ToolResult> {
  const { udid, outputPath, cleanStatusBar, maskNotch } = input;
  const target = udid || "booted";

  // Ensure output directory exists
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Apply clean status bar if requested
  if (cleanStatusBar) {
    applyStatusBar(target, {
      time: "9:41",
      batteryState: "charged",
      batteryLevel: 100,
      wifiMode: "active",
      wifiBars: 3,
      cellularMode: "active",
      cellularBars: 4,
    });
  }

  // Capture screenshot
  const maskOption = maskNotch ? "--mask=black" : "--mask=ignored";
  const fullPath = resolve(outputPath);
  simctl(`io ${target} screenshot --type=png ${maskOption} "${fullPath}"`);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: "Screenshot captured successfully",
            path: fullPath,
            cleanStatusBar,
            maskNotch,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Capture a screenshot and return as base64 image
 */
export async function captureScreenshotInline(
  input: z.infer<typeof captureScreenshotInlineSchema>
): Promise<ToolResult> {
  const { udid, cleanStatusBar, maskNotch } = input;
  const target = udid || "booted";
  const tempPath = `/tmp/mcp-screenshot-${Date.now()}.png`;

  try {
    // Apply clean status bar if requested
    if (cleanStatusBar) {
      applyStatusBar(target, {
        time: "9:41",
        batteryState: "charged",
        batteryLevel: 100,
        wifiMode: "active",
        wifiBars: 3,
        cellularMode: "active",
        cellularBars: 4,
      });
    }

    // Capture screenshot
    const maskOption = maskNotch ? "--mask=black" : "--mask=ignored";
    simctl(`io ${target} screenshot --type=png ${maskOption} "${tempPath}"`);

    // Read and encode
    const imageBuffer = readFileSync(tempPath);
    const base64Data = imageBuffer.toString("base64");

    // Cleanup
    unlinkSync(tempPath);

    return {
      content: [
        {
          type: "image",
          data: base64Data,
          mimeType: "image/png",
        },
      ],
    };
  } catch (error) {
    // Cleanup on error
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
    throw error;
  }
}

/**
 * Capture screenshots for all App Store required sizes
 */
export async function captureAllAppStore(
  input: z.infer<typeof captureAllAppStoreSchema>
): Promise<ToolResult> {
  const { outputDir, filenamePrefix, cleanStatusBar, deviceClasses } = input;

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Get currently booted simulators
  const data = parseSimctlJson<SimctlListOutput>("list devices");
  const bootedDevices: Map<string, string> = new Map(); // deviceType -> udid

  for (const devices of Object.values(data.devices)) {
    for (const device of devices) {
      if (device.state === "Booted" && device.deviceTypeIdentifier) {
        bootedDevices.set(device.deviceTypeIdentifier, device.udid);
      }
    }
  }

  const results: Array<{
    deviceClass: string;
    status: "success" | "skipped" | "error";
    path?: string;
    error?: string;
  }> = [];

  for (const deviceClass of deviceClasses) {
    const config = APP_STORE_DEVICES[deviceClass];
    if (!config) {
      results.push({
        deviceClass,
        status: "error",
        error: `Unknown device class: ${deviceClass}`,
      });
      continue;
    }

    const udid = bootedDevices.get(config.deviceType);
    if (!udid) {
      results.push({
        deviceClass,
        status: "skipped",
        error: `No booted simulator found for ${config.name}. Boot one with boot_appstore_simulator first.`,
      });
      continue;
    }

    try {
      const outputPath = resolve(outputDir, `${filenamePrefix}_${deviceClass}.png`);

      // Apply clean status bar
      if (cleanStatusBar) {
        applyStatusBar(udid, {
          time: "9:41",
          batteryState: "charged",
          batteryLevel: 100,
          wifiMode: "active",
          wifiBars: 3,
          cellularMode: "active",
          cellularBars: 4,
        });
      }

      // Capture
      simctl(`io ${udid} screenshot --type=png --mask=black "${outputPath}"`);

      results.push({
        deviceClass,
        status: "success",
        path: outputPath,
      });
    } catch (error) {
      results.push({
        deviceClass,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: "App Store screenshot capture complete",
            outputDir: resolve(outputDir),
            results,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Set status bar overrides
 */
export async function setStatusBar(
  input: z.infer<typeof setStatusBarSchema>
): Promise<ToolResult> {
  const { udid, ...options } = input;
  const target = udid || "booted";

  applyStatusBar(target, options);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: "Status bar configured successfully",
            settings: options,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Clear status bar overrides
 */
export async function clearStatusBar(
  input: z.infer<typeof clearStatusBarSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = udid || "booted";

  simctl(`status_bar ${target} clear`);

  return {
    content: [
      {
        type: "text",
        text: "Status bar reset to system defaults",
      },
    ],
  };
}

/**
 * Validate a screenshot meets App Store requirements
 */
export async function validateScreenshot(
  input: z.infer<typeof validateScreenshotSchema>
): Promise<ToolResult> {
  const { filePath, expectedDeviceClass } = input;
  const fullPath = resolve(filePath);

  if (!existsSync(fullPath)) {
    return {
      content: [
        {
          type: "text",
          text: `File not found: ${fullPath}`,
        },
      ],
      isError: true,
    };
  }

  // Read PNG header to get dimensions
  const buffer = readFileSync(fullPath);

  // Check PNG signature
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    return {
      content: [
        {
          type: "text",
          text: "File is not a valid PNG image. App Store requires PNG or JPEG format.",
        },
      ],
      isError: true,
    };
  }

  // Parse IHDR chunk for dimensions (starts at byte 16)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const fileSizeBytes = buffer.length;
  const fileSizeMB = fileSizeBytes / (1024 * 1024);

  const issues: string[] = [];
  const validations = {
    format: "PNG (valid)",
    width,
    height,
    fileSizeMB: fileSizeMB.toFixed(2),
    aspectRatio: (height / width).toFixed(3),
  };

  // Check file size (App Store limit is 10MB)
  if (fileSizeMB > 10) {
    issues.push(`File size (${fileSizeMB.toFixed(2)}MB) exceeds App Store limit of 10MB`);
  }

  // Check against expected device class
  if (expectedDeviceClass) {
    const expectedConfig = APP_STORE_DEVICES[expectedDeviceClass];
    if (expectedConfig) {
      const { resolution } = expectedConfig;
      // Check both portrait and landscape orientations
      const matchesPortrait = width === resolution.width && height === resolution.height;
      const matchesLandscape = width === resolution.height && height === resolution.width;

      if (!matchesPortrait && !matchesLandscape) {
        issues.push(
          `Dimensions (${width}x${height}) don't match ${expectedDeviceClass} ` +
            `(expected ${resolution.width}x${resolution.height} or ${resolution.height}x${resolution.width})`
        );
      }
    }
  }

  // Find matching App Store device class
  let matchedDevice: string | null = null;
  for (const [deviceClass, config] of Object.entries(APP_STORE_DEVICES)) {
    const { resolution } = config;
    if (
      (width === resolution.width && height === resolution.height) ||
      (width === resolution.height && height === resolution.width)
    ) {
      matchedDevice = deviceClass;
      break;
    }
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            path: fullPath,
            validations,
            matchedAppStoreDevice: matchedDevice,
            issues: issues.length > 0 ? issues : "None - screenshot meets App Store requirements",
            isValid: issues.length === 0,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Tool definitions for registration
 */
export const screenshotTools = [
  {
    name: "capture_screenshot",
    title: "Capture Screenshot",
    description:
      "Capture a screenshot from the iOS Simulator at native resolution. Optionally apply clean status bar (9:41, full battery) and black mask over notch/Dynamic Island.",
    schema: captureScreenshotSchema,
    handler: captureScreenshot,
  },
  {
    name: "capture_screenshot_inline",
    title: "Capture Screenshot Inline",
    description:
      "Capture a screenshot and return it as base64-encoded image data. Useful for AI vision analysis without saving to disk.",
    schema: captureScreenshotInlineSchema,
    handler: captureScreenshotInline,
  },
  {
    name: "capture_all_appstore",
    title: "Capture All App Store Screenshots",
    description:
      "Capture screenshots for all App Store required sizes from currently booted simulators. Requires simulators to be already booted for each device class.",
    schema: captureAllAppStoreSchema,
    handler: captureAllAppStore,
  },
  {
    name: "set_status_bar",
    title: "Set Status Bar",
    description:
      "Configure the simulator status bar with custom time, battery, WiFi, and cellular settings. Use this to set up clean screenshots.",
    schema: setStatusBarSchema,
    handler: setStatusBar,
  },
  {
    name: "clear_status_bar",
    title: "Clear Status Bar",
    description: "Reset the simulator status bar to system defaults, removing any overrides.",
    schema: clearStatusBarSchema,
    handler: clearStatusBar,
  },
  {
    name: "validate_screenshot",
    title: "Validate Screenshot",
    description:
      "Validate that a screenshot meets App Store requirements: PNG/JPEG format, dimensions match device class, file size under 10MB.",
    schema: validateScreenshotSchema,
    handler: validateScreenshot,
  },
];
