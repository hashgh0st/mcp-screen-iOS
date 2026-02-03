/**
 * System alerts tools for iOS Simulator
 *
 * Handle, dismiss, and interact with system dialogs and alerts
 */

import { z } from "zod";
import { execCommand } from "../../utils/exec.js";
import { ToolResult } from "../../types/index.js";

/**
 * Input schemas
 */
export const acceptAlertSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const dismissAlertSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const triggerSiriSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const sendMemoryWarningSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const triggerICloudSyncSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

/**
 * Run AppleScript command
 */
function runAppleScript(script: string): string {
  const lines = script.trim().split("\n");
  const args = lines.map((line) => `-e "${line.replace(/"/g, '\\"')}"`).join(" ");
  return execCommand(`osascript ${args}`);
}

/**
 * Accept/tap the primary button on a system alert (Allow, OK, etc.)
 */
export async function acceptAlert(
  input: z.infer<typeof acceptAlertSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = udid || "booted";

  try {
    // Use AppleScript to click the first button (usually "Allow" or "OK")
    const script = `
tell application "Simulator" to activate
delay 0.3
tell application "System Events"
  tell process "Simulator"
    try
      click button 1 of sheet 1 of window 1
    on error
      try
        click button 2 of sheet 1 of window 1
      on error
        -- Try clicking any visible button with common accept labels
        click (first button whose name contains "Allow" or name contains "OK" or name contains "Yes" or name contains "Continue") of window 1
      end try
    end try
  end tell
end tell
`;
    runAppleScript(script);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Attempted to accept alert",
              action: "accept",
              simulator: target,
              note: "If no alert was present, this has no effect",
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
          text: `Failed to accept alert: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Dismiss/tap the secondary button on a system alert (Don't Allow, Cancel, etc.)
 */
export async function dismissAlert(
  input: z.infer<typeof dismissAlertSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = udid || "booted";

  try {
    // Use AppleScript to click dismiss button
    const script = `
tell application "Simulator" to activate
delay 0.3
tell application "System Events"
  tell process "Simulator"
    try
      click button 2 of sheet 1 of window 1
    on error
      try
        click button 1 of sheet 1 of window 1
      on error
        -- Try clicking any visible button with common dismiss labels
        click (first button whose name contains "Don't Allow" or name contains "Cancel" or name contains "No" or name contains "Deny") of window 1
      end try
    end try
  end tell
end tell
`;
    runAppleScript(script);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Attempted to dismiss alert",
              action: "dismiss",
              simulator: target,
              note: "If no alert was present, this has no effect",
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
          text: `Failed to dismiss alert: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Trigger Siri
 */
export async function triggerSiri(
  input: z.infer<typeof triggerSiriSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = udid || "booted";

  try {
    // Long press home button or use Siri keyboard shortcut
    const script = `
tell application "Simulator" to activate
delay 0.2
tell application "System Events"
  -- Trigger Siri via keyboard shortcut
  key down option
  delay 0.5
  key up option
end tell
`;
    runAppleScript(script);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Siri triggered",
              simulator: target,
              note: "Siri will activate if enabled on the simulator",
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
          text: `Failed to trigger Siri: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Send memory warning to running apps
 */
export async function sendMemoryWarning(
  input: z.infer<typeof sendMemoryWarningSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = udid || "booted";

  try {
    // Use Simulator menu to send memory warning
    const script = `
tell application "Simulator" to activate
delay 0.2
tell application "System Events"
  tell process "Simulator"
    click menu item "Simulate Memory Warning" of menu "Debug" of menu bar 1
  end tell
end tell
`;
    runAppleScript(script);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Memory warning sent",
              simulator: target,
              note: "Running apps will receive didReceiveMemoryWarning",
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
          text: `Failed to send memory warning: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Trigger iCloud sync
 */
export async function triggerICloudSync(
  input: z.infer<typeof triggerICloudSyncSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = udid || "booted";

  try {
    // Use Simulator menu to trigger iCloud sync
    const script = `
tell application "Simulator" to activate
delay 0.2
tell application "System Events"
  tell process "Simulator"
    click menu item "Trigger iCloud Sync" of menu "Debug" of menu bar 1
  end tell
end tell
`;
    runAppleScript(script);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "iCloud sync triggered",
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
          text: `Failed to trigger iCloud sync: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool definitions for registration
 */
export const alertTools = [
  {
    name: "accept_alert",
    title: "Accept Alert",
    description:
      "Accept/tap the primary button (Allow, OK, Yes) on a system alert or permission dialog. Useful for automating permission grants.",
    schema: acceptAlertSchema,
    handler: acceptAlert,
  },
  {
    name: "dismiss_alert",
    title: "Dismiss Alert",
    description:
      "Dismiss/tap the secondary button (Don't Allow, Cancel, No) on a system alert. Useful for declining permissions.",
    schema: dismissAlertSchema,
    handler: dismissAlert,
  },
  {
    name: "trigger_siri",
    title: "Trigger Siri",
    description: "Activate Siri on the simulator for testing voice assistant integration.",
    schema: triggerSiriSchema,
    handler: triggerSiri,
  },
  {
    name: "send_memory_warning",
    title: "Send Memory Warning",
    description:
      "Send a simulated memory warning to all running apps. Apps will receive didReceiveMemoryWarning.",
    schema: sendMemoryWarningSchema,
    handler: sendMemoryWarning,
  },
  {
    name: "trigger_icloud_sync",
    title: "Trigger iCloud Sync",
    description: "Trigger an iCloud sync for apps using CloudKit or iCloud storage.",
    schema: triggerICloudSyncSchema,
    handler: triggerICloudSync,
  },
];
