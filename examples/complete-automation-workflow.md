# Complete App Store Automation Workflow

A comprehensive workflow to capture all App Store screenshots with minimal manual intervention.

## Prerequisites

- Your app `.app` bundle (built for simulator)
- App bundle identifier
- List of screens to capture
- URL schemes for navigation (recommended)

## The Complete Workflow

```
# ============================================
# CONFIGURATION
# ============================================
APP_PATH = "/path/to/YourApp.app"
BUNDLE_ID = "com.example.myapp"
OUTPUT_DIR = "./appstore-screenshots"

SCREENS = [
  { name: "home", url: "myapp://home" },
  { name: "feature1", url: "myapp://feature1" },
  { name: "feature2", url: "myapp://feature2" },
  { name: "settings", url: "myapp://settings" },
  { name: "profile", url: "myapp://profile" }
]

LOCALES = ["en_US", "ja_JP", "de_DE", "fr_FR", "es_ES"]
DEVICES = ["iphone_6.9", "ipad_13"]
MODES = ["light", "dark"]

# ============================================
# PHASE 1: SETUP SIMULATORS
# ============================================

# Boot all required simulators
iphone_udid = boot_appstore_simulator(deviceClass: "iphone_6.9").udid
ipad_udid = boot_appstore_simulator(deviceClass: "ipad_13").udid

# Install app on both
install_app(appPath: APP_PATH, udid: iphone_udid)
install_app(appPath: APP_PATH, udid: ipad_udid)

# Grant all permissions on both (prevents dialog interruptions)
grant_all_permissions(bundleId: BUNDLE_ID, udid: iphone_udid)
grant_all_permissions(bundleId: BUNDLE_ID, udid: ipad_udid)

# ============================================
# PHASE 2: CAPTURE LOOP
# ============================================

for locale in LOCALES:
    for device, udid in [(iphone_6.9, iphone_udid), (ipad_13, ipad_udid)]:

        # Set locale
        set_locale(locale: locale, udid: udid)

        for mode in MODES:
            # Set appearance
            set_appearance(mode: mode, udid: udid)

            # Restart app to apply locale
            terminate_app(bundleId: BUNDLE_ID, udid: udid)
            launch_app(bundleId: BUNDLE_ID, udid: udid)

            # Wait for app to load (you may need to adjust)
            # sleep(2)

            for screen in SCREENS:
                # Navigate to screen
                open_url(url: screen.url, udid: udid)

                # Wait for navigation (adjust as needed)
                # sleep(0.5)

                # Capture screenshot
                output_path = f"{OUTPUT_DIR}/{locale}/{device}/{mode}/{screen.name}.png"
                capture_screenshot(outputPath: output_path, udid: udid)

                # Validate screenshot
                validate_screenshot(filePath: output_path)

# ============================================
# PHASE 3: ADD DEVICE FRAMES (OPTIONAL)
# ============================================

# Add device frames for marketing materials
for locale in LOCALES:
    for device in DEVICES:
        for mode in MODES:
            for screen in SCREENS:
                input_path = f"{OUTPUT_DIR}/{locale}/{device}/{mode}/{screen.name}.png"
                add_frame(inputPath: input_path, shadow: true)
                # Creates: {screen.name}_framed.png

# ============================================
# PHASE 4: CLEANUP
# ============================================

shutdown_simulator(udid: iphone_udid, delete: true)
shutdown_simulator(udid: ipad_udid, delete: true)
```

## Output Directory Structure

```
appstore-screenshots/
├── en_US/
│   ├── iphone_6.9/
│   │   ├── light/
│   │   │   ├── home.png
│   │   │   ├── home_framed.png
│   │   │   ├── feature1.png
│   │   │   └── ...
│   │   └── dark/
│   │       ├── home.png
│   │       └── ...
│   └── ipad_13/
│       ├── light/
│       └── dark/
├── ja_JP/
│   └── ...
├── de_DE/
├── fr_FR/
└── es_ES/
```

## Total Screenshots

With the example configuration:
- 5 locales × 2 devices × 2 modes × 5 screens = **100 screenshots**
- Plus 100 framed versions = **200 total images**

## Optimization Tips

1. **Parallel Simulators**: Boot iPhone and iPad simulators simultaneously
2. **URL Schemes**: Implement deep links for fast navigation
3. **Grant Permissions Early**: Prevents permission dialogs during capture
4. **Consistent Timing**: Add appropriate delays between actions
5. **Validation**: Always validate screenshots after capture
6. **Incremental Updates**: Only re-capture changed screens

## Error Handling

```
# Wrap each capture in try-catch logic
try:
    capture_screenshot(outputPath: path, udid: udid)
except:
    # Log error and continue
    print(f"Failed to capture {path}")
    continue
```

## Pre-flight Checklist

Before running the full automation:

1. [ ] App builds successfully for simulator
2. [ ] All URL schemes are registered and working
3. [ ] App supports all target locales
4. [ ] App supports dark mode (if capturing dark screenshots)
5. [ ] Test single screenshot capture manually first
6. [ ] Verify output directory exists and is writable
7. [ ] Ensure sufficient disk space (screenshots can be large!)
