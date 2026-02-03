/**
 * Tests for utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
}));

// Import after mocking
import { execCommand, commandExists, simctl, parseSimctlJson } from "../src/utils/exec.js";

describe("execCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute command and return trimmed output", () => {
    vi.mocked(execSync).mockReturnValue("  output text  \n");

    const result = execCommand("echo test");

    expect(execSync).toHaveBeenCalledWith("echo test", {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });
    expect(result).toBe("output text");
  });

  it("should throw on command failure", () => {
    vi.mocked(execSync).mockImplementation(() => {
      const error = new Error("Command failed") as Error & { stderr: string };
      error.stderr = "error output";
      throw error;
    });

    expect(() => execCommand("invalid-command")).toThrow();
  });
});

describe("commandExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when command exists", () => {
    vi.mocked(execSync).mockReturnValue("/usr/bin/xcrun\n");

    const result = commandExists("xcrun");

    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith("which xcrun", { encoding: "utf-8" });
  });

  it("should return false when command does not exist", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found");
    });

    const result = commandExists("nonexistent-command");

    expect(result).toBe(false);
  });
});

describe("simctl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should prepend xcrun simctl to commands", () => {
    vi.mocked(execSync).mockReturnValue("output");

    simctl("list devices");

    expect(execSync).toHaveBeenCalledWith(
      "xcrun simctl list devices",
      expect.any(Object)
    );
  });
});

describe("parseSimctlJson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse JSON output from simctl", () => {
    const mockData = {
      devices: {
        "iOS 18.0": [
          { udid: "ABC123", name: "iPhone 16 Pro Max", state: "Booted" }
        ]
      }
    };
    vi.mocked(execSync).mockReturnValue(JSON.stringify(mockData));

    const result = parseSimctlJson<typeof mockData>("list devices");

    expect(execSync).toHaveBeenCalledWith(
      "xcrun simctl list devices --json",
      expect.any(Object)
    );
    expect(result).toEqual(mockData);
  });

  it("should throw on invalid JSON", () => {
    vi.mocked(execSync).mockReturnValue("not valid json");

    expect(() => parseSimctlJson("list devices")).toThrow();
  });
});
