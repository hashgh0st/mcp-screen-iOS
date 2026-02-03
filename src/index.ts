/**
 * App Store Screenshot MCP Server
 *
 * An MCP server for automating iOS Simulator screenshots optimized for App Store submission.
 * Supports only the two required App Store sizes (iPhone 6.9" and iPad 13").
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { simulatorTools } from "./tools/simulator/index.js";
import { screenshotTools } from "./tools/screenshot/index.js";
import { appTools } from "./tools/app/index.js";
import { uiTools } from "./tools/ui/index.js";
import { videoTools } from "./tools/video/index.js";
import { appearanceTools } from "./tools/appearance/index.js";
import { accessibilityTools } from "./tools/accessibility/index.js";
import { privacyTools } from "./tools/privacy/index.js";
import { notificationTools } from "./tools/notifications/index.js";
import { locationTools } from "./tools/location/index.js";
import { alertTools } from "./tools/alerts/index.js";
import { keychainTools } from "./tools/keychain/index.js";
import { frameTools } from "./tools/frames/index.js";
import { APP_STORE_DEVICES } from "./types/index.js";
import { commandExists } from "./utils/exec.js";

/**
 * Server metadata
 */
const SERVER_NAME = "appstore-screenshot-mcp";
const SERVER_VERSION = "1.0.0";

/**
 * Create and configure the MCP server
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register all tools from each module
  const allTools = [
    ...simulatorTools,
    ...screenshotTools,
    ...appTools,
    ...uiTools,
    ...videoTools,
    ...appearanceTools,
    ...accessibilityTools,
    ...privacyTools,
    ...notificationTools,
    ...locationTools,
    ...alertTools,
    ...keychainTools,
    ...frameTools,
  ];

  for (const tool of allTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      async (input: Record<string, unknown>) => {
        // Parse and validate input
        const parsed = tool.schema.parse(input);
        // Call handler and return result
        const result = await tool.handler(parsed as never);
        return result;
      }
    );
  }

  // Register resources for quick access to device configurations
  server.resource(
    "appstore-devices",
    "appstore-screenshot-mcp://devices",
    async () => ({
      contents: [
        {
          uri: "appstore-screenshot-mcp://devices",
          mimeType: "application/json",
          text: JSON.stringify(APP_STORE_DEVICES, null, 2),
        },
      ],
    })
  );

  return server;
}

/**
 * Verify system requirements
 */
function verifyRequirements(): void {
  // Check for xcrun
  if (!commandExists("xcrun")) {
    console.error(
      "Error: xcrun not found. Please install Xcode Command Line Tools:\n" +
        "  xcode-select --install"
    );
    process.exit(1);
  }

  // Check for simctl
  try {
    const { execSync } = require("child_process");
    execSync("xcrun simctl help", { stdio: "ignore" });
  } catch {
    console.error(
      "Error: xcrun simctl not available. Please ensure Xcode is installed and\n" +
        "iOS Simulator support is enabled."
    );
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Verify system requirements
  verifyRequirements();

  // Create server
  const server = createServer();

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
