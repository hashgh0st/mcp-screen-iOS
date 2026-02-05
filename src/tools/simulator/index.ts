/**
 * Simulator management tools
 */

import { z } from "zod";
import { simctl, parseSimctlJson, simctlAsync } from "../../utils/exec.js";
import { resolveTarget } from "../../utils/validation.js";
import {
  SimctlListOutput,
  SimulatorDevice,
  AppStoreDeviceConfig,
  APP_STORE_DEVICES,
  ToolResult,
} from "../../types/index.js";

/**
 * Input schemas for simulator tools
 */
export const listSimulatorsSchema = z.object({
  deviceFamily: z
    .enum(["iphone", "ipad", "watch", "tv", "all"])
    .optional()
    .default("all")
    .describe("Filter by device family"),
  onlyAvailable: z
    .boolean()
    .optional()
    .default(true)
    .describe("Only show available simulators"),
  onlyBooted: z
    .boolean()
    .optional()
    .default(false)
    .describe("Only show booted simulators"),
});

export const bootAppStoreSimulatorSchema = z.object({
  deviceClass: z
    .enum(["iphone_6.9", "ipad_13"])
    .describe("App Store device class to create"),
  runtime: z
    .string()
    .optional()
    .describe("iOS runtime identifier (defaults to latest available)"),
  keepExisting: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, reuse existing simulator with same device type"),
});

export const shutdownSimulatorSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted' for all booted simulators)"),
  delete: z
    .boolean()
    .optional()
    .default(false)
    .describe("Delete the simulator after shutdown"),
});

export const getBootedSimulatorSchema = z.object({});

/**
 * List available simulators
 */
export async function listSimulators(
  input: z.infer<typeof listSimulatorsSchema>
): Promise<ToolResult> {
  const { deviceFamily, onlyAvailable, onlyBooted } = input;

  const data = parseSimctlJson<SimctlListOutput>("list devices");
  const results: Array<{
    runtime: string;
    devices: SimulatorDevice[];
  }> = [];

  for (const [runtimeId, devices] of Object.entries(data.devices)) {
    let filteredDevices = devices;

    // Filter by availability
    if (onlyAvailable) {
      filteredDevices = filteredDevices.filter((d) => d.isAvailable);
    }

    // Filter by booted state
    if (onlyBooted) {
      filteredDevices = filteredDevices.filter((d) => d.state === "Booted");
    }

    // Filter by device family
    if (deviceFamily !== "all") {
      const familyMap: Record<string, string[]> = {
        iphone: ["iPhone"],
        ipad: ["iPad"],
        watch: ["Apple Watch"],
        tv: ["Apple TV"],
      };
      const familyNames = familyMap[deviceFamily] || [];
      filteredDevices = filteredDevices.filter((d) =>
        familyNames.some((name) => d.name.includes(name))
      );
    }

    if (filteredDevices.length > 0) {
      results.push({
        runtime: runtimeId,
        devices: filteredDevices,
      });
    }
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
}

/**
 * Get the latest available iOS runtime
 */
function compareVersionStrings(a: string, b: string): number {
  const partsA = a.split(".").map((part) => Number.parseInt(part, 10));
  const partsB = b.split(".").map((part) => Number.parseInt(part, 10));
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const va = Number.isFinite(partsA[i]) ? partsA[i] : 0;
    const vb = Number.isFinite(partsB[i]) ? partsB[i] : 0;
    if (va !== vb) {
      return vb - va; // descending
    }
  }

  return 0;
}

function getLatestRuntime(platform: string = "iOS"): string | null {
  const data = parseSimctlJson<SimctlListOutput>("list runtimes");

  const runtimes = data.runtimes
    .filter((r) => r.isAvailable && r.name.includes(platform))
    .sort((a, b) => compareVersionStrings(a.version, b.version));

  return runtimes[0]?.identifier || null;
}

function resolveDeviceType(
  deviceConfig: AppStoreDeviceConfig
): { deviceType: string; warning?: string } | { error: string } {
  try {
    const data = parseSimctlJson<{ devicetypes: SimctlListOutput["devicetypes"] }>("list devicetypes");
    const available = new Set(data.devicetypes.map((type) => type.identifier));
    const requested = [
      deviceConfig.deviceType,
      ...(deviceConfig.alternateDeviceTypes || []),
    ];
    const selected = requested.find((type) => available.has(type));

    if (!selected) {
      return {
        error:
          "None of the requested device types are available in Xcode: " +
          requested.join(", ") +
          ". Run \"xcrun simctl list devicetypes\" to verify installed runtimes and device types.",
      };
    }

    if (selected !== deviceConfig.deviceType) {
      return {
        deviceType: selected,
        warning: `Primary device type ${deviceConfig.deviceType} not available; using ${selected} instead.`,
      };
    }

    return { deviceType: selected };
  } catch {
    return { deviceType: deviceConfig.deviceType };
  }
}

/**
 * Find existing simulator matching device type
 */
function findExistingSimulator(deviceType: string, alternateDeviceTypes?: string[]): SimulatorDevice | null {
  const data = parseSimctlJson<SimctlListOutput>("list devices");
  const validTypes = new Set([deviceType, ...(alternateDeviceTypes || [])]);

  for (const devices of Object.values(data.devices)) {
    const match = devices.find(
      (d) => validTypes.has(d.deviceTypeIdentifier) && d.isAvailable
    );
    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * Boot or create an App Store simulator
 */
export async function bootAppStoreSimulator(
  input: z.infer<typeof bootAppStoreSimulatorSchema>
): Promise<ToolResult> {
  const { deviceClass, runtime, keepExisting } = input;

  const deviceConfig = APP_STORE_DEVICES[deviceClass];
  if (!deviceConfig) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown device class: ${deviceClass}. Available: ${Object.keys(APP_STORE_DEVICES).join(", ")}`,
        },
      ],
      isError: true,
    };
  }

  const resolvedDeviceType = resolveDeviceType(deviceConfig);
  if ("error" in resolvedDeviceType) {
    return {
      content: [
        {
          type: "text",
          text: resolvedDeviceType.error,
        },
      ],
      isError: true,
    };
  }

  // Check for existing simulator if keepExisting is true
  if (keepExisting) {
    const existing = findExistingSimulator(deviceConfig.deviceType, deviceConfig.alternateDeviceTypes);
    if (existing) {
      if (existing.state !== "Booted") {
        try {
          simctl(`boot ${existing.udid}`);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to boot existing simulator: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
        // Wait for boot to complete
        try {
          await simctlAsync(`bootstatus ${existing.udid}`, { timeout: 120000 });
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Simulator boot timed out or failed: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Reused existing simulator",
                udid: existing.udid,
                name: existing.name,
                deviceClass,
                deviceType: existing.deviceTypeIdentifier,
                primaryResolution: deviceConfig.primaryResolution,
                acceptedResolutions: deviceConfig.acceptedResolutions,
                appStoreClass: deviceConfig.appStoreClass,
                ...(resolvedDeviceType.warning ? { note: resolvedDeviceType.warning } : {}),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  // Determine runtime
  const runtimeId = runtime || getLatestRuntime("iOS");
  if (!runtimeId) {
    return {
      content: [
        {
          type: "text",
          text: "No iOS runtime found. Please install Xcode and iOS Simulator runtimes.",
        },
      ],
      isError: true,
    };
  }

  // Create new simulator
  const simulatorName = `AppStore-${deviceClass}-${Date.now()}`;
  let udid: string;
  try {
    udid = simctl(`create "${simulatorName}" ${resolvedDeviceType.deviceType} ${runtimeId}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to create simulator: ${error instanceof Error ? error.message : String(error)}. Ensure the device type ${resolvedDeviceType.deviceType} is available in Xcode.`,
        },
      ],
      isError: true,
    };
  }

  // Boot the simulator
  try {
    simctl(`boot ${udid}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to boot simulator: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }

  // Wait for boot to complete
  try {
    await simctlAsync(`bootstatus ${udid}`, { timeout: 120000 });
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Simulator boot timed out or failed: ${error instanceof Error ? error.message : String(error)}`,
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
            message: "Created and booted new simulator",
            udid,
            name: simulatorName,
            deviceClass,
            deviceType: resolvedDeviceType.deviceType,
            runtime: runtimeId,
            primaryResolution: deviceConfig.primaryResolution,
            acceptedResolutions: deviceConfig.acceptedResolutions,
            appStoreClass: deviceConfig.appStoreClass,
            ...(resolvedDeviceType.warning ? { note: resolvedDeviceType.warning } : {}),
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Shutdown a simulator
 */
export async function shutdownSimulator(
  input: z.infer<typeof shutdownSimulatorSchema>
): Promise<ToolResult> {
  const { udid, delete: shouldDelete } = input;
  const target = resolveTarget(udid);

  try {
    simctl(`shutdown ${target}`);

    if (shouldDelete && udid) {
      // Can only delete specific simulators, not "booted"
      simctl(`delete ${udid}`);
      return {
        content: [
          {
            type: "text",
            text: `Simulator ${udid} shutdown and deleted successfully`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Simulator ${target} shutdown successfully`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to shutdown simulator: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Get the currently booted simulator
 */
export async function getBootedSimulator(
  _input: z.infer<typeof getBootedSimulatorSchema>
): Promise<ToolResult> {
  void _input;
  const data = parseSimctlJson<SimctlListOutput>("list devices");

  const bootedDevices: Array<SimulatorDevice & { runtime: string }> = [];

  for (const [runtimeId, devices] of Object.entries(data.devices)) {
    for (const device of devices) {
      if (device.state === "Booted") {
        bootedDevices.push({ ...device, runtime: runtimeId });
      }
    }
  }

  if (bootedDevices.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No simulators are currently booted",
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(bootedDevices, null, 2),
      },
    ],
  };
}

/**
 * Tool definitions for registration
 */
export const simulatorTools = [
  {
    name: "list_simulators",
    title: "List iOS Simulators",
    description:
      "List available iOS simulator devices with their UDIDs, states, and device information. Filter by device family (iPhone, iPad), availability, or booted state.",
    schema: listSimulatorsSchema,
    handler: listSimulators,
  },
  {
    name: "boot_appstore_simulator",
    title: "Boot App Store Simulator",
    description:
      "Create and boot a simulator matching App Store screenshot requirements. Supports iPhone 6.9\" (iPhone 17 Pro Max) and iPad 13\" (iPad Pro M5) - the only two required sizes for App Store screenshots.",
    schema: bootAppStoreSimulatorSchema,
    handler: bootAppStoreSimulator,
  },
  {
    name: "shutdown_simulator",
    title: "Shutdown Simulator",
    description:
      "Shutdown a running iOS simulator. Optionally delete the simulator after shutdown.",
    schema: shutdownSimulatorSchema,
    handler: shutdownSimulator,
  },
  {
    name: "get_booted_simulator",
    title: "Get Booted Simulator",
    description:
      "Get information about the currently booted simulator(s), including UDID, name, and runtime.",
    schema: getBootedSimulatorSchema,
    handler: getBootedSimulator,
  },
];
