/**
 * Push notification tools for iOS Simulator
 *
 * Send simulated push notifications using simctl push
 */

import { z } from "zod";
import { writeFileSync, unlinkSync } from "fs";
import { simctl } from "../../utils/exec.js";
import { ToolResult } from "../../types/index.js";

/**
 * Input schemas
 */
export const sendNotificationSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier to receive the notification"),
  title: z
    .string()
    .describe("Notification title"),
  body: z
    .string()
    .describe("Notification body text"),
  subtitle: z
    .string()
    .optional()
    .describe("Notification subtitle"),
  badge: z
    .number()
    .optional()
    .describe("Badge number to display on app icon"),
  sound: z
    .string()
    .optional()
    .default("default")
    .describe("Sound to play (use 'default' or custom sound name)"),
  category: z
    .string()
    .optional()
    .describe("Notification category identifier for actions"),
  threadId: z
    .string()
    .optional()
    .describe("Thread identifier for grouping notifications"),
  customData: z
    .record(z.unknown())
    .optional()
    .describe("Custom data payload to include"),
});

export const sendRawNotificationSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier"),
  payload: z
    .string()
    .describe("Raw APNS JSON payload string"),
});

export const sendSilentNotificationSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier"),
  customData: z
    .record(z.unknown())
    .optional()
    .describe("Custom data payload for background processing"),
});

/**
 * Build APNS payload from options
 */
function buildPayload(options: {
  title: string;
  body: string;
  subtitle?: string;
  badge?: number;
  sound?: string;
  category?: string;
  threadId?: string;
  customData?: Record<string, unknown>;
}): object {
  const aps: Record<string, unknown> = {
    alert: {
      title: options.title,
      body: options.body,
      ...(options.subtitle && { subtitle: options.subtitle }),
    },
    ...(options.sound && { sound: options.sound }),
    ...(options.badge !== undefined && { badge: options.badge }),
    ...(options.category && { category: options.category }),
    ...(options.threadId && { "thread-id": options.threadId }),
  };

  return {
    aps,
    ...options.customData,
  };
}

/**
 * Send a push notification
 */
export async function sendNotification(
  input: z.infer<typeof sendNotificationSchema>
): Promise<ToolResult> {
  const { udid, bundleId, title, body, subtitle, badge, sound, category, threadId, customData } = input;
  const target = udid || "booted";

  const payload = buildPayload({
    title,
    body,
    subtitle,
    badge,
    sound,
    category,
    threadId,
    customData,
  });

  const tempPath = `/tmp/notification-${Date.now()}.json`;

  try {
    // Write payload to temp file
    writeFileSync(tempPath, JSON.stringify(payload, null, 2));

    // Send notification
    simctl(`push ${target} ${bundleId} "${tempPath}"`);

    // Cleanup
    unlinkSync(tempPath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Notification sent successfully",
              bundleId,
              title,
              body,
              simulator: target,
              payload,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // Cleanup on error
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to send notification: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Send a raw APNS notification payload
 */
export async function sendRawNotification(
  input: z.infer<typeof sendRawNotificationSchema>
): Promise<ToolResult> {
  const { udid, bundleId, payload } = input;
  const target = udid || "booted";

  const tempPath = `/tmp/notification-${Date.now()}.json`;

  try {
    // Validate JSON
    const parsed = JSON.parse(payload);

    // Write payload to temp file
    writeFileSync(tempPath, JSON.stringify(parsed, null, 2));

    // Send notification
    simctl(`push ${target} ${bundleId} "${tempPath}"`);

    // Cleanup
    unlinkSync(tempPath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Raw notification sent successfully",
              bundleId,
              simulator: target,
              payload: parsed,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // Cleanup on error
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    if (error instanceof SyntaxError) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid JSON payload: ${error.message}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to send notification: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Send a silent (background) notification
 */
export async function sendSilentNotification(
  input: z.infer<typeof sendSilentNotificationSchema>
): Promise<ToolResult> {
  const { udid, bundleId, customData } = input;
  const target = udid || "booted";

  const payload = {
    aps: {
      "content-available": 1,
    },
    ...customData,
  };

  const tempPath = `/tmp/notification-${Date.now()}.json`;

  try {
    // Write payload to temp file
    writeFileSync(tempPath, JSON.stringify(payload, null, 2));

    // Send notification
    simctl(`push ${target} ${bundleId} "${tempPath}"`);

    // Cleanup
    unlinkSync(tempPath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Silent notification sent successfully",
              bundleId,
              simulator: target,
              note: "App will receive background fetch if enabled",
              payload,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // Cleanup on error
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to send silent notification: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool definitions for registration
 */
export const notificationTools = [
  {
    name: "send_notification",
    title: "Send Push Notification",
    description:
      "Send a push notification to an app in the simulator. Useful for capturing notification UI screenshots.",
    schema: sendNotificationSchema,
    handler: sendNotification,
  },
  {
    name: "send_raw_notification",
    title: "Send Raw Notification",
    description:
      "Send a raw APNS JSON payload as a push notification. Use for complex notification payloads.",
    schema: sendRawNotificationSchema,
    handler: sendRawNotification,
  },
  {
    name: "send_silent_notification",
    title: "Send Silent Notification",
    description:
      "Send a silent (content-available) notification for background fetch. Does not show UI.",
    schema: sendSilentNotificationSchema,
    handler: sendSilentNotification,
  },
];
