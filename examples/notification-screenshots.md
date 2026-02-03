# Notification Screenshots

Capture screenshots showing your app's push notification UI.

## Basic Notification

```
# 1. Setup
boot_appstore_simulator(deviceClass: "iphone_6.9")
install_app(appPath: "/path/to/YourApp.app")
grant_permission(bundleId: "com.example.myapp", service: "notifications")
launch_app(bundleId: "com.example.myapp")

# 2. Navigate to a screen that looks good with a notification banner
open_url(url: "myapp://home")

# 3. Send a notification
send_notification(
  bundleId: "com.example.myapp",
  title: "New Message",
  body: "John sent you a photo"
)

# 4. Wait a moment for the banner to appear, then capture
# Note: You may need to time this carefully!
capture_screenshot(outputPath: "./screenshots/notification_banner.png")
```

## Rich Notification with Badge

```
send_notification(
  bundleId: "com.example.myapp",
  title: "3 New Messages",
  body: "You have unread messages from John, Sarah, and Mike",
  subtitle: "Messages",
  badge: 3,
  sound: "default"
)
```

## Notification with Custom Data

```
send_notification(
  bundleId: "com.example.myapp",
  title: "Order Shipped!",
  body: "Your order #12345 is on its way",
  customData: {
    orderId: "12345",
    trackingUrl: "https://example.com/track/12345"
  }
)
```

## Grouped Notifications (Thread ID)

```
# Send multiple notifications in the same thread
send_notification(
  bundleId: "com.example.myapp",
  title: "John",
  body: "Hey, are you coming tonight?",
  threadId: "chat-john-123"
)

send_notification(
  bundleId: "com.example.myapp",
  title: "John",
  body: "Let me know!",
  threadId: "chat-john-123"
)
```

## Raw APNS Payload

For complex notifications, use raw payload:

```
send_raw_notification(
  bundleId: "com.example.myapp",
  payload: '{
    "aps": {
      "alert": {
        "title": "Special Offer!",
        "subtitle": "Limited Time",
        "body": "Get 50% off your next purchase"
      },
      "badge": 1,
      "sound": "default",
      "category": "OFFER",
      "mutable-content": 1
    },
    "offer_id": "summer2024",
    "discount": 50
  }'
)
```

## Silent Notification (Background Fetch)

```
# Triggers background fetch without showing UI
send_silent_notification(
  bundleId: "com.example.myapp",
  customData: {
    action: "sync",
    timestamp: "2024-01-15T10:30:00Z"
  }
)
```

## Capturing Notification Center

To capture the full notification center:

```
# 1. Send some notifications first
send_notification(bundleId: "com.example.myapp", title: "Message 1", body: "Hello!")
send_notification(bundleId: "com.example.myapp", title: "Message 2", body: "World!")

# 2. Swipe down from top to open notification center
ui_swipe(startX: 200, startY: 0, endX: 200, endY: 400)

# 3. Capture
capture_screenshot(outputPath: "./screenshots/notification_center.png")

# 4. Dismiss notification center
ui_swipe(startX: 200, startY: 400, endX: 200, endY: 0)
```

## Tips

1. **Timing**: Notification banners disappear after a few seconds - capture quickly!
2. **Grant Permission**: Use `grant_permission(service: "notifications")` to avoid the permission prompt
3. **App State**: App should be in foreground for banner notifications
4. **Badge**: Use `badge: 0` to clear the badge, or omit to leave unchanged
5. **Sound**: Use `sound: "default"` or omit for silent
