/**
 * Type definitions for the App Store Screenshot MCP server
 */

/**
 * Simulator device information from simctl list
 */
export interface SimulatorDevice {
  udid: string;
  name: string;
  state: "Shutdown" | "Booted" | "Creating" | "Booting" | "ShuttingDown";
  isAvailable: boolean;
  deviceTypeIdentifier: string;
  dataPath?: string;
  logPath?: string;
}

/**
 * Simulator runtime information
 */
export interface SimulatorRuntime {
  bundlePath: string;
  buildversion: string;
  platform: string;
  runtimeRoot: string;
  identifier: string;
  version: string;
  isInternal: boolean;
  isAvailable: boolean;
  name: string;
  supportedDeviceTypes: Array<{
    bundlePath: string;
    name: string;
    identifier: string;
    productFamily: string;
  }>;
}

/**
 * Device type information
 */
export interface DeviceType {
  name: string;
  identifier: string;
  productFamily: string;
  minRuntimeVersion?: number;
  maxRuntimeVersion?: number;
}

/**
 * Full simctl list output structure
 */
export interface SimctlListOutput {
  devicetypes: DeviceType[];
  runtimes: SimulatorRuntime[];
  devices: Record<string, SimulatorDevice[]>;
  pairs?: Record<string, unknown>;
}

/**
 * App Store device class configuration
 */
export interface AppStoreDeviceConfig {
  name: string;
  deviceType: string;
  primaryResolution: {
    width: number;
    height: number;
  };
  acceptedResolutions: Array<{
    width: number;
    height: number;
  }>;
  appStoreClass: string;
}

/**
 * App Store device presets - 2026 requirements
 */
export const APP_STORE_DEVICES: Record<string, AppStoreDeviceConfig> = {
  "iphone_6.9": {
    name: "iPhone 17 Pro Max",
    deviceType: "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max",
    primaryResolution: { width: 1320, height: 2868 },
    acceptedResolutions: [
      { width: 1320, height: 2868 },
      { width: 1290, height: 2796 },
      { width: 1260, height: 2736 },
    ],
    appStoreClass: "6.9 inch",
  },
  "ipad_13": {
    name: "iPad Pro 13-inch (M5)",
    deviceType: "com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB",
    primaryResolution: { width: 2064, height: 2752 },
    acceptedResolutions: [
      { width: 2064, height: 2752 },
      { width: 2048, height: 2732 },
    ],
    appStoreClass: "13 inch",
  },
};

/**
 * Screenshot capture options
 */
export interface ScreenshotOptions {
  type?: "png" | "jpeg" | "tiff" | "bmp" | "gif" | "pdf";
  display?: "internal" | "external";
  mask?: "ignored" | "alpha" | "black";
}

/**
 * Status bar override options
 */
export interface StatusBarOptions {
  time?: string;
  dataNetwork?: "wifi" | "3g" | "4g" | "lte" | "lte-a" | "lte+" | "5g" | "5g+" | "5g-uwb";
  wifiMode?: "searching" | "failed" | "active";
  wifiBars?: 0 | 1 | 2 | 3;
  cellularMode?: "notSupported" | "searching" | "failed" | "active";
  cellularBars?: 0 | 1 | 2 | 3 | 4;
  operatorName?: string;
  batteryState?: "charging" | "charged" | "discharging";
  batteryLevel?: number;
}

/**
 * Tool result content types
 */
export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export type ToolContent = TextContent | ImageContent;

export interface ToolResult {
  [x: string]: unknown;
  content: ToolContent[];
  isError?: boolean;
}
