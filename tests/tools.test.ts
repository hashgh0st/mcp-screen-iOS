/**
 * Tests for tool handlers with mocked simctl
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the exec utilities before importing tools
vi.mock("../src/utils/exec.js", () => ({
  execCommand: vi.fn(),
  simctl: vi.fn(),
  simctlAsync: vi.fn(),
  parseSimctlJson: vi.fn(),
  commandExists: vi.fn(() => true),
}));

// Mock fs for file operations
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import { simctl, parseSimctlJson, execCommand } from "../src/utils/exec.js";
import { existsSync, readFileSync, writeFileSync } from "fs";

describe("Simulator Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listSimulators", () => {
    it("should return filtered device list", async () => {
      const { listSimulators } = await import("../src/tools/simulator/index.js");

      const mockDevices = {
        devices: {
          "com.apple.CoreSimulator.SimRuntime.iOS-18-0": [
            {
              udid: "ABC123",
              name: "iPhone 16 Pro Max",
              state: "Booted",
              isAvailable: true,
              deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro-Max",
            },
            {
              udid: "DEF456",
              name: "iPad Pro",
              state: "Shutdown",
              isAvailable: true,
              deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPad-Pro",
            },
          ],
        },
      };

      vi.mocked(parseSimctlJson).mockReturnValue(mockDevices);

      const result = await listSimulators({ deviceFamily: "iphone", onlyAvailable: true, onlyBooted: false });

      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed[0].devices).toHaveLength(1);
      expect(parsed[0].devices[0].name).toBe("iPhone 16 Pro Max");
    });

    it("should filter by booted state", async () => {
      const { listSimulators } = await import("../src/tools/simulator/index.js");

      const mockDevices = {
        devices: {
          "com.apple.CoreSimulator.SimRuntime.iOS-18-0": [
            { udid: "ABC123", name: "iPhone 16", state: "Booted", isAvailable: true },
            { udid: "DEF456", name: "iPhone 15", state: "Shutdown", isAvailable: true },
          ],
        },
      };

      vi.mocked(parseSimctlJson).mockReturnValue(mockDevices);

      const result = await listSimulators({ deviceFamily: "all", onlyAvailable: true, onlyBooted: true });

      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed[0].devices).toHaveLength(1);
      expect(parsed[0].devices[0].state).toBe("Booted");
    });
  });

  describe("getBootedSimulator", () => {
    it("should return booted simulator info", async () => {
      const { getBootedSimulator } = await import("../src/tools/simulator/index.js");

      const mockDevices = {
        devices: {
          "com.apple.CoreSimulator.SimRuntime.iOS-18-0": [
            { udid: "ABC123", name: "iPhone 16 Pro Max", state: "Booted", isAvailable: true },
          ],
        },
      };

      vi.mocked(parseSimctlJson).mockReturnValue(mockDevices);

      const result = await getBootedSimulator({});

      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].udid).toBe("ABC123");
      expect(parsed[0].state).toBe("Booted");
    });

    it("should return message when no simulator is booted", async () => {
      const { getBootedSimulator } = await import("../src/tools/simulator/index.js");

      const mockDevices = {
        devices: {
          "com.apple.CoreSimulator.SimRuntime.iOS-18-0": [
            { udid: "ABC123", name: "iPhone 16", state: "Shutdown", isAvailable: true },
          ],
        },
      };

      vi.mocked(parseSimctlJson).mockReturnValue(mockDevices);

      const result = await getBootedSimulator({});

      expect((result.content[0] as { text: string }).text).toContain("No simulators are currently booted");
    });
  });
});

describe("App Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("installApp", () => {
    it("should install app successfully", async () => {
      const { installApp } = await import("../src/tools/app/index.js");

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(simctl).mockReturnValue("");

      const result = await installApp({ appPath: "/path/to/MyApp.app" });

      expect(simctl).toHaveBeenCalledWith('install booted "/path/to/MyApp.app"');
      expect(result.isError).toBeUndefined();
    });

    it("should return error for non-existent app", async () => {
      const { installApp } = await import("../src/tools/app/index.js");

      vi.mocked(existsSync).mockReturnValue(false);

      const result = await installApp({ appPath: "/path/to/NonExistent.app" });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("not found");
    });

    it("should return error for non-.app path", async () => {
      const { installApp } = await import("../src/tools/app/index.js");

      vi.mocked(existsSync).mockReturnValue(true);

      const result = await installApp({ appPath: "/path/to/file.ipa" });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain(".app");
    });
  });

  describe("launchApp", () => {
    it("should launch app successfully", async () => {
      const { launchApp } = await import("../src/tools/app/index.js");

      vi.mocked(simctl).mockReturnValue("12345");

      const result = await launchApp({ bundleId: "com.example.myapp" });

      expect(simctl).toHaveBeenCalledWith("launch  booted com.example.myapp");
      expect(result.isError).toBeUndefined();
    });
  });

  describe("openUrl", () => {
    it("should open URL successfully", async () => {
      const { openUrl } = await import("../src/tools/app/index.js");

      vi.mocked(simctl).mockReturnValue("");

      const result = await openUrl({ url: "myapp://settings" });

      expect(simctl).toHaveBeenCalledWith('openurl booted "myapp://settings"');
      expect(result.isError).toBeUndefined();
    });
  });
});

describe("Privacy Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("grantPermission", () => {
    it("should grant permission successfully", async () => {
      const { grantPermission } = await import("../src/tools/privacy/index.js");

      vi.mocked(simctl).mockReturnValue("");

      const result = await grantPermission({
        bundleId: "com.example.myapp",
        service: "camera",
      });

      expect(simctl).toHaveBeenCalledWith("privacy booted grant camera com.example.myapp");
      expect(result.isError).toBeUndefined();
    });
  });

  describe("resetPermission", () => {
    it("should reset permission for specific app", async () => {
      const { resetPermission } = await import("../src/tools/privacy/index.js");

      vi.mocked(simctl).mockReturnValue("");

      const result = await resetPermission({
        bundleId: "com.example.myapp",
        service: "all",
      });

      expect(simctl).toHaveBeenCalledWith("privacy booted reset all com.example.myapp");
      expect(result.isError).toBeUndefined();
    });

    it("should reset permission for all apps when bundleId not provided", async () => {
      const { resetPermission } = await import("../src/tools/privacy/index.js");

      vi.mocked(simctl).mockReturnValue("");

      const result = await resetPermission({ service: "location" });

      expect(simctl).toHaveBeenCalledWith("privacy booted reset location");
      expect(result.isError).toBeUndefined();
    });
  });

  describe("listPermissions", () => {
    it("should return list of available permissions", async () => {
      const { listPermissions } = await import("../src/tools/privacy/index.js");

      const result = await listPermissions({});

      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed.availableServices).toContain("camera");
      expect(parsed.availableServices).toContain("photos");
      expect(parsed.availableServices).toContain("location");
      expect(parsed.commonServices).toBeDefined();
    });
  });
});

describe("Location Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setLocation", () => {
    it("should set location successfully", async () => {
      const { setLocation } = await import("../src/tools/location/index.js");

      vi.mocked(simctl).mockReturnValue("");

      const result = await setLocation({ latitude: 37.7749, longitude: -122.4194 });

      expect(simctl).toHaveBeenCalledWith("location booted set 37.7749,-122.4194");
      expect(result.isError).toBeUndefined();
    });
  });

  describe("setPresetLocation", () => {
    it("should set preset location", async () => {
      const { setPresetLocation } = await import("../src/tools/location/index.js");

      vi.mocked(simctl).mockReturnValue("");

      const result = await setPresetLocation({ preset: "tokyo" });

      expect(simctl).toHaveBeenCalledWith(expect.stringContaining("location booted set"));
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed.name).toBe("Tokyo");
    });
  });

  describe("clearLocation", () => {
    it("should clear location", async () => {
      const { clearLocation } = await import("../src/tools/location/index.js");

      vi.mocked(simctl).mockReturnValue("");

      const result = await clearLocation({});

      expect(simctl).toHaveBeenCalledWith("location booted clear");
      expect(result.isError).toBeUndefined();
    });
  });

  describe("listPresetLocations", () => {
    it("should return all preset locations", async () => {
      const { listPresetLocations } = await import("../src/tools/location/index.js");

      const result = await listPresetLocations({});

      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed.presetLocations).toBeInstanceOf(Array);
      expect(parsed.presetLocations.length).toBeGreaterThan(0);

      const tokyo = parsed.presetLocations.find((l: { preset: string }) => l.preset === "tokyo");
      expect(tokyo).toBeDefined();
      expect(tokyo.name).toBe("Tokyo");
    });
  });
});

describe("Notification Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendNotification", () => {
    it("should send notification with correct payload", async () => {
      const { sendNotification } = await import("../src/tools/notifications/index.js");

      vi.mocked(simctl).mockReturnValue("");
      vi.mocked(writeFileSync).mockImplementation(() => {});

      const result = await sendNotification({
        bundleId: "com.example.myapp",
        title: "Test Title",
        body: "Test Body",
        badge: 5,
      });

      expect(writeFileSync).toHaveBeenCalled();
      expect(simctl).toHaveBeenCalledWith(expect.stringContaining("push booted com.example.myapp"));
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed.title).toBe("Test Title");
      expect(parsed.body).toBe("Test Body");
    });
  });
});
