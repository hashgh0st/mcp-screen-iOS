# Multi-Language Screenshots

Capture App Store screenshots in multiple languages for localization.

## Supported Locales

Common App Store locales:
- `en_US` - English (US)
- `ja_JP` - Japanese
- `zh_CN` - Chinese (Simplified)
- `zh_TW` - Chinese (Traditional)
- `ko_KR` - Korean
- `fr_FR` - French
- `de_DE` - German
- `es_ES` - Spanish
- `it_IT` - Italian
- `pt_BR` - Portuguese (Brazil)

## Workflow

```
# 1. Setup - Boot simulator and install app
boot_appstore_simulator(deviceClass: "iphone_6.9")
install_app(appPath: "/path/to/YourApp.app")
grant_all_permissions(bundleId: "com.example.myapp")

# 2. English (default)
set_locale(locale: "en_US")
terminate_app(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")
# Wait for app to load...
capture_screenshot(outputPath: "./screenshots/en_US/home.png")

# 3. Japanese
set_locale(locale: "ja_JP", language: "ja")
terminate_app(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")
capture_screenshot(outputPath: "./screenshots/ja_JP/home.png")

# 4. Chinese (Simplified)
set_locale(locale: "zh_CN", language: "zh-Hans")
terminate_app(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")
capture_screenshot(outputPath: "./screenshots/zh_CN/home.png")

# 5. Korean
set_locale(locale: "ko_KR", language: "ko")
terminate_app(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")
capture_screenshot(outputPath: "./screenshots/ko_KR/home.png")

# 6. French
set_locale(locale: "fr_FR", language: "fr")
terminate_app(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")
capture_screenshot(outputPath: "./screenshots/fr_FR/home.png")

# 7. German
set_locale(locale: "de_DE", language: "de")
terminate_app(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")
capture_screenshot(outputPath: "./screenshots/de_DE/home.png")

# 8. Spanish
set_locale(locale: "es_ES", language: "es")
terminate_app(bundleId: "com.example.myapp")
launch_app(bundleId: "com.example.myapp")
capture_screenshot(outputPath: "./screenshots/es_ES/home.png")
```

## Directory Structure

```
screenshots/
├── en_US/
│   ├── home.png
│   ├── feature1.png
│   └── feature2.png
├── ja_JP/
│   ├── home.png
│   ├── feature1.png
│   └── feature2.png
├── zh_CN/
│   └── ...
└── ...
```

## Important Notes

1. **App must be restarted** after changing locale for changes to take effect
2. **App must support localization** - screenshots will only show translated text if your app includes the appropriate `.lproj` folders
3. Some system UI elements (like permission dialogs) will also be localized
4. Consider using `grant_all_permissions()` before starting to avoid localized permission dialogs
