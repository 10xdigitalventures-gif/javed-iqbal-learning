# Mobile white-label tenant builds

The `mobile/` Expo app supports white-label per-tenant builds via
environment variables and EAS Build profiles.

## How it works

| Layer | How customised |
|-------|---------------|
| App name, icon, splash | EAS Build env vars + replacement asset files |
| Bundle ID / package | `EXPO_PUBLIC_BUNDLE_ID` / `EXPO_PUBLIC_ANDROID_PKG` |
| Brand color (splash, tab bar, badges) | `EXPO_PUBLIC_BRAND_COLOR` |
| API endpoint | `EXPO_PUBLIC_API_URL` |
| Runtime branding (logo, color) | Fetched from `/tenant/public/{slug}` at startup |
| Module flags (courses, books, etc.) | Fetched from tenant config; UI hides disabled modules |

## Steps to build a white-label app for a new tenant

### 1. Prepare assets
Replace the files below **before** running EAS Build:
```
mobile/assets/icon.png           # 1024x1024 PNG
mobile/assets/adaptive-icon.png  # 1024x1024 PNG (Android foreground)
mobile/assets/splash-icon.png    # Expo splash image
```

### 2. Add an EAS Build profile
In `mobile/eas.json`, duplicate the `tenant-template` profile and fill in
the tenant-specific env vars:

```json
{
  "build": {
    "acme-corp": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": {
        "EXPO_PUBLIC_APP_NAME": "Acme Corp Learning",
        "EXPO_PUBLIC_APP_SLUG": "acme-corp-learning",
        "EXPO_PUBLIC_BUNDLE_ID": "com.acmecorp.learning",
        "EXPO_PUBLIC_ANDROID_PKG": "com.acmecorp.learning",
        "EXPO_PUBLIC_TENANT_SLUG": "acme-corp",
        "EXPO_PUBLIC_BRAND_COLOR": "#2563EB",
        "EAS_PROJECT_ID": "your-new-eas-project-id"
      }
    }
  }
}
```

### 3. Build
```bash
cd mobile
eas build --profile acme-corp --platform android
```

### 4. Runtime branding
The app calls `GET /tenant/public/{slug}` on startup (via `src/tenant.ts`)
and applies:
- `primaryColor` — overrides the hardcoded brand color for tab bar, buttons, badges
- `logoUrl` — replaces the in-app logo shown on the Home screen header
- `moduleFlags` — hides tabs/screens for disabled modules

## 10X Marketplace app

The `mobile-marketplace/` folder is a **separate** standalone Expo app that
shows the 10X expert directory. It does **not** require auth — anyone can
browse experts and tap through to each expert's storefront WebView.

```bash
cd mobile-marketplace
npm install
npx expo start
```

To build for Play Store / App Store:
```bash
eas build --profile production --platform android
```
