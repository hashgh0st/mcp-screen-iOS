# appstore-screenshot-mcp

An MCP (Model Context Protocol) server for automating App Store screenshot capture from iOS Simulator. Optimized for the 2024+ App Store requirements where only two screenshot sizes are mandatory.

## Features

- **Simulator Management**: List, boot, and shutdown iOS simulators with App Store-specific presets
- **Screenshot Capture**: Capture screenshots at native resolution with automatic status bar cleanup
- **App Store Optimization**: Pre-configured for iPhone 6.9" and iPad 13" (the only required sizes)
- **Status Bar Control**: Set clean status bar (9:41, full battery, WiFi) automatically
- **App Management**: Install, launch, and navigate apps for screenshot automation
- **Validation**: Verify screenshots meet App Store requirements

## Installation

### Via npx (recommended)

```bash
npx appstore-screenshot-mcp
```

### From source

```bash
git clone https://github.com/your-org/mcp-screen-iOS.git
cd mcp-screen-iOS
npm install
npm run build
```

## Requirements

- macOS with Xcode installed
- Xcode Command Line Tools (`xcode-select --install`)
- iOS Simulator runtimes (iOS 17+ recommended)
- Node.js 18+

## Configuration

### Claude Code

Add to `~/.claude.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "appstore-screenshots": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "appstore-screenshot-mcp"]
    }
  }
}
```

Or via CLI:

```bash
claude mcp add appstore-screenshots npx appstore-screenshot-mcp
```

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.appstore-screenshots]
command = "npx"
args = ["-y", "appstore-screenshot-mcp"]
```

## Available Tools

### Simulator Management

| Tool | Description |
|------|-------------|
| `list_simulators` | List available iOS simulators with filtering options |
| `boot_appstore_simulator` | Create and boot a simulator matching App Store size requirements |
| `shutdown_simulator` | Shutdown and optionally delete a simulator |
| `get_booted_simulator` | Get info about currently booted simulator(s) |

### Screenshot Capture

| Tool | Description |
|------|-------------|
| `capture_screenshot` | Capture screenshot to file with status bar and notch options |
| `capture_screenshot_inline` | Capture and return as base64 image (for AI vision) |
| `capture_all_appstore` | Capture screenshots for all App Store sizes |
| `set_status_bar` | Configure status bar (time, battery, WiFi, cellular) |
| `clear_status_bar` | Reset status bar to system defaults |
| `validate_screenshot` | Verify screenshot meets App Store requirements |

### App Management

| Tool | Description |
|------|-------------|
| `install_app` | Install a .app bundle on simulator |
| `launch_app` | Launch app by bundle ID |
| `terminate_app` | Stop a running app |
| `uninstall_app` | Remove app from simulator |
| `open_url` | Open URL or deep link (for navigation) |
| `list_apps` | List installed apps |
| `get_app_container` | Get app data/container path |

## App Store Screenshot Sizes (2024+)

Apple simplified requirements - only two sizes are mandatory:

| Platform | Required Size | Dimensions | Simulator |
|----------|--------------|------------|-----------|
| **iPhone** | 6.9" | 1320x2868 | iPhone 16 Pro Max |
| **iPad** | 13" | 2064x2752 | iPad Pro 13" (M4) |

All other sizes auto-scale from these primary screenshots.

## Example Workflows

### Basic Screenshot Capture

```
1. Boot iPhone simulator: boot_appstore_simulator(deviceClass: "iphone_6.9")
2. Install your app: install_app(appPath: "/path/to/MyApp.app")
3. Launch app: launch_app(bundleId: "com.example.myapp")
4. Navigate to screen (if needed): open_url(url: "myapp://feature")
5. Capture screenshot: capture_screenshot(outputPath: "./screenshots/home.png")
```

### Full App Store Screenshot Set

```
1. Boot both required simulators:
   - boot_appstore_simulator(deviceClass: "iphone_6.9")
   - boot_appstore_simulator(deviceClass: "ipad_13")

2. Install app on both (use UDIDs from step 1)

3. Navigate to desired screen

4. Capture all: capture_all_appstore(outputDir: "./screenshots")
```

### Clean Status Bar Only

```
set_status_bar(
  time: "9:41",
  batteryLevel: 100,
  batteryState: "charged",
  wifiMode: "active",
  wifiBars: 3
)
```

## Resources

The server exposes an MCP resource for device configurations:

```
appstore-screenshot-mcp://devices
```

This returns the supported App Store device presets with their identifiers and resolutions.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development (with watch)
npm run dev

# Type check
npm run typecheck
```

## How It Works

The server wraps `xcrun simctl` commands to provide:

1. **Device Creation**: Uses `simctl create` with exact device type identifiers for App Store sizes
2. **Status Bar Override**: Uses `simctl status_bar override` for clean screenshots
3. **Screenshot Capture**: Uses `simctl io screenshot` with `--mask=black` for notch handling
4. **App Control**: Uses `simctl install/launch/terminate` for app lifecycle

All commands are executed via Node.js child processes with proper error handling.

## License

MIT
