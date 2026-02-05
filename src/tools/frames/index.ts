/**
 * Device frame tools for iOS Simulator screenshots
 *
 * Add device bezels/frames around screenshots for professional App Store presentations
 */

import { z } from "zod";
import { existsSync } from "fs";
import { dirname, resolve, basename, extname, join } from "path";
import { execCommand, commandExists } from "../../utils/exec.js";
import { ToolResult } from "../../types/index.js";
import { sanitizeHexColor, validatePath } from "../../utils/validation.js";

/**
 * Device frame configurations
 * Contains padding and bezel info for different devices
 */
const DEVICE_FRAMES: Record<
  string,
  {
    name: string;
    cornerRadius: number;
    bezelWidth: number;
    bezelColor: string;
    screenWidth: number;
    screenHeight: number;
  }
> = {
  iphone_17_pro_max: {
    name: "iPhone 17 Pro Max",
    cornerRadius: 55,
    bezelWidth: 12,
    bezelColor: "#1a1a1a",
    screenWidth: 1320,
    screenHeight: 2868,
  },
  iphone_16_pro_max: {
    name: "iPhone 16 Pro Max",
    cornerRadius: 55,
    bezelWidth: 12,
    bezelColor: "#1a1a1a",
    screenWidth: 1320,
    screenHeight: 2868,
  },
  iphone_16_pro: {
    name: "iPhone 16 Pro",
    cornerRadius: 55,
    bezelWidth: 12,
    bezelColor: "#1a1a1a",
    screenWidth: 1206,
    screenHeight: 2622,
  },
  ipad_pro_13: {
    name: "iPad Pro 13-inch",
    cornerRadius: 40,
    bezelWidth: 20,
    bezelColor: "#1a1a1a",
    screenWidth: 2064,
    screenHeight: 2752,
  },
};

/**
 * Input schemas
 */
export const addFrameSchema = z.object({
  inputPath: z
    .string()
    .describe("Path to the input screenshot"),
  outputPath: z
    .string()
    .optional()
    .describe("Output path for framed image (defaults to input_framed.png)"),
  device: z
    .enum(["iphone_16_pro_max", "iphone_16_pro", "iphone_15_pro_max", "ipad_pro_13", "ipad_pro_12_9", "auto"])
    .optional()
    .default("auto")
    .describe("Device frame to apply (auto-detects from image dimensions)"),
  backgroundColor: z
    .string()
    .optional()
    .default("#ffffff")
    .describe("Background color for the framed image (hex color)"),
  padding: z
    .number()
    .optional()
    .default(50)
    .describe("Padding around the device frame in pixels"),
  shadow: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add drop shadow to the device"),
});

export const addBackgroundSchema = z.object({
  inputPath: z
    .string()
    .describe("Path to the input screenshot"),
  outputPath: z
    .string()
    .optional()
    .describe("Output path (defaults to input_bg.png)"),
  backgroundColor: z
    .string()
    .optional()
    .default("#ffffff")
    .describe("Background color (hex color)"),
  padding: z
    .number()
    .optional()
    .default(100)
    .describe("Padding around the screenshot in pixels"),
  cornerRadius: z
    .number()
    .optional()
    .default(0)
    .describe("Corner radius for the screenshot"),
});

export const listDeviceFramesSchema = z.object({});

/**
 * Detect device from image dimensions
 */
function detectDevice(width: number, height: number): string | null {
  // Check both portrait and landscape orientations
  for (const [deviceId, config] of Object.entries(DEVICE_FRAMES)) {
    if (
      (width === config.screenWidth && height === config.screenHeight) ||
      (width === config.screenHeight && height === config.screenWidth)
    ) {
      return deviceId;
    }
  }
  return null;
}

/**
 * Get image dimensions using sips (built into macOS)
 */
function getImageDimensions(imagePath: string): { width: number; height: number } | null {
  try {
    const output = execCommand(`sips -g pixelWidth -g pixelHeight "${imagePath}"`);
    const widthMatch = output.match(/pixelWidth:\s*(\d+)/);
    const heightMatch = output.match(/pixelHeight:\s*(\d+)/);

    if (widthMatch && heightMatch) {
      return {
        width: parseInt(widthMatch[1], 10),
        height: parseInt(heightMatch[1], 10),
      };
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function getImageMagickBinary(): "magick" | "convert" | null {
  if (commandExists("magick")) {
    return "magick";
  }
  if (commandExists("convert")) {
    return "convert";
  }
  return null;
}

/**
 * Add a device frame around a screenshot
 */
export async function addFrame(
  input: z.infer<typeof addFrameSchema>
): Promise<ToolResult> {
  const { inputPath, outputPath, device, backgroundColor, padding, shadow } = input;

  // Validate inputs
  let fullInputPath: string;
  try {
    fullInputPath = validatePath(inputPath);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Invalid input path: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }

  let safeBackgroundColor: string;
  try {
    safeBackgroundColor = sanitizeHexColor(backgroundColor);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Invalid background color: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }

  if (!existsSync(fullInputPath)) {
    return {
      content: [{ type: "text", text: `Input file not found: ${fullInputPath}` }],
      isError: true,
    };
  }

  // Determine output path
  const ext = extname(fullInputPath);
  const baseName = basename(fullInputPath, ext);
  const outputDir = dirname(fullInputPath);
  const fullOutputPath = outputPath ? resolve(outputPath) : join(outputDir, `${baseName}_framed${ext}`);

  // Get image dimensions
  const dimensions = getImageDimensions(fullInputPath);
  if (!dimensions) {
    return {
      content: [{ type: "text", text: "Could not determine image dimensions" }],
      isError: true,
    };
  }

  // Detect or use specified device
  let deviceId: string = device;
  if (device === "auto") {
    deviceId = detectDevice(dimensions.width, dimensions.height) || "iphone_16_pro_max";
  }

  const frameConfig = DEVICE_FRAMES[deviceId as keyof typeof DEVICE_FRAMES];
  if (!frameConfig) {
    return {
      content: [{ type: "text", text: `Unknown device: ${deviceId}` }],
      isError: true,
    };
  }

  const imageMagick = getImageMagickBinary();

  if (!imageMagick) {
    // Fall back to sips for basic operations
    try {
      // Use sips for basic padding (limited compared to ImageMagick)
      const paddedWidth = dimensions.width + padding * 2;
      const paddedHeight = dimensions.height + padding * 2;

      // Create a simple padded version using sips
      execCommand(`sips -p ${paddedHeight} ${paddedWidth} --padColor ${safeBackgroundColor} "${fullInputPath}" --out "${fullOutputPath}"`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Basic padding added (ImageMagick not available for full frame)",
                inputPath: fullInputPath,
                outputPath: fullOutputPath,
                padding,
                backgroundColor,
                note: "Install ImageMagick for device frame bezels: brew install imagemagick",
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
            text: `Failed to add frame: ${error instanceof Error ? error.message : String(error)}. Install ImageMagick: brew install imagemagick`,
          },
        ],
        isError: true,
      };
    }
  }

  // Use ImageMagick for full frame effect
  try {
    const bezelWidth = frameConfig.bezelWidth;
    const cornerRadius = frameConfig.cornerRadius;
    const totalWidth = dimensions.width + bezelWidth * 2 + padding * 2;
    const totalHeight = dimensions.height + bezelWidth * 2 + padding * 2;

    // Build ImageMagick command for frame effect
    let cmd = `${imageMagick} "${fullInputPath}"`;

    // Add rounded corners to screenshot
    cmd += ` \\( +clone -alpha extract -draw "fill black polygon 0,0 0,${cornerRadius} ${cornerRadius},0 fill white circle ${cornerRadius},${cornerRadius} ${cornerRadius},0" \\( +clone -flip \\) -compose Multiply -composite \\( +clone -flop \\) -compose Multiply -composite \\) -alpha off -compose CopyOpacity -composite`;

    // Add bezel/border
    cmd += ` -bordercolor "${frameConfig.bezelColor}" -border ${bezelWidth}`;

    // Add rounded corners to bezel
    const outerRadius = cornerRadius + bezelWidth;
    cmd += ` \\( +clone -alpha extract -draw "fill black polygon 0,0 0,${outerRadius} ${outerRadius},0 fill white circle ${outerRadius},${outerRadius} ${outerRadius},0" \\( +clone -flip \\) -compose Multiply -composite \\( +clone -flop \\) -compose Multiply -composite \\) -alpha off -compose CopyOpacity -composite`;

    // Add shadow if requested
    if (shadow) {
      cmd += ` \\( +clone -background black -shadow 60x20+0+10 \\) +swap -background none -layers merge +repage`;
    }

    // Add background and padding (use original backgroundColor with # for ImageMagick)
    cmd += ` -background "#${safeBackgroundColor}" -gravity center -extent ${totalWidth}x${totalHeight}`;

    cmd += ` "${fullOutputPath}"`;

    execCommand(cmd);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Device frame added successfully",
              inputPath: fullInputPath,
              outputPath: fullOutputPath,
              device: deviceId,
              deviceName: frameConfig.name,
              dimensions: { width: totalWidth, height: totalHeight },
              shadow,
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
          text: `Failed to add frame: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Add a simple background with padding
 */
export async function addBackground(
  input: z.infer<typeof addBackgroundSchema>
): Promise<ToolResult> {
  const { inputPath, outputPath, backgroundColor, padding, cornerRadius } = input;

  // Validate inputs
  let fullInputPath: string;
  try {
    fullInputPath = validatePath(inputPath);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Invalid input path: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }

  let safeBackgroundColor: string;
  try {
    safeBackgroundColor = sanitizeHexColor(backgroundColor);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Invalid background color: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }

  if (!existsSync(fullInputPath)) {
    return {
      content: [{ type: "text", text: `Input file not found: ${fullInputPath}` }],
      isError: true,
    };
  }

  const ext = extname(fullInputPath);
  const baseName = basename(fullInputPath, ext);
  const outputDir = dirname(fullInputPath);
  const fullOutputPath = outputPath ? resolve(outputPath) : join(outputDir, `${baseName}_bg${ext}`);

  const dimensions = getImageDimensions(fullInputPath);
  if (!dimensions) {
    return {
      content: [{ type: "text", text: "Could not determine image dimensions" }],
      isError: true,
    };
  }

  try {
    const paddedWidth = dimensions.width + padding * 2;
    const paddedHeight = dimensions.height + padding * 2;

    const imageMagick = getImageMagickBinary();

    if (cornerRadius > 0 && imageMagick) {
      // Use ImageMagick to apply rounded corners, then pad/extend with background.
      let cmd = `${imageMagick} "${fullInputPath}"`;
      cmd += ` \\( +clone -alpha extract -draw "fill black polygon 0,0 0,${cornerRadius} ${cornerRadius},0 fill white circle ${cornerRadius},${cornerRadius} ${cornerRadius},0" \\( +clone -flip \\) -compose Multiply -composite \\( +clone -flop \\) -compose Multiply -composite \\) -alpha off -compose CopyOpacity -composite`;
      cmd += ` -background "#${safeBackgroundColor}" -gravity center -extent ${paddedWidth}x${paddedHeight}`;
      cmd += ` "${fullOutputPath}"`;
      execCommand(cmd);
    } else {
      // Use sips for basic operation (no rounded corners).
      execCommand(
        `sips -p ${paddedHeight} ${paddedWidth} --padColor ${safeBackgroundColor} "${fullInputPath}" --out "${fullOutputPath}"`
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Background added successfully",
              inputPath: fullInputPath,
              outputPath: fullOutputPath,
              backgroundColor,
              padding,
              cornerRadius,
              cornerRadiusApplied: cornerRadius > 0 ? Boolean(imageMagick) : false,
              dimensions: { width: paddedWidth, height: paddedHeight },
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
          text: `Failed to add background: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * List available device frames
 */
export async function listDeviceFrames(
  _input: z.infer<typeof listDeviceFramesSchema>
): Promise<ToolResult> {
  void _input;
  const frames = Object.entries(DEVICE_FRAMES).map(([id, config]) => ({
    id,
    name: config.name,
    screenDimensions: `${config.screenWidth}x${config.screenHeight}`,
    bezelWidth: config.bezelWidth,
    cornerRadius: config.cornerRadius,
  }));

  const imageMagick = getImageMagickBinary();

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            availableFrames: frames,
            imageMagickInstalled: Boolean(imageMagick),
            imageMagickBinary: imageMagick,
            note: imageMagick
              ? "Full frame support available"
              : "Install ImageMagick for full frame support: brew install imagemagick",
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
export const frameTools = [
  {
    name: "add_frame",
    title: "Add Device Frame",
    description:
      "Add a device bezel/frame around a screenshot. Auto-detects device from dimensions. Requires ImageMagick for full effect (brew install imagemagick).",
    schema: addFrameSchema,
    handler: addFrame,
  },
  {
    name: "add_background",
    title: "Add Background",
    description:
      "Add a solid background with padding around a screenshot. Useful for simple presentations.",
    schema: addBackgroundSchema,
    handler: addBackground,
  },
  {
    name: "list_device_frames",
    title: "List Device Frames",
    description: "List all available device frames and their specifications.",
    schema: listDeviceFramesSchema,
    handler: listDeviceFrames,
  },
];
