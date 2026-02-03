# Dark and Light Mode Screenshots

Capture screenshots in both appearance modes for App Store marketing.

## Why Both Modes?

- Many users prefer dark mode
- Shows your app supports system preferences
- Great for marketing materials
- App Store allows up to 10 screenshots - use some for dark mode!

## Basic Workflow

```
# 1. Setup
boot_appstore_simulator(deviceClass: "iphone_6.9")
install_app(appPath: "/path/to/YourApp.app")
grant_all_permissions(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")

# 2. Light Mode Screenshots
set_appearance(mode: "light")

capture_screenshot(outputPath: "./screenshots/light/01_home.png")

open_url(url: "myapp://feature1")
capture_screenshot(outputPath: "./screenshots/light/02_feature1.png")

open_url(url: "myapp://settings")
capture_screenshot(outputPath: "./screenshots/light/03_settings.png")

# 3. Dark Mode Screenshots
set_appearance(mode: "dark")

open_url(url: "myapp://home")
capture_screenshot(outputPath: "./screenshots/dark/01_home.png")

open_url(url: "myapp://feature1")
capture_screenshot(outputPath: "./screenshots/dark/02_feature1.png")

open_url(url: "myapp://settings")
capture_screenshot(outputPath: "./screenshots/dark/03_settings.png")
```

## Quick Toggle Method

If you just want to toggle and capture:

```
# Capture current state
capture_screenshot(outputPath: "./screenshots/mode1.png")

# Toggle appearance (switches between light and dark)
toggle_appearance()

# Capture other mode
capture_screenshot(outputPath: "./screenshots/mode2.png")
```

## Check Current Mode

```
# Get current appearance mode
get_appearance()
# Returns: { mode: "light" } or { mode: "dark" }
```

## Combining with Localization

Capture dark/light for each language:

```
# English - Light
set_locale(locale: "en_US")
set_appearance(mode: "light")
terminate_app(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")
capture_screenshot(outputPath: "./screenshots/en_US/home_light.png")

# English - Dark
set_appearance(mode: "dark")
capture_screenshot(outputPath: "./screenshots/en_US/home_dark.png")

# Japanese - Light
set_locale(locale: "ja_JP")
set_appearance(mode: "light")
terminate_app(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")
capture_screenshot(outputPath: "./screenshots/ja_JP/home_light.png")

# Japanese - Dark
set_appearance(mode: "dark")
capture_screenshot(outputPath: "./screenshots/ja_JP/home_dark.png")
```

## Keyboard Shortcut Alternative

You can also toggle via the `ui_press_button` tool:

```
# Toggle appearance using Cmd+Shift+A shortcut
ui_press_button(button: "toggleAppearance")
```

## Tips

1. **Consistent Screenshots**: Capture the same screens in both modes for comparison
2. **Test Your App**: Make sure your app actually supports dark mode before capturing
3. **System UI**: Status bar and system dialogs will also change with appearance mode
4. **Colors**: Pay attention to custom colors - they should adapt to dark mode
