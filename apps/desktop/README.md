# Rohub Desktop App Skeleton

This folder contains the browser/Electron preview shell for Rohub.

The current UI is intentionally flat and simple. It avoids gradients and decorative effects so users can focus on project setup, status, and sync actions.

## Run preview

```powershell
npm run preview:desktop
```

Open the printed local URL, then fill:

- Local agent URL: `http://127.0.0.1:8787`
- Central server URL: `http://127.0.0.1:7070`
- Channel: `main`
- Local `.rbxl/.rbxlx` path

The UI can call:

- `POST /status`
- `POST /push`
- `POST /pull`
- `POST /sync`

## Run Electron app

```powershell
npm run desktop
```

The Electron shell adds:

- Native File menu
- Native Sync menu
- `.rbxl/.rbxlx` file picker
- Secure preload bridge for renderer actions
- Managed local-agent process
- Managed default central-server process

## Build Windows exe

```powershell
npm run dist:win
```

The portable executable is written to `release/Rohub-<version>-Windows.exe`.

## Notes

The browser preview still works without Electron. The Windows executable requires the Electron packaging dependencies.
