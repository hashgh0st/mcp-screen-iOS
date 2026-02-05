/**
 * Appearance control tools for iOS Simulator
 *
 * Controls dark mode, locale, text size, and other appearance settings
 */

import { z } from "zod";
import { simctl, execCommand } from "../../utils/exec.js";
import { shellEscape, resolveTarget } from "../../utils/validation.js";
import { ToolResult } from "../../types/index.js";

/**
 * Input schemas for appearance tools
 */
export const setAppearanceSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  mode: z
    .enum(["light", "dark"])
    .describe("Appearance mode to set"),
});

export const getAppearanceSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const setLocaleSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  locale: z
    .string()
    .describe("Locale identifier (e.g., 'en_US', 'ja_JP', 'fr_FR', 'de_DE')"),
  language: z
    .string()
    .optional()
    .describe("Language code (e.g., 'en', 'ja', 'fr'). If not specified, derived from locale."),
});

export const setContentSizeSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  size: z
    .enum([
      "extraSmall",
      "small",
      "medium",
      "large",
      "extraLarge",
      "extraExtraLarge",
      "extraExtraExtraLarge",
      "accessibilityMedium",
      "accessibilityLarge",
      "accessibilityExtraLarge",
      "accessibilityExtraExtraLarge",
      "accessibilityExtraExtraExtraLarge",
    ])
    .describe("Content size category (Dynamic Type)"),
});

export const setAccessibilitySchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  reduceMotion: z
    .boolean()
    .optional()
    .describe("Enable/disable Reduce Motion"),
  reduceTransparency: z
    .boolean()
    .optional()
    .describe("Enable/disable Reduce Transparency"),
  increaseContrast: z
    .boolean()
    .optional()
    .describe("Enable/disable Increase Contrast"),
  differentiateWithoutColor: z
    .boolean()
    .optional()
    .describe("Enable/disable Differentiate Without Color"),
  boldText: z
    .boolean()
    .optional()
    .describe("Enable/disable Bold Text"),
});

export const toggleAppearanceSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

/**
 * Run AppleScript command
 */
function runAppleScript(script: string): string {
  const escaped = script.replace(/"/g, '\\"');
  return execCommand(`osascript -e "${escaped}"`);
}

/**
 * Set appearance mode (light/dark)
 */
export async function setAppearance(
  input: z.infer<typeof setAppearanceSchema>
): Promise<ToolResult> {
  const { udid, mode } = input;
  const target = resolveTarget(udid);

  try {
    // Use simctl ui appearance command
    simctl(`ui ${target} appearance ${mode}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Appearance set to ${mode} mode`,
              mode,
              simulator: target,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // Fall back to AppleScript keyboard shortcut
    try {
      runAppleScript(`
tell application "Simulator" to activate
tell application "System Events"
  keystroke "a" using {command down, shift down}
end tell
`.trim().replace(/\n/g, "\" -e \""));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Appearance toggled (used keyboard shortcut fallback)",
                note: "Could not use simctl ui command directly",
                simulator: target,
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
            text: `Failed to set appearance: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}

/**
 * Get current appearance mode
 */
export async function getAppearance(
  input: z.infer<typeof getAppearanceSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = resolveTarget(udid);

  try {
    const output = simctl(`ui ${target} appearance`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: output.trim().toLowerCase(),
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
          text: `Failed to get appearance: ${error instanceof Error ? error.message : String(error)}. This feature requires Xcode 14+.`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Toggle between light and dark mode
 */
export async function toggleAppearance(
  input: z.infer<typeof toggleAppearanceSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = resolveTarget(udid);

  try {
    // Get current appearance
    const currentOutput = simctl(`ui ${target} appearance`);
    const current = currentOutput.trim().toLowerCase();
    const newMode = current === "dark" ? "light" : "dark";

    // Set new appearance
    simctl(`ui ${target} appearance ${newMode}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Appearance toggled from ${current} to ${newMode}`,
              previousMode: current,
              currentMode: newMode,
              simulator: target,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // Fall back to keyboard shortcut
    try {
      runAppleScript(`
tell application "Simulator" to activate
tell application "System Events"
  keystroke "a" using {command down, shift down}
end tell
`.trim().replace(/\n/g, "\" -e \""));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Appearance toggled (used keyboard shortcut)",
                simulator: target,
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
            text: `Failed to toggle appearance: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}

/**
 * Set locale and language
 */
export async function setLocale(
  input: z.infer<typeof setLocaleSchema>
): Promise<ToolResult> {
  const { udid, locale, language } = input;
  const target = resolveTarget(udid);

  // Derive language from locale if not provided
  const lang = language || locale.split("_")[0];

  try {
    // Use simctl spawn to set locale via defaults command
    // This writes to the simulator's preferences
    simctl(`spawn ${target} defaults write -globalDomain AppleLocale -string ${shellEscape(locale)}`);
    simctl(`spawn ${target} defaults write -globalDomain AppleLanguages -array ${shellEscape(lang)}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Locale and language set successfully",
              locale,
              language: lang,
              simulator: target,
              note: "Restart apps or reboot simulator to apply changes",
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
          text: `Failed to set locale: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Set content size category (Dynamic Type)
 */
export async function setContentSize(
  input: z.infer<typeof setContentSizeSchema>
): Promise<ToolResult> {
  const { udid, size } = input;
  const target = resolveTarget(udid);

  // Map size names to UIContentSizeCategory values
  const sizeMap: Record<string, string> = {
    extraSmall: "UICTContentSizeCategoryXS",
    small: "UICTContentSizeCategoryS",
    medium: "UICTContentSizeCategoryM",
    large: "UICTContentSizeCategoryL",
    extraLarge: "UICTContentSizeCategoryXL",
    extraExtraLarge: "UICTContentSizeCategoryXXL",
    extraExtraExtraLarge: "UICTContentSizeCategoryXXXL",
    accessibilityMedium: "UICTContentSizeCategoryAccessibilityM",
    accessibilityLarge: "UICTContentSizeCategoryAccessibilityL",
    accessibilityExtraLarge: "UICTContentSizeCategoryAccessibilityXL",
    accessibilityExtraExtraLarge: "UICTContentSizeCategoryAccessibilityXXL",
    accessibilityExtraExtraExtraLarge: "UICTContentSizeCategoryAccessibilityXXXL",
  };

  const categoryValue = sizeMap[size];

  try {
    // Set the content size category via defaults
    simctl(
      `spawn ${target} defaults write com.apple.UIKit UIPreferredContentSizeCategoryName -string ${shellEscape(categoryValue)}`
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Content size set successfully",
              size,
              categoryValue,
              simulator: target,
              note: "Restart apps to apply the new text size",
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
          text: `Failed to set content size: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Set accessibility options
 */
export async function setAccessibility(
  input: z.infer<typeof setAccessibilitySchema>
): Promise<ToolResult> {
  const { udid, reduceMotion, reduceTransparency, increaseContrast, differentiateWithoutColor, boldText } = input;
  const target = resolveTarget(udid);

  const applied: string[] = [];
  const errors: string[] = [];

  try {
    if (reduceMotion !== undefined) {
      try {
        simctl(
          `spawn ${target} defaults write com.apple.Accessibility ReduceMotionEnabled -bool ${reduceMotion}`
        );
        applied.push(`reduceMotion: ${reduceMotion}`);
      } catch (e) {
        errors.push(`reduceMotion: ${e}`);
      }
    }

    if (reduceTransparency !== undefined) {
      try {
        simctl(
          `spawn ${target} defaults write com.apple.Accessibility EnhancedBackgroundContrastEnabled -bool ${reduceTransparency}`
        );
        applied.push(`reduceTransparency: ${reduceTransparency}`);
      } catch (e) {
        errors.push(`reduceTransparency: ${e}`);
      }
    }

    if (increaseContrast !== undefined) {
      try {
        simctl(
          `spawn ${target} defaults write com.apple.Accessibility DarkenSystemColors -bool ${increaseContrast}`
        );
        applied.push(`increaseContrast: ${increaseContrast}`);
      } catch (e) {
        errors.push(`increaseContrast: ${e}`);
      }
    }

    if (differentiateWithoutColor !== undefined) {
      try {
        simctl(
          `spawn ${target} defaults write com.apple.Accessibility DifferentiateWithoutColor -bool ${differentiateWithoutColor}`
        );
        applied.push(`differentiateWithoutColor: ${differentiateWithoutColor}`);
      } catch (e) {
        errors.push(`differentiateWithoutColor: ${e}`);
      }
    }

    if (boldText !== undefined) {
      try {
        simctl(
          `spawn ${target} defaults write com.apple.Accessibility BoldTextEnabled -bool ${boldText}`
        );
        applied.push(`boldText: ${boldText}`);
      } catch (e) {
        errors.push(`boldText: ${e}`);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: applied.length > 0 ? "Accessibility settings updated" : "No settings changed",
              applied,
              errors: errors.length > 0 ? errors : undefined,
              simulator: target,
              note: "Some settings may require app restart or simulator reboot to take effect",
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
          text: `Failed to set accessibility options: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool definitions for registration
 */
export const appearanceTools = [
  {
    name: "set_appearance",
    title: "Set Appearance Mode",
    description:
      "Set the simulator appearance to light or dark mode. Useful for capturing screenshots in both modes.",
    schema: setAppearanceSchema,
    handler: setAppearance,
  },
  {
    name: "get_appearance",
    title: "Get Appearance Mode",
    description: "Get the current appearance mode (light or dark) of the simulator.",
    schema: getAppearanceSchema,
    handler: getAppearance,
  },
  {
    name: "toggle_appearance",
    title: "Toggle Appearance",
    description: "Toggle between light and dark mode.",
    schema: toggleAppearanceSchema,
    handler: toggleAppearance,
  },
  {
    name: "set_locale",
    title: "Set Locale",
    description:
      "Set the simulator locale and language. Common locales: en_US, ja_JP, fr_FR, de_DE, zh_CN, es_ES, ko_KR. Requires app restart to take effect.",
    schema: setLocaleSchema,
    handler: setLocale,
  },
  {
    name: "set_content_size",
    title: "Set Content Size",
    description:
      "Set the Dynamic Type content size category. Ranges from extraSmall to accessibilityExtraExtraExtraLarge. Requires app restart.",
    schema: setContentSizeSchema,
    handler: setContentSize,
  },
  {
    name: "set_accessibility",
    title: "Set Accessibility Options",
    description:
      "Configure accessibility options like Reduce Motion, Reduce Transparency, Increase Contrast, Bold Text, and Differentiate Without Color.",
    schema: setAccessibilitySchema,
    handler: setAccessibility,
  },
];
