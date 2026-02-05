/**
 * Video recording tools for iOS Simulator
 *
 * Uses simctl io recordVideo for capturing simulator interactions
 */

import { z } from "zod";
import { spawn, ChildProcess } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { simctl } from "../../utils/exec.js";
import { ToolResult } from "../../types/index.js";

/**
 * Track active recording processes by UDID
 */
const activeRecordings: Map<string, { process: ChildProcess; outputPath: string; startTime: number }> = new Map();

/**
 * Input schemas for video tools
 */
export const startRecordingSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  outputPath: z
    .string()
    .describe("Output file path for the video (.mp4 or .mov)"),
  codec: z
    .enum(["h264", "hevc"])
    .optional()
    .default("h264")
    .describe("Video codec to use"),
  mask: z
    .enum(["ignored", "alpha", "black"])
    .optional()
    .default("black")
    .describe("How to handle the notch/Dynamic Island area"),
  force: z
    .boolean()
    .optional()
    .default(false)
    .describe("Force start even if a recording is already in progress (stops existing)"),
});

export const stopRecordingSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const getRecordingStatusSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

/**
 * Get the actual UDID for "booted" or return the provided UDID
 */
function resolveUdid(udid?: string): string {
  if (udid && udid !== "booted") {
    return udid;
  }

  // Find the booted simulator
  try {
    const output = simctl("list devices --json");
    const data = JSON.parse(output);

    for (const devices of Object.values(data.devices) as Array<Array<{ udid: string; state: string }>>) {
      for (const device of devices) {
        if (device.state === "Booted") {
          return device.udid;
        }
      }
    }
  } catch {
    // Fall through
  }

  return "booted";
}

/**
 * Start video recording
 */
export async function startRecording(
  input: z.infer<typeof startRecordingSchema>
): Promise<ToolResult> {
  const { udid, outputPath, codec, mask, force } = input;
  const resolvedUdid = resolveUdid(udid);
  const fullPath = resolve(outputPath);

  // Check if already recording
  if (activeRecordings.has(resolvedUdid)) {
    if (force) {
      // Stop existing recording
      const existing = activeRecordings.get(resolvedUdid)!;
      existing.process.kill("SIGINT");
      activeRecordings.delete(resolvedUdid);
      // Wait a moment for cleanup
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Recording already in progress",
                udid: resolvedUdid,
                currentOutputPath: activeRecordings.get(resolvedUdid)!.outputPath,
                hint: "Use force=true to stop existing recording and start new one, or call stop_recording first",
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

  // Ensure output directory exists
  const outputDir = dirname(fullPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Build command arguments
  const args = [
    "simctl",
    "io",
    resolvedUdid,
    "recordVideo",
    "--codec",
    codec,
    "--mask",
    mask,
    fullPath,
  ];

  // Start recording process
  const recordProcess = spawn("xcrun", args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  // Store the recording info
  activeRecordings.set(resolvedUdid, {
    process: recordProcess,
    outputPath: fullPath,
    startTime: Date.now(),
  });

  // Handle process exit (recording stopped externally or error)
  recordProcess.on("exit", () => {
    activeRecordings.delete(resolvedUdid);
  });

  // Collect any error output (capped to prevent memory issues)
  const MAX_ERROR_BUFFER = 10 * 1024; // 10KB max
  let errorOutput = "";
  recordProcess.stderr?.on("data", (data) => {
    if (errorOutput.length < MAX_ERROR_BUFFER) {
      errorOutput += data.toString().slice(0, MAX_ERROR_BUFFER - errorOutput.length);
    }
  });

  // Wait a moment to ensure recording started
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Check if process is still running
  if (recordProcess.exitCode !== null) {
    activeRecordings.delete(resolvedUdid);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Failed to start recording",
              details: errorOutput || "Recording process exited immediately",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: "Recording started",
            udid: resolvedUdid,
            outputPath: fullPath,
            codec,
            mask,
            hint: "Call stop_recording to finish and save the video",
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Stop video recording
 */
export async function stopRecording(
  input: z.infer<typeof stopRecordingSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const resolvedUdid = resolveUdid(udid);

  const recording = activeRecordings.get(resolvedUdid);
  if (!recording) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "No active recording found",
              udid: resolvedUdid,
              hint: "Start a recording first with start_recording",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const { process: recordProcess, outputPath, startTime } = recording;
  const duration = Math.round((Date.now() - startTime) / 1000);

  // Send SIGINT to gracefully stop recording (allows video to be finalized)
  recordProcess.kill("SIGINT");

  // Wait for process to exit
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      recordProcess.kill("SIGKILL");
      resolve();
    }, 5000);

    recordProcess.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  activeRecordings.delete(resolvedUdid);

  // Verify the file was created
  const fileExists = existsSync(outputPath);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: fileExists ? "Recording stopped and saved" : "Recording stopped (file may not have been saved)",
            udid: resolvedUdid,
            outputPath,
            durationSeconds: duration,
            fileExists,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Get recording status
 */
export async function getRecordingStatus(
  input: z.infer<typeof getRecordingStatusSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const resolvedUdid = resolveUdid(udid);

  const recording = activeRecordings.get(resolvedUdid);

  if (!recording) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              recording: false,
              udid: resolvedUdid,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const { outputPath, startTime } = recording;
  const duration = Math.round((Date.now() - startTime) / 1000);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            recording: true,
            udid: resolvedUdid,
            outputPath,
            durationSeconds: duration,
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
export const videoTools = [
  {
    name: "start_recording",
    title: "Start Video Recording",
    description:
      "Start recording video from the iOS Simulator. The recording continues until stop_recording is called. Useful for creating App Store preview videos or documenting interactions.",
    schema: startRecordingSchema,
    handler: startRecording,
  },
  {
    name: "stop_recording",
    title: "Stop Video Recording",
    description:
      "Stop an active video recording and save the file. The video will be saved to the path specified when starting the recording.",
    schema: stopRecordingSchema,
    handler: stopRecording,
  },
  {
    name: "get_recording_status",
    title: "Get Recording Status",
    description:
      "Check if a video recording is currently in progress and get details about it.",
    schema: getRecordingStatusSchema,
    handler: getRecordingStatus,
  },
];
