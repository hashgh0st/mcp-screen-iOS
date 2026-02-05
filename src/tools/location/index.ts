/**
 * Location simulation tools for iOS Simulator
 *
 * Set GPS coordinates, simulate routes, and clear location overrides
 */

import { z } from "zod";
import { simctl } from "../../utils/exec.js";
import { shellEscape, validatePath, resolveTarget } from "../../utils/validation.js";
import { ToolResult } from "../../types/index.js";

/**
 * Preset locations for common use cases
 */
const PRESET_LOCATIONS: Record<string, { latitude: number; longitude: number; name: string }> = {
  apple_park: { latitude: 37.3349, longitude: -122.0090, name: "Apple Park, Cupertino" },
  san_francisco: { latitude: 37.7749, longitude: -122.4194, name: "San Francisco" },
  new_york: { latitude: 40.7128, longitude: -74.0060, name: "New York City" },
  london: { latitude: 51.5074, longitude: -0.1278, name: "London" },
  tokyo: { latitude: 35.6762, longitude: 139.6503, name: "Tokyo" },
  paris: { latitude: 48.8566, longitude: 2.3522, name: "Paris" },
  sydney: { latitude: -33.8688, longitude: 151.2093, name: "Sydney" },
  berlin: { latitude: 52.5200, longitude: 13.4050, name: "Berlin" },
  dubai: { latitude: 25.2048, longitude: 55.2708, name: "Dubai" },
  singapore: { latitude: 1.3521, longitude: 103.8198, name: "Singapore" },
};

/**
 * Input schemas
 */
export const setLocationSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .describe("Latitude coordinate (-90 to 90)"),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .describe("Longitude coordinate (-180 to 180)"),
});

export const setPresetLocationSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  preset: z
    .enum([
      "apple_park",
      "san_francisco",
      "new_york",
      "london",
      "tokyo",
      "paris",
      "sydney",
      "berlin",
      "dubai",
      "singapore",
    ])
    .describe("Preset location name"),
});

export const clearLocationSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
});

export const simulateRouteSchema = z.object({
  udid: z
    .string()
    .optional()
    .describe("Simulator UDID (defaults to 'booted')"),
  gpxFile: z
    .string()
    .describe("Path to GPX file containing the route"),
});

export const listPresetLocationsSchema = z.object({});

/**
 * Set a specific GPS location
 */
export async function setLocation(
  input: z.infer<typeof setLocationSchema>
): Promise<ToolResult> {
  const { udid, latitude, longitude } = input;
  const target = resolveTarget(udid);

  try {
    simctl(`location ${target} set ${latitude},${longitude}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Location set successfully",
              latitude,
              longitude,
              mapsUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
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
          text: `Failed to set location: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Set location to a preset city
 */
export async function setPresetLocation(
  input: z.infer<typeof setPresetLocationSchema>
): Promise<ToolResult> {
  const { udid, preset } = input;
  const target = resolveTarget(udid);

  const location = PRESET_LOCATIONS[preset];
  if (!location) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown preset: ${preset}. Use list_preset_locations to see available options.`,
        },
      ],
      isError: true,
    };
  }

  try {
    simctl(`location ${target} set ${location.latitude},${location.longitude}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Location set successfully",
              preset,
              name: location.name,
              latitude: location.latitude,
              longitude: location.longitude,
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
          text: `Failed to set location: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Clear location override and return to default
 */
export async function clearLocation(
  input: z.infer<typeof clearLocationSchema>
): Promise<ToolResult> {
  const { udid } = input;
  const target = resolveTarget(udid);

  try {
    simctl(`location ${target} clear`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Location cleared - using default/none",
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
          text: `Failed to clear location: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Simulate a route from a GPX file
 */
export async function simulateRoute(
  input: z.infer<typeof simulateRouteSchema>
): Promise<ToolResult> {
  const { udid, gpxFile } = input;
  const target = resolveTarget(udid);

  try {
    const validatedPath = validatePath(gpxFile);
    simctl(`location ${target} start ${shellEscape(validatedPath)}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Route simulation started",
              gpxFile,
              simulator: target,
              note: "Use clear_location to stop the route simulation",
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
          text: `Failed to start route simulation: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * List available preset locations
 */
export async function listPresetLocations(
  _input: z.infer<typeof listPresetLocationsSchema>
): Promise<ToolResult> {
  void _input;
  const presets = Object.entries(PRESET_LOCATIONS).map(([key, loc]) => ({
    preset: key,
    name: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            presetLocations: presets,
            usage: "Use set_preset_location with any preset name",
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
export const locationTools = [
  {
    name: "set_location",
    title: "Set Location",
    description:
      "Set the simulator GPS location to specific coordinates. Useful for testing location-based features.",
    schema: setLocationSchema,
    handler: setLocation,
  },
  {
    name: "set_preset_location",
    title: "Set Preset Location",
    description:
      "Set location to a preset city: apple_park, san_francisco, new_york, london, tokyo, paris, sydney, berlin, dubai, singapore.",
    schema: setPresetLocationSchema,
    handler: setPresetLocation,
  },
  {
    name: "clear_location",
    title: "Clear Location",
    description: "Clear the location override and return to default behavior.",
    schema: clearLocationSchema,
    handler: clearLocation,
  },
  {
    name: "simulate_route",
    title: "Simulate Route",
    description:
      "Simulate movement along a route defined in a GPX file. Useful for testing navigation apps.",
    schema: simulateRouteSchema,
    handler: simulateRoute,
  },
  {
    name: "list_preset_locations",
    title: "List Preset Locations",
    description: "List all available preset locations with their coordinates.",
    schema: listPresetLocationsSchema,
    handler: listPresetLocations,
  },
];
