# appstore-screenshot-mcp

An MCP (Model Context Protocol) server for automating App Store screenshot capture from iOS Simulator. Optimized for the 2026 App Store requirements with 6.9" iPhone and 13" iPad buckets plus accepted fallback pixel sizes.

## Features

- **Simulator Management**: List, boot, and shutdown iOS simulators with App Store-specific presets
- **Screenshot Capture**: Capture screenshots at native resolution with automatic status bar cleanup
- **App Store Optimization**: Pre-configured for iPhone 6.9" and iPad 13" buckets with all accepted pixel sizes
- **Status Bar Control**: Set clean status bar (9:41, full battery, WiFi) automatically
- **App Management**: Install, launch, and navigate apps for screenshot automation
- **UI Interaction**: Tap, swipe, scroll, and type to navigate apps to specific screens
- **Video Recording**: Record simulator interactions for App Store preview videos
- **Appearance Control**: Toggle dark/light mode, set locale, adjust text size
- **Accessibility**: Inspect UI hierarchy, find elements, configure accessibility settings
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

### UI Interaction

| Tool | Description |
|------|-------------|
| `ui_tap` | Tap at specific coordinates (in points) |
| `ui_swipe` | Swipe from one point to another |
| `ui_scroll` | Scroll in a direction (up/down/left/right) |
| `ui_type` | Type text into focused input field |
| `ui_press_button` | Press hardware buttons (home, lock, volume, shake, toggleAppearance) |
| `get_ui_tree` | Get accessibility tree for finding element coordinates |

### Video Recording

| Tool | Description |
|------|-------------|
| `start_recording` | Start recording video from the simulator |
| `stop_recording` | Stop recording and save the video file |
| `get_recording_status` | Check if recording is in progress |

### Appearance Control

| Tool | Description |
|------|-------------|
| `set_appearance` | Set light or dark mode |
| `get_appearance` | Get current appearance mode |
| `toggle_appearance` | Toggle between light and dark mode |
| `set_locale` | Set locale and language (e.g., en_US, ja_JP) |
| `set_content_size` | Set Dynamic Type text size |
| `set_accessibility` | Configure accessibility options (reduce motion, bold text, etc.) |

### Accessibility Inspection

| Tool | Description |
|------|-------------|
| `describe_ui` | Get the full UI accessibility hierarchy |
| `describe_point` | Get element info at specific coordinates |
| `find_element` | Search for elements by label, identifier, or type |
| `get_screen_info` | Get screen dimensions and device info |

## App Store Screenshot Sizes (2026)

Apple's 2026 requirements focus on two primary display buckets, with multiple accepted pixel sizes per bucket:

| Platform | Required Size | Accepted Dimensions (portrait) | Recommended Simulator |
|----------|--------------|--------------------------------|-----------------------|
| **iPhone** | 6.9" (or 6.5" if 6.9" isn't provided) | 1320x2868, 1290x2796, 1260x2736 | iPhone 16 Pro Max |
| **iPad** | 13" | 2064x2752, 2048x2732 | iPad Pro 13" (M4) |

The server validates against all accepted sizes for each bucket and reports whether a screenshot matches in portrait or landscape.

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

### Navigate with UI Interactions

```
1. Launch app: launch_app(bundleId: "com.example.myapp")
2. Tap settings button: ui_tap(x: 350, y: 50)
3. Scroll down: ui_scroll(direction: "down", distance: 400)
4. Type in search: ui_type(text: "profile")
5. Toggle dark mode: ui_press_button(button: "toggleAppearance")
6. Capture screenshot: capture_screenshot(outputPath: "./screenshots/settings-dark.png")
```

### Record App Store Preview Video

```
1. Boot simulator: boot_appstore_simulator(deviceClass: "iphone_6.9")
2. Launch app: launch_app(bundleId: "com.example.myapp")
3. Start recording: start_recording(outputPath: "./videos/preview.mp4")
4. Perform interactions: ui_tap, ui_scroll, etc.
5. Stop recording: stop_recording()
```

### Capture Screenshots in Multiple Languages

```
1. Set locale: set_locale(locale: "ja_JP")
2. Terminate app: terminate_app(bundleId: "com.example.myapp")
3. Launch app: launch_app(bundleId: "com.example.myapp")
4. Capture: capture_screenshot(outputPath: "./screenshots/home_ja.png")
5. Repeat for other locales (fr_FR, de_DE, etc.)
```

### Light and Dark Mode Screenshots

```
1. set_appearance(mode: "light")
2. capture_screenshot(outputPath: "./screenshots/home_light.png")
3. set_appearance(mode: "dark")
4. capture_screenshot(outputPath: "./screenshots/home_dark.png")
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

The server wraps `xcrun simctl` commands and AppleScript to provide:

1. **Device Creation**: Uses `simctl create` with exact device type identifiers for App Store sizes
2. **Status Bar Override**: Uses `simctl status_bar override` for clean screenshots
3. **Screenshot Capture**: Uses `simctl io screenshot` with `--mask=black` for notch handling
4. **App Control**: Uses `simctl install/launch/terminate` for app lifecycle
5. **UI Interaction**: Uses AppleScript to control Simulator.app for taps, swipes, and keyboard input
6. **Video Recording**: Uses `simctl io recordVideo` with H.264/HEVC codecs
7. **Appearance Control**: Uses `simctl ui appearance` and `simctl spawn defaults` for settings
8. **Accessibility**: Uses `simctl ui describe` for UI hierarchy inspection

All commands are executed via Node.js child processes with proper error handling.

## License

MIT
