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
  resolution: {
    width: number;
    height: number;
  };
  appStoreClass: string;
}

/**
 * App Store device presets - only the two required sizes
 */
export const APP_STORE_DEVICES: Record<string, AppStoreDeviceConfig> = {
  "iphone_6.9": {
    name: "iPhone 16 Pro Max",
    deviceType: "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro-Max",
    resolution: { width: 1320, height: 2868 },
    appStoreClass: "6.9 inch",
  },
  "iphone_6.7": {
    name: "iPhone 15 Pro Max",
    deviceType: "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro-Max",
    resolution: { width: 1290, height: 2796 },
    appStoreClass: "6.7 inch",
  },
  "ipad_13": {
    name: "iPad Pro 13-inch (M4)",
    deviceType: "com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M4",
    resolution: { width: 2064, height: 2752 },
    appStoreClass: "13 inch",
  },
  "ipad_12.9": {
    name: "iPad Pro (12.9-inch) (6th generation)",
    deviceType: "com.apple.CoreSimulator.SimDeviceType.iPad-Pro-12-9-inch-6th-generation",
    resolution: { width: 2048, height: 2732 },
    appStoreClass: "12.9 inch",
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
