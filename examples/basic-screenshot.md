# Basic Screenshot Capture

This example shows how to capture a single App Store screenshot.

## Prerequisites

- iOS Simulator with your app installed
- App bundle identifier (e.g., `com.example.myapp`)

## Workflow

```
# 1. Boot an App Store-sized simulator
boot_appstore_simulator(deviceClass: "iphone_6.9")
# Returns: { udid: "ABC123-...", name: "AppStore-iphone_6.9-..." }

# 2. Install your app (if not already installed)
install_app(appPath: "/path/to/YourApp.app")

# 3. Grant all permissions to avoid dialog interruptions
grant_all_permissions(bundleId: "com.example.myapp")

# 4. Launch the app
launch_app(bundleId: "com.example.myapp")

# 5. Wait for app to load, then capture screenshot
# The status bar is automatically cleaned up (9:41, full battery)
capture_screenshot(outputPath: "./screenshots/home.png")

# 6. Validate the screenshot meets App Store requirements
validate_screenshot(filePath: "./screenshots/home.png", expectedDeviceClass: "iphone_6.9")
```

## Expected Output

The screenshot will be saved at `./screenshots/home.png` with:
- Resolution: 1320x2868 pixels (iPhone 16 Pro Max)
- Clean status bar: 9:41, full battery, WiFi
- Notch area masked in black

## Tips

- Use `capture_screenshot_inline()` if you want to preview the screenshot in Claude's vision
- Add `cleanStatusBar: false` if you want to keep the real status bar
- Add `maskNotch: false` if you don't want the black mask over the notch
