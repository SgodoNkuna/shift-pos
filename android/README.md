# Android app (Trusted Web Activity)

The APK is a thin shell around https://shift-pos.pages.dev, opened in Chrome. Web updates reach phones without a new APK.
Alerts work because it runs in Chrome (a plain WebView cannot receive web push).

Rebuild (needs JDK 17+, Android SDK, and the signing key — kept by the owner, **never committed**):

```
cp /path/to/android.keystore android/
cd android && npx @bubblewrap/cli@1.27.0 update --skipVersionUpgrade
BUBBLEWRAP_KEYSTORE_PASSWORD=... BUBBLEWRAP_KEY_PASSWORD=... npx @bubblewrap/cli@1.27.0 build --skipPwaValidation
cp app-release-signed.apk ../app/public/download/hash-lounge.apk
```

Bump `appVersionCode` for each new APK. The key's SHA-256 must match `app/public/.well-known/assetlinks.json`,
otherwise the app shows a browser address bar. Android 7 (API 24) or newer.
