/**
 * Screenshot capture tools
 */

import { z } from "zod";
import { readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { dirname, resolve } from "path";
import { simctl, parseSimctlJson } from "../../utils/exec.js";
import { shellEscape, validatePath, resolveTarget } from "../../utils/validation.js";
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

/**
 * Scene definition for multi-step captures
 */
const sceneSchema = z.object({
  name: z
    .string()
    .describe("Scene identifier used in filename (e.g., 'home', 'settings')"),
  deepLink: z
    .string()
    .optional()
    .describe("URL/deep link to open before capture (e.g., myapp://settings)"),
  waitMs: z
    .number()
    .optional()
    .default(1000)
    .describe("Wait time in ms after navigation before capture"),
});

export const captureAllAppStoreSchema = z.object({
  outputDir: z
    .string()
    .describe("Output directory for screenshots"),
  cleanStatusBar: z
    .boolean()
    .optional()
    .default(true)
    .describe("Set clean status bar before capture"),
  deviceClasses: z
    .array(z.enum(["iphone_6.9", "ipad_13"]))
    .optional()
    .default(["iphone_6.9", "ipad_13"])
    .describe("Device classes to capture"),
  appearance: z
    .enum(["light", "dark", "both"])
    .optional()
    .default("light")
    .describe("Appearance mode(s) to capture"),
  languageTags: z
    .array(z.string())
    .optional()
    .default(["current"])
    .describe("Language/locale tags to capture. Use 'current' to avoid changing simulator locale (e.g., ['current'] or ['en-US', 'ja-JP'])"),
  scenes: z
    .array(sceneSchema)
    .optional()
    .describe("Scenes to capture. If omitted, captures single screenshot of current screen."),
  bundleId: z
    .string()
    .optional()
    .describe("App bundle ID - required when capturing non-'current' locales (needed for app restart to apply locale)"),
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
    .enum(["iphone_6.9", "ipad_13"])
    .optional()
    .describe("Expected App Store device class"),
});

const JPEG_START_MARKER = 0xd8;
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function parsePngDimensions(buffer: Buffer): { width: number; height: number } | null {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer[0] !== 0xff || buffer[1] !== JPEG_START_MARKER) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > buffer.length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      break;
    }

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (offset + 7 > buffer.length) {
        break;
      }
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function matchesResolution(
  width: number,
  height: number,
  resolution: { width: number; height: number }
): boolean {
  return (
    (width === resolution.width && height === resolution.height) ||
    (width === resolution.height && height === resolution.width)
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCurrentLanguageTag(tag: string): boolean {
  return tag.trim().toLowerCase() === "current";
}

function parseLocaleAndLanguage(tag: string): { locale: string; language: string } {
  const trimmed = tag.trim();

  // Accept common underscore locale format: en_US, ja_JP, zh_CN, etc.
  if (trimmed.includes("_")) {
    const language = trimmed.split("_")[0];
    return { locale: trimmed, language };
  }

  // Basic BCP-47 parsing: language[-Script][-REGION]
  const parts = trimmed.split("-").filter(Boolean);
  const language = parts[0];

  let script: string | undefined;
  let region: string | undefined;

  for (const part of parts.slice(1)) {
    if (part.length === 4) {
      script = part[0].toUpperCase() + part.slice(1).toLowerCase();
      continue;
    }
    if (part.length === 2) {
      region = part.toUpperCase();
      continue;
    }
    if (/^\d{3}$/.test(part)) {
      region = part;
    }
  }

  const locale = region ? `${language}_${region}` : language;
  const appleLanguage = script ? `${language}-${script}` : language;
  return { locale, language: appleLanguage };
}

/**
 * Apply status bar overrides
 */
function applyStatusBar(udid: string, options: StatusBarOptions): void {
  const args: string[] = [];

  if (options.time) args.push(`--time ${shellEscape(options.time)}`);
  if (options.batteryState) args.push(`--batteryState ${options.batteryState}`);
  if (options.batteryLevel !== undefined) args.push(`--batteryLevel ${options.batteryLevel}`);
  if (options.wifiMode) args.push(`--wifiMode ${options.wifiMode}`);
  if (options.wifiBars !== undefined) args.push(`--wifiBars ${options.wifiBars}`);
  if (options.cellularMode) args.push(`--cellularMode ${options.cellularMode}`);
  if (options.cellularBars !== undefined) args.push(`--cellularBars ${options.cellularBars}`);
  if (options.operatorName) args.push(`--operatorName ${shellEscape(options.operatorName)}`);

  simctl(`status_bar ${udid} override ${args.join(" ")}`);
}

/**
 * Capture a screenshot to a file
 */
export async function captureScreenshot(
  input: z.infer<typeof captureScreenshotSchema>
): Promise<ToolResult> {
  const { udid, outputPath, cleanStatusBar, maskNotch } = input;
  const target = resolveTarget(udid);

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
  const fullPath = validatePath(outputPath);
  simctl(`io ${target} screenshot --type=png ${maskOption} ${shellEscape(fullPath)}`);

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
  const target = resolveTarget(udid);
  const tempPath = `/tmp/mcp-screenshot-${randomUUID()}.png`;

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
    simctl(`io ${target} screenshot --type=png ${maskOption} ${shellEscape(tempPath)}`);

    // Read and encode
    const imageBuffer = readFileSync(tempPath);
    const base64Data = imageBuffer.toString("base64");

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
    return {
      content: [
        {
          type: "text",
          text: `Failed to capture screenshot inline: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  } finally {
    // Always cleanup temp file
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Capture screenshots for all App Store required sizes
 * Supports multi-locale, light/dark mode, and multi-scene orchestration
 */
export async function captureAllAppStore(
  input: z.infer<typeof captureAllAppStoreSchema>
): Promise<ToolResult> {
  const {
    outputDir,
    cleanStatusBar,
    deviceClasses,
    appearance,
    languageTags,
    scenes,
    bundleId,
  } = input;

  const wantsLocaleOverride = languageTags.some((tag) => !isCurrentLanguageTag(tag));

  // Validate: bundleId required when applying locale overrides (app restart needed)
  if (wantsLocaleOverride && !bundleId) {
    return {
      content: [
        {
          type: "text",
          text: "bundleId is required when capturing non-'current' locales (needed for app restart to apply locale)",
        },
      ],
      isError: true,
    };
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

  // Determine appearance modes to capture
  const appearanceModes: Array<"light" | "dark"> =
    appearance === "both" ? ["light", "dark"] : [appearance];

  // Default scenes if not specified
  const captureScenes = scenes || [{ name: "screenshot", waitMs: 500 }];

  const results: Array<{
    languageTag: string;
    appearance: string;
    deviceClass: string;
    scene: string;
    status: "success" | "skipped" | "error";
    path?: string;
    error?: string;
  }> = [];

  // Main orchestration loop: language -> appearance -> device -> scene
  for (const languageTag of languageTags) {
    const applyLocale = !isCurrentLanguageTag(languageTag);
    const localeInfo = applyLocale ? parseLocaleAndLanguage(languageTag) : null;

    for (const mode of appearanceModes) {
      for (const deviceClass of deviceClasses) {
        const config = APP_STORE_DEVICES[deviceClass];
        if (!config) {
          results.push({
            languageTag,
            appearance: mode,
            deviceClass,
            scene: "*",
            status: "error",
            error: `Unknown device class: ${deviceClass}`,
          });
          continue;
        }

        let udid = bootedDevices.get(config.deviceType);
        if (!udid && config.alternateDeviceTypes) {
          for (const altType of config.alternateDeviceTypes) {
            udid = bootedDevices.get(altType);
            if (udid) break;
          }
        }
        if (!udid) {
          results.push({
            languageTag,
            appearance: mode,
            deviceClass,
            scene: "*",
            status: "skipped",
            error: `No booted simulator found for ${config.name}`,
          });
          continue;
        }

        try {
          // Apply locale (requires app restart to take effect)
          if (applyLocale && localeInfo) {
            simctl(`spawn ${udid} defaults write -globalDomain AppleLocale -string ${shellEscape(localeInfo.locale)}`);
            simctl(`spawn ${udid} defaults write -globalDomain AppleLanguages -array ${shellEscape(localeInfo.language)}`);
          }

          // Set appearance mode
          simctl(`ui ${udid} appearance ${mode}`);

          // Restart app to apply locale changes (only needed when we changed locale)
          if (applyLocale && bundleId) {
            try {
              simctl(`terminate ${udid} ${shellEscape(bundleId)}`);
            } catch {
              // App may not be running, ignore
            }
            await sleep(1500); // Wait for app to fully terminate
            simctl(`launch ${udid} ${shellEscape(bundleId)}`);
            await sleep(2000); // Wait for app to fully launch
          }

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

          // Capture each scene
          for (let i = 0; i < captureScenes.length; i++) {
            const scene = captureScenes[i];

            // Navigate via deep link if specified
            if (scene.deepLink) {
              simctl(`openurl ${udid} ${shellEscape(scene.deepLink)}`);
            }

            // Wait for UI to settle
            await sleep(scene.waitMs || 1000);

            // Create output path: outputDir/languageTag/deviceClass/NN-sceneName.png
            const deviceDir = deviceClass.replace("_", "-");
            const sceneDir = resolve(outputDir, languageTag, deviceDir);
            if (!existsSync(sceneDir)) {
              mkdirSync(sceneDir, { recursive: true });
            }

            // Include appearance in filename if capturing both modes
            const appearanceSuffix = appearance === "both" ? `-${mode}` : "";
            const filename = `${String(i + 1).padStart(2, "0")}-${scene.name}${appearanceSuffix}.png`;
            const outputPath = resolve(sceneDir, filename);

            // Capture screenshot
            simctl(`io ${udid} screenshot --type=png --mask=black ${shellEscape(outputPath)}`);

            results.push({
              languageTag,
              appearance: mode,
              deviceClass,
              scene: scene.name,
              status: "success",
              path: outputPath,
            });
          }
        } catch (error) {
          results.push({
            languageTag,
            appearance: mode,
            deviceClass,
            scene: "*",
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  // Summary stats
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: "App Store screenshot capture complete",
            outputDir: resolve(outputDir),
            summary: {
              total: results.length,
              success: successCount,
              errors: errorCount,
              skipped: skippedCount,
            },
            configuration: {
              languageTags,
              appearanceModes,
              deviceClasses,
              scenes: captureScenes.map((s) => s.name),
            },
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
  const target = resolveTarget(udid);

  applyStatusBar(target, options as StatusBarOptions);

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
  const target = resolveTarget(udid);

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

  // Read image header to get dimensions
  const buffer = readFileSync(fullPath);
  const pngDimensions = parsePngDimensions(buffer);
  const jpegDimensions = pngDimensions ? null : parseJpegDimensions(buffer);
  const dimensions = pngDimensions ?? jpegDimensions;

  if (!dimensions) {
    return {
      content: [
        {
          type: "text",
          text: "File is not a valid PNG or JPEG image. App Store requires PNG or JPEG format.",
        },
      ],
      isError: true,
    };
  }

  const format = pngDimensions ? "PNG" : "JPEG";
  const { width, height } = dimensions;
  const fileSizeBytes = buffer.length;
  const fileSizeMB = fileSizeBytes / (1024 * 1024);

  const issues: string[] = [];
  const validations = {
    format: `${format} (valid)`,
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
      const matchesExpected = expectedConfig.acceptedResolutions.some((resolution) =>
        matchesResolution(width, height, resolution)
      );

      if (!matchesExpected) {
        const expectedList = expectedConfig.acceptedResolutions
          .map((resolution) => `${resolution.width}x${resolution.height}`)
          .join(", ");
        issues.push(
          `Dimensions (${width}x${height}) don't match ${expectedDeviceClass} ` +
            `(expected ${expectedList} or their landscape equivalents)`
        );
      }
    }
  }

  // Find matching App Store device class
  let matchedDevice: string | null = null;
  for (const [deviceClass, config] of Object.entries(APP_STORE_DEVICES)) {
    const matchesClass = config.acceptedResolutions.some((resolution) =>
      matchesResolution(width, height, resolution)
    );
    if (matchesClass) {
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
      "Full orchestration tool for App Store screenshot sets. Captures across multiple languages, light/dark modes, device classes, and scenes. " +
      "Output: {outputDir}/{languageTag}/{device-class}/NN-scene.png. Requires simulators to be booted for each device class.",
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
