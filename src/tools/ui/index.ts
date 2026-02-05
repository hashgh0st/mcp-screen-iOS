/**
 * UI interaction tools for iOS Simulator
 *
 * Uses a combination of simctl commands and AppleScript for UI automation
 */

import { z } from "zod";
import { simctl, execCommand } from "../../utils/exec.js";
import { shellEscape, escapeForAppleScript, resolveTarget } from "../../utils/validation.js";
import { ToolResult } from "../../types/index.js";

/**
 * Input schemas for UI tools
 */
export const uiTapSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  x: z
    .number()
    .describe("X coordinate in iOS points (requires Xcode 15+ `simctl ui`)"),
  y: z
    .number()
    .describe("Y coordinate in iOS points (requires Xcode 15+ `simctl ui`)"),
});

export const uiSwipeSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  startX: z
    .number()
    .describe("Starting X coordinate"),
  startY: z
    .number()
    .describe("Starting Y coordinate"),
  endX: z
    .number()
    .describe("Ending X coordinate"),
  endY: z
    .number()
    .describe("Ending Y coordinate"),
  duration: z
    .number()
    .optional()
    .default(0.3)
    .describe("Swipe duration in seconds (best-effort; support depends on `simctl ui`)"),
});

export const uiTypeSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  text: z
    .string()
    .describe("Text to type"),
});

export const uiPressButtonSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  button: z
    .enum([
      "home",
      "lock",
      "volumeUp",
      "volumeDown",
      "shake",
      "screenshot",
      "toggleAppearance",
    ])
    .describe("Hardware button to press"),
});

export const getUiTreeSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const uiScrollSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  direction: z
    .enum(["up", "down", "left", "right"])
    .describe("Scroll direction"),
  distance: z
    .number()
    .optional()
    .default(300)
    .describe("Scroll distance in iOS points"),
  x: z
    .number()
    .optional()
    .describe("X coordinate to start scroll (defaults to center)"),
  y: z
    .number()
    .optional()
    .describe("Y coordinate to start scroll (defaults to center)"),
});

/**
 * Get the Simulator.app window name for a device
 */
function getSimulatorWindowName(udid: string): string {
  // Get device name from simctl
  try {
    const output = simctl(`list devices --json`);
    const data = JSON.parse(output);

    for (const devices of Object.values(data.devices) as Array<Array<{ udid: string; name: string }>>) {
      for (const device of devices) {
        if (device.udid === udid) {
          return device.name;
        }
      }
    }
  } catch {
    // Fall back to generic name
  }
  return "Simulator";
}

/**
 * Get the UDID of the booted simulator
 */
function getBootedUdid(): string | null {
  try {
    const output = simctl(`list devices --json`);
    const data = JSON.parse(output);

    for (const devices of Object.values(data.devices) as Array<Array<{ udid: string; state: string }>>) {
      for (const device of devices) {
        if (device.state === "Booted") {
          return device.udid;
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Execute AppleScript for Simulator interaction.
 * Accepts a multi-line script and splits it into separate -e arguments,
 * using shellEscape on each line to avoid shell metacharacter issues.
 */
function runAppleScript(script: string): string {
  const lines = script.trim().split("\n");
  const args = lines.map((line) => `-e ${shellEscape(line)}`).join(" ");
  return execCommand(`osascript ${args}`);
}

// Use escapeForAppleScript from validation utilities
const escapeAppleScriptString = escapeForAppleScript;

function resolveTargetUdid(udid?: string): string | null {
  if (udid && udid !== "booted") {
    return udid;
  }
  return getBootedUdid();
}

function focusSimulatorWindow(udid?: string): void {
  const resolvedUdid = resolveTargetUdid(udid);
  const windowName = resolvedUdid ? getSimulatorWindowName(resolvedUdid) : null;

  const lines = [
    'tell application "Simulator" to activate',
    'tell application "System Events"',
    '  tell process "Simulator"',
    "    set frontmost to true",
  ];

  if (windowName) {
    const safeWindowName = escapeAppleScriptString(windowName);
    lines.push(`    if exists window "${safeWindowName}" then`);
    lines.push(`      perform action "AXRaise" of window "${safeWindowName}"`);
    lines.push("    end if");
  }

  lines.push("  end tell");
  lines.push("end tell");

  runAppleScript(lines.join("\n"));
}

/**
 * Tap at coordinates using simctl
 */
export async function uiTap(
  input: z.infer<typeof uiTapSchema>
): Promise<ToolResult> {
  const { udid, x, y } = input;
  const target = resolveTarget(udid);

  try {
    // Best-effort focus (simctl doesn't require it, but it helps when mixing tools).
    try {
      focusSimulatorWindow(udid);
    } catch {
      // Ignore focus errors (e.g., missing Automation permission).
    }

    const rx = Math.round(x);
    const ry = Math.round(y);

    const attempts = [
      `ui ${target} tap ${rx} ${ry}`,
      `ui ${target} tap --point ${rx},${ry}`,
      `ui ${target} tap ${rx},${ry}`,
    ];

    let lastError: unknown;
    for (const cmd of attempts) {
      try {
        simctl(cmd);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      return {
        content: [
          {
            type: "text",
            text:
              `Failed to tap via simctl. ` +
              `This requires Xcode 15+ with \`xcrun simctl ui\` support.\n\n` +
              `${lastError instanceof Error ? lastError.message : String(lastError)}`,
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
              message: "Tap executed",
              coordinates: { x, y },
              simulator: target,
              method: "simctl-ui",
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
          text: `Failed to tap: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Swipe gesture using AppleScript
 */
export async function uiSwipe(
  input: z.infer<typeof uiSwipeSchema>
): Promise<ToolResult> {
  const { udid, startX, startY, endX, endY, duration } = input;
  const target = resolveTarget(udid);

  try {
    // Best-effort focus (simctl doesn't require it, but it helps when mixing tools).
    try {
      focusSimulatorWindow(udid);
    } catch {
      // Ignore focus errors (e.g., missing Automation permission).
    }

    const sx = Math.round(startX);
    const sy = Math.round(startY);
    const ex = Math.round(endX);
    const ey = Math.round(endY);

    // Try multiple syntaxes for compatibility across Xcode versions.
    const baseAttempts = [
      `ui ${target} swipe ${sx} ${sy} ${ex} ${ey}`,
      `ui ${target} swipe --from ${sx},${sy} --to ${ex},${ey}`,
      `ui ${target} drag --from ${sx},${sy} --to ${ex},${ey}`,
      `ui ${target} drag ${sx} ${sy} ${ex} ${ey}`,
    ];

    const attempts = [
      ...baseAttempts.map((cmd) => `${cmd} --duration ${duration}`),
      ...baseAttempts,
    ];

    let lastError: unknown;
    for (const cmd of attempts) {
      try {
        simctl(cmd);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      return {
        content: [
          {
            type: "text",
            text:
              `Failed to swipe via simctl. ` +
              `This requires Xcode 15+ with \`xcrun simctl ui\` support.\n\n` +
              `${lastError instanceof Error ? lastError.message : String(lastError)}`,
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
              message: "Swipe gesture executed",
              from: { x: startX, y: startY },
              to: { x: endX, y: endY },
              duration,
              simulator: target,
              method: "simctl-ui",
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
          text: `Failed to swipe: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Type text using simctl keychain or pasteboard
 */
export async function uiType(
  input: z.infer<typeof uiTypeSchema>
): Promise<ToolResult> {
  const { udid, text } = input;
  const target = resolveTarget(udid);

  try {
    focusSimulatorWindow(udid);
    // Method 1: Use simctl io sendkey for each character (slow but reliable)
    // Method 2: Use pasteboard + paste shortcut (fast)

    // Use pasteboard approach for longer text
    if (text.length > 10) {
      // Set pasteboard content using shellEscape for safety
      execCommand(`printf '%s' ${shellEscape(text)} | pbcopy`);

      // Paste using Cmd+V via AppleScript
      const script = `
tell application "Simulator" to activate
delay 0.1
tell application "System Events"
  keystroke "v" using command down
end tell
`;
      runAppleScript(script);
    } else {
      // For short text, use keystroke with proper AppleScript escaping
      const escapedText = escapeForAppleScript(text);
      const script = `
tell application "Simulator" to activate
delay 0.1
tell application "System Events"
  keystroke "${escapedText}"
end tell
`;
      runAppleScript(script);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Text typed successfully",
              text,
              length: text.length,
              method: text.length > 10 ? "pasteboard" : "keystroke",
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
          text: `Failed to type text: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Press hardware button using simctl
 */
export async function uiPressButton(
  input: z.infer<typeof uiPressButtonSchema>
): Promise<ToolResult> {
  const { udid, button } = input;
  const target = resolveTarget(udid);

  try {
    focusSimulatorWindow(udid);
    switch (button) {
      case "home":
        // Home button via simctl
        simctl(`io ${target} enumerate`); // Wake if needed
        // Use AppleScript for home button (Cmd+Shift+H)
        runAppleScript(`
tell application "Simulator" to activate
tell application "System Events"
  keystroke "h" using {command down, shift down}
end tell
`);
        break;

      case "lock":
        // Lock screen (Cmd+L)
        runAppleScript(`
tell application "Simulator" to activate
tell application "System Events"
  keystroke "l" using command down
end tell
`);
        break;

      case "volumeUp":
        // Volume up
        runAppleScript(`
tell application "Simulator" to activate
tell application "System Events"
  key code 126 using command down
end tell
`);
        break;

      case "volumeDown":
        // Volume down
        runAppleScript(`
tell application "Simulator" to activate
tell application "System Events"
  key code 125 using command down
end tell
`);
        break;

      case "shake":
        // Shake gesture (Cmd+Ctrl+Z)
        runAppleScript(`
tell application "Simulator" to activate
tell application "System Events"
  keystroke "z" using {command down, control down}
end tell
`);
        break;

      case "screenshot":
        // Native screenshot (Cmd+S)
        runAppleScript(`
tell application "Simulator" to activate
tell application "System Events"
  keystroke "s" using command down
end tell
`);
        break;

      case "toggleAppearance":
        // Toggle dark/light mode (Cmd+Shift+A)
        runAppleScript(`
tell application "Simulator" to activate
tell application "System Events"
  keystroke "a" using {command down, shift down}
end tell
`);
        break;

      default:
        return {
          content: [{ type: "text", text: `Unknown button: ${button}` }],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: `Button '${button}' pressed`,
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
          text: `Failed to press button: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Get UI accessibility tree using simctl
 */
export async function getUiTree(
  input: z.infer<typeof getUiTreeSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = resolveTarget(udid);

  try {
    // Try simctl ui describe (available in newer Xcode versions)
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
    // Fall back to accessibility inspector approach
    try {
      // Try using accessibility API via spawn (no shell operators)
      const altOutput = simctl(`spawn ${target} accessibility_inspector`);

      return {
        content: [
          {
            type: "text",
            text: altOutput || "UI tree inspection not available. Try using Xcode's Accessibility Inspector manually.",
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: `UI tree inspection failed: ${error instanceof Error ? error.message : String(error)}. This feature requires Xcode 15+ with simctl ui support.`,
          },
        ],
        isError: true,
      };
    }
  }
}

/**
 * Scroll in a direction
 */
export async function uiScroll(
  input: z.infer<typeof uiScrollSchema>
): Promise<ToolResult> {
  const { udid, direction, distance, x, y } = input;
  const target = resolveTarget(udid);

  // Calculate swipe coordinates based on direction
  // Default to center of typical iPhone screen
  const centerX = x ?? 195;
  const centerY = y ?? 422;

  let startX = centerX;
  let startY = centerY;
  let endX = centerX;
  let endY = centerY;

  switch (direction) {
    case "up":
      startY = centerY + distance / 2;
      endY = centerY - distance / 2;
      break;
    case "down":
      startY = centerY - distance / 2;
      endY = centerY + distance / 2;
      break;
    case "left":
      startX = centerX + distance / 2;
      endX = centerX - distance / 2;
      break;
    case "right":
      startX = centerX - distance / 2;
      endX = centerX + distance / 2;
      break;
  }

  // Use the swipe function
  return uiSwipe({
    udid: target === "booted" ? undefined : target,
    startX,
    startY,
    endX,
    endY,
    duration: 0.3,
  });
}

/**
 * Tool definitions for registration
 */
export const uiTools = [
  {
    name: "ui_tap",
    title: "UI Tap",
    description:
      "Tap at specific coordinates in the iOS Simulator. Coordinates are in iOS points. Requires Xcode 15+ with `xcrun simctl ui` support.",
    schema: uiTapSchema,
    handler: uiTap,
  },
  {
    name: "ui_swipe",
    title: "UI Swipe",
    description:
      "Perform a swipe gesture from one point to another (iOS points). Useful for scrolling, dismissing, or navigation gestures. Requires Xcode 15+ with `xcrun simctl ui` support.",
    schema: uiSwipeSchema,
    handler: uiSwipe,
  },
  {
    name: "ui_type",
    title: "UI Type Text",
    description:
      "Type text into the currently focused input field. Uses pasteboard for longer text to improve speed.",
    schema: uiTypeSchema,
    handler: uiType,
  },
  {
    name: "ui_press_button",
    title: "UI Press Button",
    description:
      "Press a hardware button on the simulator: home, lock, volumeUp, volumeDown, shake, screenshot, or toggleAppearance (dark/light mode).",
    schema: uiPressButtonSchema,
    handler: uiPressButton,
  },
  {
    name: "ui_scroll",
    title: "UI Scroll",
    description:
      "Scroll the screen in a direction (up, down, left, right). Optionally specify starting coordinates and distance (iOS points). Requires Xcode 15+ with `xcrun simctl ui` support.",
    schema: uiScrollSchema,
    handler: uiScroll,
  },
  {
    name: "get_ui_tree",
    title: "Get UI Tree",
    description:
      "Get the accessibility tree / UI hierarchy of the current screen. Useful for finding element coordinates for tapping.",
    schema: getUiTreeSchema,
    handler: getUiTree,
  },
];
