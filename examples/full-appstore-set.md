# Full App Store Screenshot Set

Capture all required screenshots for App Store submission (iPhone + iPad).

## Required Sizes (2024+)

Apple now only requires two sizes:
- **iPhone 6.9"** (1320×2868) - iPhone 16 Pro Max
- **iPad 13"** (2064×2752) - iPad Pro 13" M4

All other sizes auto-scale from these.

## Workflow

```
# ============================================
# PHASE 1: iPhone Screenshots
# ============================================

# 1. Boot iPhone simulator
boot_appstore_simulator(deviceClass: "iphone_6.9")
# Save the UDID for later: IPHONE_UDID = result.udid

# 2. Setup
install_app(appPath: "/path/to/YourApp.app", udid: IPHONE_UDID)
grant_all_permissions(bundleId: "com.example.myapp", udid: IPHONE_UDID)
launch_app(bundleId: "com.example.myapp", udid: IPHONE_UDID)

# 3. Capture iPhone screenshots
# Screenshot 1: Home screen
capture_screenshot(outputPath: "./screenshots/iphone/01_home.png", udid: IPHONE_UDID)

# Screenshot 2: Feature 1 - navigate to it first
ui_tap(x: 200, y: 400, udid: IPHONE_UDID)  # Tap on feature button
capture_screenshot(outputPath: "./screenshots/iphone/02_feature1.png", udid: IPHONE_UDID)

# Screenshot 3: Feature 2
open_url(url: "myapp://feature2", udid: IPHONE_UDID)
capture_screenshot(outputPath: "./screenshots/iphone/03_feature2.png", udid: IPHONE_UDID)

# Screenshot 4: Settings
open_url(url: "myapp://settings", udid: IPHONE_UDID)
capture_screenshot(outputPath: "./screenshots/iphone/04_settings.png", udid: IPHONE_UDID)

# Screenshot 5: Dark mode version of home
set_appearance(mode: "dark", udid: IPHONE_UDID)
open_url(url: "myapp://home", udid: IPHONE_UDID)
capture_screenshot(outputPath: "./screenshots/iphone/05_home_dark.png", udid: IPHONE_UDID)

# ============================================
# PHASE 2: iPad Screenshots
# ============================================

# 4. Boot iPad simulator
boot_appstore_simulator(deviceClass: "ipad_13")
# Save the UDID: IPAD_UDID = result.udid

# 5. Setup iPad
install_app(appPath: "/path/to/YourApp.app", udid: IPAD_UDID)
grant_all_permissions(bundleId: "com.example.myapp", udid: IPAD_UDID)
launch_app(bundleId: "com.example.myapp", udid: IPAD_UDID)

# 6. Capture iPad screenshots (same screens)
capture_screenshot(outputPath: "./screenshots/ipad/01_home.png", udid: IPAD_UDID)

ui_tap(x: 400, y: 600, udid: IPAD_UDID)
capture_screenshot(outputPath: "./screenshots/ipad/02_feature1.png", udid: IPAD_UDID)

open_url(url: "myapp://feature2", udid: IPAD_UDID)
capture_screenshot(outputPath: "./screenshots/ipad/03_feature2.png", udid: IPAD_UDID)

open_url(url: "myapp://settings", udid: IPAD_UDID)
capture_screenshot(outputPath: "./screenshots/ipad/04_settings.png", udid: IPAD_UDID)

set_appearance(mode: "dark", udid: IPAD_UDID)
open_url(url: "myapp://home", udid: IPAD_UDID)
capture_screenshot(outputPath: "./screenshots/ipad/05_home_dark.png", udid: IPAD_UDID)

# ============================================
# PHASE 3: Cleanup
# ============================================

shutdown_simulator(udid: IPHONE_UDID, delete: true)
shutdown_simulator(udid: IPAD_UDID, delete: true)
```

## Alternative: Quick Capture with capture_all_appstore

If you just need to capture the current screen on all device sizes:

```
# Boot both simulators first
boot_appstore_simulator(deviceClass: "iphone_6.9")
boot_appstore_simulator(deviceClass: "ipad_13")

# Install and launch app on both (manually or via script)

# Capture current screen on all booted App Store simulators
capture_all_appstore(
  outputDir: "./screenshots",
  filenamePrefix: "home",
  deviceClasses: ["iphone_6.9", "ipad_13"]
)
# Creates: ./screenshots/home_iphone_6.9.png and ./screenshots/home_ipad_13.png
```

## Output Directory Structure

```
screenshots/
├── iphone/
│   ├── 01_home.png
│   ├── 02_feature1.png
│   ├── 03_feature2.png
│   ├── 04_settings.png
│   └── 05_home_dark.png
└── ipad/
    ├── 01_home.png
    ├── 02_feature1.png
    ├── 03_feature2.png
    ├── 04_settings.png
    └── 05_home_dark.png
```

## Validation

After capturing, validate all screenshots:

```
validate_screenshot(filePath: "./screenshots/iphone/01_home.png", expectedDeviceClass: "iphone_6.9")
validate_screenshot(filePath: "./screenshots/ipad/01_home.png", expectedDeviceClass: "ipad_13")
# ... validate all screenshots
```
