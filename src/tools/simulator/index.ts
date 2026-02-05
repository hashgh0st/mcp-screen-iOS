/**
 * Simulator management tools
 */

import { z } from "zod";
import { simctl, parseSimctlJson, simctlAsync } from "../../utils/exec.js";
import {
  SimctlListOutput,
  SimulatorDevice,
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
function getLatestRuntime(platform: string = "iOS"): string | null {
  const data = parseSimctlJson<SimctlListOutput>("list runtimes");

  const runtimes = data.runtimes
    .filter((r) => r.isAvailable && r.name.includes(platform))
    .sort((a, b) => {
      const versionA = parseFloat(a.version);
      const versionB = parseFloat(b.version);
      return versionB - versionA;
    });

  return runtimes[0]?.identifier || null;
}

/**
 * Find existing simulator matching device type
 */
function findExistingSimulator(deviceType: string): SimulatorDevice | null {
  const data = parseSimctlJson<SimctlListOutput>("list devices");

  for (const devices of Object.values(data.devices)) {
    const match = devices.find(
      (d) => d.deviceTypeIdentifier === deviceType && d.isAvailable
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

  // Check for existing simulator if keepExisting is true
  if (keepExisting) {
    const existing = findExistingSimulator(deviceConfig.deviceType);
    if (existing) {
      if (existing.state !== "Booted") {
        simctl(`boot ${existing.udid}`);
        // Wait for boot to complete
        await simctlAsync(`bootstatus ${existing.udid}`, { timeout: 120000 });
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
                primaryResolution: deviceConfig.primaryResolution,
                acceptedResolutions: deviceConfig.acceptedResolutions,
                appStoreClass: deviceConfig.appStoreClass,
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
  const udid = simctl(`create "${simulatorName}" ${deviceConfig.deviceType} ${runtimeId}`);

  // Boot the simulator
  simctl(`boot ${udid}`);

  // Wait for boot to complete
  await simctlAsync(`bootstatus ${udid}`, { timeout: 120000 });

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
            deviceType: deviceConfig.deviceType,
            runtime: runtimeId,
            primaryResolution: deviceConfig.primaryResolution,
            acceptedResolutions: deviceConfig.acceptedResolutions,
            appStoreClass: deviceConfig.appStoreClass,
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
  const target = udid || "booted";

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
      "Create and boot a simulator matching App Store screenshot requirements. Supports iPhone 6.9\" (iPhone 16 Pro Max) and iPad 13\" (iPad Pro M4) - the only two required sizes for App Store screenshots.",
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
