/**
 * Tests for type definitions and constants
 */

import { describe, it, expect } from "vitest";
import { APP_STORE_DEVICES } from "../src/types/index.js";

describe("APP_STORE_DEVICES", () => {
  it("should have iPhone 6.9 inch configuration", () => {
    const device = APP_STORE_DEVICES["iphone_6.9"];
    expect(device).toBeDefined();
    expect(device.name).toBe("iPhone 17 Pro Max");
    expect(device.primaryResolution.width).toBe(1320);
    expect(device.primaryResolution.height).toBe(2868);
    expect(device.appStoreClass).toBe("6.9 inch");
  });

  it("should have iPhone 6.9 inch accepted resolutions", () => {
    const device = APP_STORE_DEVICES["iphone_6.9"];
    expect(device.acceptedResolutions).toHaveLength(3);
    expect(device.acceptedResolutions).toContainEqual({ width: 1320, height: 2868 });
    expect(device.acceptedResolutions).toContainEqual({ width: 1290, height: 2796 });
    expect(device.acceptedResolutions).toContainEqual({ width: 1260, height: 2736 });
  });

  it("should have iPad 13 inch configuration", () => {
    const device = APP_STORE_DEVICES["ipad_13"];
    expect(device).toBeDefined();
    expect(device.name).toBe("iPad Pro 13-inch (M5)");
    expect(device.primaryResolution.width).toBe(2064);
    expect(device.primaryResolution.height).toBe(2752);
    expect(device.appStoreClass).toBe("13 inch");
  });

  it("should have iPad 13 inch accepted resolutions", () => {
    const device = APP_STORE_DEVICES["ipad_13"];
    expect(device.acceptedResolutions).toHaveLength(2);
    expect(device.acceptedResolutions).toContainEqual({ width: 2064, height: 2752 });
    expect(device.acceptedResolutions).toContainEqual({ width: 2048, height: 2732 });
  });

  it("should have valid device type identifiers", () => {
    for (const [key, device] of Object.entries(APP_STORE_DEVICES)) {
      expect(device.deviceType).toMatch(/^com\.apple\.CoreSimulator\.SimDeviceType\./);
    }
  });

  it("should have all required App Store device classes", () => {
    const keys = Object.keys(APP_STORE_DEVICES);
    expect(keys).toContain("iphone_6.9");
    expect(keys).toContain("ipad_13");
  });
});
