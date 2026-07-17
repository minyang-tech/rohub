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

## Notes

The active Electron dependency is not installed yet. This preview intentionally works in a normal browser first, then can be wrapped by Electron later.
