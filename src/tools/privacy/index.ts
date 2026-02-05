/**
 * Privacy permissions tools for iOS Simulator
 *
 * Grant, revoke, or reset app permissions using simctl privacy
 */

import { z } from "zod";
import { simctl } from "../../utils/exec.js";
import { ToolResult } from "../../types/index.js";

/**
 * Supported privacy services
 */
const PRIVACY_SERVICES = [
  "all",
  "calendar",
  "contacts-limited",
  "contacts",
  "location",
  "location-always",
  "photos-add",
  "photos",
  "media-library",
  "microphone",
  "motion",
  "reminders",
  "siri",
  "speech-recognition",
  "camera",
  "bluetooth",
  "health",
  "homekit",
  "focus-status",
] as const;

type PrivacyService = (typeof PRIVACY_SERVICES)[number];

/**
 * Input schemas
 */
export const grantPermissionSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier to grant permission to"),
  service: z
    .enum(PRIVACY_SERVICES)
    .describe("Privacy service to grant (e.g., 'camera', 'photos', 'location', 'microphone', 'all')"),
});

export const revokePermissionSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier to revoke permission from"),
  service: z
    .enum(PRIVACY_SERVICES)
    .describe("Privacy service to revoke"),
});

export const resetPermissionSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .optional()
    .describe("App bundle identifier (if omitted, resets for all apps)"),
  service: z
    .enum(PRIVACY_SERVICES)
    .describe("Privacy service to reset (use 'all' to reset all permissions)"),
});

export const grantAllPermissionsSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  bundleId: z
    .string()
    .describe("App bundle identifier to grant all permissions to"),
});

export const listPermissionsSchema = z.object({});

/**
 * Grant a permission to an app
 */
export async function grantPermission(
  input: z.infer<typeof grantPermissionSchema>
): Promise<ToolResult> {
  const { udid, bundleId, service } = input;
  const target = udid || "booted";

  try {
    simctl(`privacy ${target} grant ${service} ${bundleId}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Permission granted successfully`,
              bundleId,
              service,
              action: "grant",
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
          text: `Failed to grant permission: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Revoke a permission from an app
 */
export async function revokePermission(
  input: z.infer<typeof revokePermissionSchema>
): Promise<ToolResult> {
  const { udid, bundleId, service } = input;
  const target = udid || "booted";

  try {
    simctl(`privacy ${target} revoke ${service} ${bundleId}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Permission revoked successfully`,
              bundleId,
              service,
              action: "revoke",
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
          text: `Failed to revoke permission: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Reset permissions to default state
 */
export async function resetPermission(
  input: z.infer<typeof resetPermissionSchema>
): Promise<ToolResult> {
  const { udid, bundleId, service } = input;
  const target = udid || "booted";

  try {
    if (bundleId) {
      simctl(`privacy ${target} reset ${service} ${bundleId}`);
    } else {
      simctl(`privacy ${target} reset ${service}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Permission reset successfully`,
              bundleId: bundleId || "all apps",
              service,
              action: "reset",
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
          text: `Failed to reset permission: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Grant all common permissions to an app
 */
export async function grantAllPermissions(
  input: z.infer<typeof grantAllPermissionsSchema>
): Promise<ToolResult> {
  const { udid, bundleId } = input;
  const target = udid || "booted";

  const commonServices: PrivacyService[] = [
    "camera",
    "microphone",
    "photos",
    "photos-add",
    "location",
    "location-always",
    "contacts",
    "calendar",
    "reminders",
    "media-library",
  ];

  const results: Array<{ service: string; success: boolean; error?: string }> = [];

  for (const service of commonServices) {
    try {
      simctl(`privacy ${target} grant ${service} ${bundleId}`);
      results.push({ service, success: true });
    } catch (error) {
      results.push({
        service,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: `Granted ${successCount} permissions, ${failCount} failed`,
            bundleId,
            simulator: target,
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
 * List available privacy services
 */
export async function listPermissions(
  _input: z.infer<typeof listPermissionsSchema>
): Promise<ToolResult> {
  void _input;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            availableServices: PRIVACY_SERVICES,
            commonServices: {
              camera: "Camera access",
              microphone: "Microphone access",
              photos: "Full photo library access",
              "photos-add": "Add photos only",
              location: "Location when in use",
              "location-always": "Location always",
              contacts: "Full contacts access",
              "contacts-limited": "Limited contacts access",
              calendar: "Calendar access",
              reminders: "Reminders access",
              "media-library": "Media library access",
              bluetooth: "Bluetooth access",
              health: "HealthKit access",
              siri: "Siri access",
              "speech-recognition": "Speech recognition",
              motion: "Motion & fitness",
              homekit: "HomeKit access",
              "focus-status": "Focus status",
              all: "All permissions",
            },
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
export const privacyTools = [
  {
    name: "grant_permission",
    title: "Grant Permission",
    description:
      "Grant a privacy permission to an app. Common services: camera, microphone, photos, location, contacts, calendar.",
    schema: grantPermissionSchema,
    handler: grantPermission,
  },
  {
    name: "revoke_permission",
    title: "Revoke Permission",
    description: "Revoke a previously granted permission from an app.",
    schema: revokePermissionSchema,
    handler: revokePermission,
  },
  {
    name: "reset_permission",
    title: "Reset Permission",
    description:
      "Reset a permission to its default state (will prompt again). Use service 'all' to reset all permissions.",
    schema: resetPermissionSchema,
    handler: resetPermission,
  },
  {
    name: "grant_all_permissions",
    title: "Grant All Permissions",
    description:
      "Grant all common permissions (camera, microphone, photos, location, contacts, calendar, etc.) to an app at once.",
    schema: grantAllPermissionsSchema,
    handler: grantAllPermissions,
  },
  {
    name: "list_permissions",
    title: "List Available Permissions",
    description: "List all available privacy services that can be granted, revoked, or reset.",
    schema: listPermissionsSchema,
    handler: listPermissions,
  },
];
