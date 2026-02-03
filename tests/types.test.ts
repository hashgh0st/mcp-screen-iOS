/**
 * Tests for type definitions and constants
 */

import { describe, it, expect } from "vitest";
import { APP_STORE_DEVICES } from "../src/types/index.js";

describe("APP_STORE_DEVICES", () => {
  it("should have iPhone 6.9 inch configuration", () => {
    const device = APP_STORE_DEVICES["iphone_6.9"];
    expect(device).toBeDefined();
    expect(device.name).toBe("iPhone 16 Pro Max");
    expect(device.resolution.width).toBe(1320);
    expect(device.resolution.height).toBe(2868);
    expect(device.appStoreClass).toBe("6.9 inch");
  });

  it("should have iPhone 6.7 inch configuration", () => {
    const device = APP_STORE_DEVICES["iphone_6.7"];
    expect(device).toBeDefined();
    expect(device.name).toBe("iPhone 15 Pro Max");
    expect(device.resolution.width).toBe(1290);
    expect(device.resolution.height).toBe(2796);
  });

  it("should have iPad 13 inch configuration", () => {
    const device = APP_STORE_DEVICES["ipad_13"];
    expect(device).toBeDefined();
    expect(device.name).toBe("iPad Pro 13-inch (M4)");
    expect(device.resolution.width).toBe(2064);
    expect(device.resolution.height).toBe(2752);
    expect(device.appStoreClass).toBe("13 inch");
  });

  it("should have iPad 12.9 inch configuration", () => {
    const device = APP_STORE_DEVICES["ipad_12.9"];
    expect(device).toBeDefined();
    expect(device.name).toBe("iPad Pro (12.9-inch) (6th generation)");
    expect(device.resolution.width).toBe(2048);
    expect(device.resolution.height).toBe(2732);
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
