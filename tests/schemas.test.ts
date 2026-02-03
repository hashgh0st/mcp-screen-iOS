/**
 * Tests for tool input schemas (Zod validation)
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Import schemas from tool modules
import {
  listSimulatorsSchema,
  bootAppStoreSimulatorSchema,
  shutdownSimulatorSchema,
} from "../src/tools/simulator/index.js";

import {
  captureScreenshotSchema,
  setStatusBarSchema,
  validateScreenshotSchema,
} from "../src/tools/screenshot/index.js";

import {
  installAppSchema,
  launchAppSchema,
  openUrlSchema,
} from "../src/tools/app/index.js";

import {
  uiTapSchema,
  uiSwipeSchema,
  uiTypeSchema,
  uiPressButtonSchema,
} from "../src/tools/ui/index.js";

import {
  grantPermissionSchema,
  resetPermissionSchema,
} from "../src/tools/privacy/index.js";

import {
  sendNotificationSchema,
} from "../src/tools/notifications/index.js";

import {
  setLocationSchema,
  setPresetLocationSchema,
} from "../src/tools/location/index.js";

describe("Simulator Schemas", () => {
  describe("listSimulatorsSchema", () => {
    it("should accept valid input with all options", () => {
      const input = {
        deviceFamily: "iphone",
        onlyAvailable: true,
        onlyBooted: false,
      };
      expect(() => listSimulatorsSchema.parse(input)).not.toThrow();
    });

    it("should accept empty input with defaults", () => {
      const result = listSimulatorsSchema.parse({});
      expect(result.deviceFamily).toBe("all");
      expect(result.onlyAvailable).toBe(true);
      expect(result.onlyBooted).toBe(false);
    });

    it("should reject invalid device family", () => {
      const input = { deviceFamily: "android" };
      expect(() => listSimulatorsSchema.parse(input)).toThrow();
    });
  });

  describe("bootAppStoreSimulatorSchema", () => {
    it("should accept valid device class", () => {
      const input = { deviceClass: "iphone_6.9" };
      expect(() => bootAppStoreSimulatorSchema.parse(input)).not.toThrow();
    });

    it("should accept iPad device class", () => {
      const input = { deviceClass: "ipad_13" };
      expect(() => bootAppStoreSimulatorSchema.parse(input)).not.toThrow();
    });

    it("should reject invalid device class", () => {
      const input = { deviceClass: "iphone_5" };
      expect(() => bootAppStoreSimulatorSchema.parse(input)).toThrow();
    });

    it("should accept optional runtime", () => {
      const input = {
        deviceClass: "iphone_6.9",
        runtime: "com.apple.CoreSimulator.SimRuntime.iOS-18-0",
      };
      expect(() => bootAppStoreSimulatorSchema.parse(input)).not.toThrow();
    });
  });
});

describe("Screenshot Schemas", () => {
  describe("captureScreenshotSchema", () => {
    it("should accept valid output path", () => {
      const input = { outputPath: "./screenshots/test.png" };
      expect(() => captureScreenshotSchema.parse(input)).not.toThrow();
    });

    it("should have correct defaults", () => {
      const result = captureScreenshotSchema.parse({ outputPath: "./test.png" });
      expect(result.cleanStatusBar).toBe(true);
      expect(result.maskNotch).toBe(true);
    });

    it("should accept custom options", () => {
      const input = {
        outputPath: "./test.png",
        udid: "ABC123",
        cleanStatusBar: false,
        maskNotch: false,
      };
      const result = captureScreenshotSchema.parse(input);
      expect(result.cleanStatusBar).toBe(false);
      expect(result.maskNotch).toBe(false);
    });
  });

  describe("setStatusBarSchema", () => {
    it("should accept all status bar options", () => {
      const input = {
        time: "9:41",
        batteryLevel: 100,
        batteryState: "charged",
        wifiMode: "active",
        wifiBars: 3,
        cellularMode: "active",
        cellularBars: 4,
      };
      expect(() => setStatusBarSchema.parse(input)).not.toThrow();
    });

    it("should reject invalid battery level", () => {
      const input = { batteryLevel: 150 };
      expect(() => setStatusBarSchema.parse(input)).toThrow();
    });

    it("should reject invalid wifi bars", () => {
      const input = { wifiBars: 5 };
      expect(() => setStatusBarSchema.parse(input)).toThrow();
    });
  });
});

describe("App Schemas", () => {
  describe("installAppSchema", () => {
    it("should require appPath", () => {
      expect(() => installAppSchema.parse({})).toThrow();
    });

    it("should accept valid app path", () => {
      const input = { appPath: "/path/to/MyApp.app" };
      expect(() => installAppSchema.parse(input)).not.toThrow();
    });
  });

  describe("launchAppSchema", () => {
    it("should require bundleId", () => {
      expect(() => launchAppSchema.parse({})).toThrow();
    });

    it("should accept valid bundle ID", () => {
      const input = { bundleId: "com.example.myapp" };
      expect(() => launchAppSchema.parse(input)).not.toThrow();
    });

    it("should have waitForDebugger default to false", () => {
      const result = launchAppSchema.parse({ bundleId: "com.example.myapp" });
      expect(result.waitForDebugger).toBe(false);
    });
  });

  describe("openUrlSchema", () => {
    it("should accept URL schemes", () => {
      const input = { url: "myapp://settings" };
      expect(() => openUrlSchema.parse(input)).not.toThrow();
    });

    it("should accept HTTPS URLs", () => {
      const input = { url: "https://example.com" };
      expect(() => openUrlSchema.parse(input)).not.toThrow();
    });
  });
});

describe("UI Schemas", () => {
  describe("uiTapSchema", () => {
    it("should require x and y coordinates", () => {
      expect(() => uiTapSchema.parse({})).toThrow();
      expect(() => uiTapSchema.parse({ x: 100 })).toThrow();
      expect(() => uiTapSchema.parse({ y: 100 })).toThrow();
    });

    it("should accept valid coordinates", () => {
      const input = { x: 100, y: 200 };
      expect(() => uiTapSchema.parse(input)).not.toThrow();
    });
  });

  describe("uiSwipeSchema", () => {
    it("should require all coordinates", () => {
      const input = { startX: 100, startY: 200, endX: 100, endY: 400 };
      expect(() => uiSwipeSchema.parse(input)).not.toThrow();
    });

    it("should have default duration", () => {
      const result = uiSwipeSchema.parse({
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 100,
      });
      expect(result.duration).toBe(0.3);
    });
  });

  describe("uiTypeSchema", () => {
    it("should require text", () => {
      expect(() => uiTypeSchema.parse({})).toThrow();
    });

    it("should accept text input", () => {
      const input = { text: "Hello World" };
      expect(() => uiTypeSchema.parse(input)).not.toThrow();
    });
  });

  describe("uiPressButtonSchema", () => {
    it("should accept valid buttons", () => {
      const buttons = ["home", "lock", "volumeUp", "volumeDown", "shake", "screenshot", "toggleAppearance"];
      for (const button of buttons) {
        expect(() => uiPressButtonSchema.parse({ button })).not.toThrow();
      }
    });

    it("should reject invalid button", () => {
      expect(() => uiPressButtonSchema.parse({ button: "power" })).toThrow();
    });
  });
});

describe("Privacy Schemas", () => {
  describe("grantPermissionSchema", () => {
    it("should require bundleId and service", () => {
      expect(() => grantPermissionSchema.parse({})).toThrow();
      expect(() => grantPermissionSchema.parse({ bundleId: "com.example.app" })).toThrow();
    });

    it("should accept valid permission services", () => {
      const services = ["camera", "photos", "location", "microphone", "contacts", "all"];
      for (const service of services) {
        const input = { bundleId: "com.example.app", service };
        expect(() => grantPermissionSchema.parse(input)).not.toThrow();
      }
    });
  });
});

describe("Notification Schemas", () => {
  describe("sendNotificationSchema", () => {
    it("should require bundleId, title, and body", () => {
      expect(() => sendNotificationSchema.parse({})).toThrow();
    });

    it("should accept valid notification", () => {
      const input = {
        bundleId: "com.example.app",
        title: "Test",
        body: "Test body",
      };
      expect(() => sendNotificationSchema.parse(input)).not.toThrow();
    });

    it("should accept optional fields", () => {
      const input = {
        bundleId: "com.example.app",
        title: "Test",
        body: "Test body",
        subtitle: "Subtitle",
        badge: 5,
        sound: "default",
        category: "MESSAGE",
        threadId: "thread-1",
        customData: { key: "value" },
      };
      expect(() => sendNotificationSchema.parse(input)).not.toThrow();
    });
  });
});

describe("Location Schemas", () => {
  describe("setLocationSchema", () => {
    it("should require latitude and longitude", () => {
      expect(() => setLocationSchema.parse({})).toThrow();
    });

    it("should accept valid coordinates", () => {
      const input = { latitude: 37.7749, longitude: -122.4194 };
      expect(() => setLocationSchema.parse(input)).not.toThrow();
    });

    it("should reject out of range latitude", () => {
      expect(() => setLocationSchema.parse({ latitude: 91, longitude: 0 })).toThrow();
      expect(() => setLocationSchema.parse({ latitude: -91, longitude: 0 })).toThrow();
    });

    it("should reject out of range longitude", () => {
      expect(() => setLocationSchema.parse({ latitude: 0, longitude: 181 })).toThrow();
      expect(() => setLocationSchema.parse({ latitude: 0, longitude: -181 })).toThrow();
    });
  });

  describe("setPresetLocationSchema", () => {
    it("should accept valid presets", () => {
      const presets = ["apple_park", "san_francisco", "new_york", "london", "tokyo"];
      for (const preset of presets) {
        expect(() => setPresetLocationSchema.parse({ preset })).not.toThrow();
      }
    });

    it("should reject invalid preset", () => {
      expect(() => setPresetLocationSchema.parse({ preset: "mars" })).toThrow();
    });
  });
});
