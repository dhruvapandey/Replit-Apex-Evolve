# Steam premium candidate

The Steam profile packages the game in a locked-down Electron desktop shell. It removes external
funding, GA4, and portal SDKs. F11 toggles fullscreen.

Build a runnable unpacked application for the current operating system:

```bash
npm run package:steam:dir
```

Build the configured distributable for the current operating system:

```bash
npm run package:steam
```

Before SteamPipe upload:

1. Complete Steam Direct onboarding and obtain the App ID and Depot ID.
2. Copy the generated platform build into `release/steam/content`.
3. Copy the VDF examples from `distribution/steam`, remove `.example`, and replace both IDs.
4. Keep `Preview` set to `1` for the first SteamPipe validation upload.
5. Test on a private beta branch before setting a build live.

The premium edition still needs a final content scope, store art, executable signing/notarization,
achievements, and platform-specific QA before it is store-ready.
