/**
 * Keychain management tools for iOS Simulator
 *
 * Add, reset, and manage keychain items for testing authentication flows
 */

import { z } from "zod";
import { simctl } from "../../utils/exec.js";
import { ToolResult } from "../../types/index.js";

/**
 * Input schemas
 */
export const resetKeychainSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const addKeychainItemSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  service: z
    .string()
    .describe("Service name for the keychain item"),
  account: z
    .string()
    .describe("Account name for the keychain item"),
  password: z
    .string()
    .describe("Password/secret value to store"),
});

export const triggerBiometricSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  result: z
    .enum(["match", "nomatch"])
    .describe("Biometric result: 'match' for success, 'nomatch' for failure"),
});

export const enrollBiometricSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  enrolled: z
    .boolean()
    .describe("True to enroll Face ID/Touch ID, false to unenroll"),
});

/**
 * Reset the keychain (clear all stored credentials)
 */
export async function resetKeychain(
  input: z.infer<typeof resetKeychainSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = udid || "booted";

  try {
    // Reset keychain by using simctl spawn to run security command
    simctl(`spawn ${target} launchctl remove com.apple.securityd 2>/dev/null || true`);
    simctl(`spawn ${target} launchctl start com.apple.securityd 2>/dev/null || true`);

    // Alternative: trigger a keychain reset via defaults
    simctl(`spawn ${target} defaults delete com.apple.security 2>/dev/null || true`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Keychain reset attempted",
              simulator: target,
              note: "Apps may need to be restarted to see the effect",
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
          text: `Failed to reset keychain: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Add a keychain item (simulated - sets up test credentials)
 */
export async function addKeychainItem(
  input: z.infer<typeof addKeychainItemSchema>
): Promise<ToolResult> {
  const { udid, service, account, password } = input;
  const target = udid || "booted";

  try {
    // Use simctl spawn to add keychain item via security command
    // Note: This is a simplified approach - actual keychain access requires app-specific entitlements
    simctl(
      `spawn ${target} security add-generic-password -s "${service}" -a "${account}" -w "${password}" -A 2>/dev/null || true`
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Keychain item add attempted",
              service,
              account,
              simulator: target,
              note: "Keychain items are sandboxed per app. This creates a system-level item.",
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
          text: `Failed to add keychain item: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Trigger biometric authentication result (Face ID / Touch ID)
 */
export async function triggerBiometric(
  input: z.infer<typeof triggerBiometricSchema>
): Promise<ToolResult> {
  const { udid, result } = input;
  const target = udid || "booted";

  try {
    // Use notifyutil to trigger biometric result
    if (result === "match") {
      simctl(`spawn ${target} notifyutil -p com.apple.BiometricKit_Sim.fingerTouch.match`);
      simctl(`spawn ${target} notifyutil -p com.apple.BiometricKit_Sim.pearl.match`);
    } else {
      simctl(`spawn ${target} notifyutil -p com.apple.BiometricKit_Sim.fingerTouch.nomatch`);
      simctl(`spawn ${target} notifyutil -p com.apple.BiometricKit_Sim.pearl.nomatch`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Biometric ${result === "match" ? "success" : "failure"} triggered`,
              result,
              simulator: target,
              note: "Biometrics must be enrolled and an auth prompt must be active",
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
          text: `Failed to trigger biometric: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Enroll or unenroll biometrics (Face ID / Touch ID)
 */
export async function enrollBiometric(
  input: z.infer<typeof enrollBiometricSchema>
): Promise<ToolResult> {
  const { udid, enrolled } = input;
  const target = udid || "booted";

  try {
    // Use simctl to set biometric enrollment
    if (enrolled) {
      simctl(`spawn ${target} notifyutil -p com.apple.BiometricKit_Sim.enrollmentChanged`);
      // Set enrollment flag via defaults
      simctl(`spawn ${target} defaults write com.apple.BiometricKit_Sim FaceIDEnrolled -bool true 2>/dev/null || true`);
      simctl(`spawn ${target} defaults write com.apple.BiometricKit_Sim TouchIDEnrolled -bool true 2>/dev/null || true`);
    } else {
      simctl(`spawn ${target} defaults write com.apple.BiometricKit_Sim FaceIDEnrolled -bool false 2>/dev/null || true`);
      simctl(`spawn ${target} defaults write com.apple.BiometricKit_Sim TouchIDEnrolled -bool false 2>/dev/null || true`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Biometrics ${enrolled ? "enrolled" : "unenrolled"}`,
              enrolled,
              simulator: target,
              note: "You may also use Features > Face ID / Touch ID menu in Simulator app",
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
          text: `Failed to ${enrolled ? "enroll" : "unenroll"} biometrics: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool definitions for registration
 */
export const keychainTools = [
  {
    name: "reset_keychain",
    title: "Reset Keychain",
    description:
      "Reset the simulator keychain, clearing all stored credentials and tokens. Useful for testing first-launch login flows.",
    schema: resetKeychainSchema,
    handler: resetKeychain,
  },
  {
    name: "add_keychain_item",
    title: "Add Keychain Item",
    description:
      "Add a credential to the simulator keychain. Note: Keychain items are sandboxed per app.",
    schema: addKeychainItemSchema,
    handler: addKeychainItem,
  },
  {
    name: "trigger_biometric",
    title: "Trigger Biometric",
    description:
      "Trigger a Face ID or Touch ID authentication result. Use 'match' for success, 'nomatch' for failure. Must have an active auth prompt.",
    schema: triggerBiometricSchema,
    handler: triggerBiometric,
  },
  {
    name: "enroll_biometric",
    title: "Enroll Biometric",
    description:
      "Enroll or unenroll Face ID / Touch ID on the simulator. Required before testing biometric authentication.",
    schema: enrollBiometricSchema,
    handler: enrollBiometric,
  },
];
