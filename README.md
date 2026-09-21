# 🐾 PetDesk

**Purposeful Desktop Companions** — animated pets that actually keep you on track.

> Shimeji-style characters that walk across your screen, pop speech bubbles, and remind you about deadlines with personality.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ (LTS recommended)
- npm (comes with Node.js)

### Install & Run

```bash
# 1. Enter the project folder
cd petdesk

# 2. Install dependencies
npm install

# 3. Launch PetDesk
npm start
```

That's it. Your pet will appear on your desktop immediately.

---

## What You Get (v0.1 — Phase 0 + MVP)

| Feature | Status |
|---|---|
| Animated emoji pet walks across screen | ✅ Working |
| Speech bubbles with personality | ✅ Working |
| Deadline manager (add / complete / delete) | ✅ Working |
| 24h / 2h / overdue alerts via pet | ✅ Working |
| Random check-in messages (100+ lines) | ✅ Working |
| Mood check-in (click pet) | ✅ Working |
| Snooze alerts (30 min) | ✅ Working |
| Completion celebration + confetti | ✅ Working |
| Do Not Disturb mode | ✅ Working |
| Always-on-top toggle | ✅ Working |
| Character picker (8 emoji characters) | ✅ Working |
| Size + opacity sliders | ✅ Working |
| System tray icon | ✅ Working |
| Settings panel | ✅ Working |
| Sprite sheet support | 🔜 Phase 1 |
| Window climbing | 🔜 Phase 2 |
| Calendar sync | 🔜 Phase 3 |
| AI-powered messages (Claude API) | 🔜 Phase 4 |

---

## File Structure

```
petdesk/
├── main.mjs          ← Electron main process (windows, tray, IPC, toasts, startup)
├── preload.cjs       ← contextBridge API (`window.petdesk`) — the renderers' only door to main
├── renderer.mjs      ← Pet window: animation engine + speech bubble logic
├── settings.mjs      ← Settings window logic
├── scheduler.mjs     ← Deadline checker + check-in timer
├── index.html        ← Transparent always-on-top pet window
├── settings.html     ← Settings + deadline manager panel
├── package.json      ← Dependencies + build config
│
├── src/
│   ├── activity/       ← Foreground-app detection (native user32 calls via koffi)
│   ├── notifications/  ← Windows toast notifications + petdesk:// button actions
│   ├── system/         ← Launch-at-login, --hidden, protocol argv helpers
│   └── engine/, pet/, focus/, tasks/, …
│
├── characters/
│   ├── cat/
│   │   └── config.json     ← Animation definitions
│   └── dog/
│       └── config.json
│
└── messages/
    └── lines.json    ← 100+ curated message lines (5 categories)
```

---

## Adding Your Own Characters

1. Create a folder: `characters/your-character/`
2. Add a `config.json` (copy from `characters/cat/config.json`)
3. Optionally add `sprite.png` (Shimeji-compatible format: 64×64 frames in a grid)
4. Your character appears in the Settings → Character picker

**Shimeji sprite packs** from DeviantArt and itch.io work if you map the frames in `config.json`.

---

## Adding Custom Messages

Edit `messages/lines.json`. The format is:

```json
{
  "motivational": ["Line 1", "Line 2"],
  "funny": ["..."],
  "chaotic": ["..."],
  "checkin": ["..."],
  "manifesting": ["..."]
}
```

---

## Building a Distributable

```bash
# Build for your current platform
npm run build

# Output: dist/
# Windows: petdesk-setup-x64.exe (NSIS installer) + petdesk-portable-x64.exe
# Mac:     PetDesk-<version>.dmg
# Linux:   PetDesk-<version>.AppImage
```

No compiler toolchain is needed: the one native piece (`koffi`) ships prebuilt binaries.

**Windows note:** electron-builder unpacks its `winCodeSign` tools with symlinks. If the build stops with
`Cannot create symbolic link : A required privilege is not held by the client`, turn on
*Settings → System → For developers → Developer Mode* (or run the build once from an elevated terminal).

**CI:** `.github/workflows/build.yml` lints, tests and builds on Windows / Linux / macOS and uploads the
installers as artifacts. Add `CSC_LINK` + `CSC_KEY_PASSWORD` repository secrets to get signed builds;
without them the build is unsigned.

---

## Windows Integration

| Feature | How it works |
|---|---|
| **Toast notifications** | Overdue / urgent / warning deadlines and finished focus sessions arrive as Windows toasts and stay in the Action Center. *Snooze* and *Done* buttons work even after the toast has left the screen (they activate `petdesk://` links guarded by a per-install token). The pet still reacts; coaching and petting messages remain speech bubbles. Toggle: Settings → *Windows Notifications*. |
| **Launch on startup** | Registers PetDesk under Task Manager → Startup apps via `app.setLoginItemSettings` and starts it with `--hidden` (tray only, use *Show Pet* in the tray menu). |
| **Single instance** | Launching PetDesk twice just surfaces the pet that is already running. |
| **Foreground detection** | Direct `GetForegroundWindow` calls (~0.2 ms) instead of a PowerShell helper process. |
| **Displays / DPI** | The overlay follows the primary display when resolution, scaling or monitor layout changes. |

---

## Tech Stack

| Layer | Tool |
|---|---|
| Desktop shell | Electron (Node.js) |
| Character rendering | HTML5 Canvas + requestAnimationFrame |
| Window layer | Electron BrowserWindow (transparent, always-on-top) |
| Data storage | electron-store (local JSON) |
| Scheduling | node-cron + setInterval |
| Windows integration | koffi (user32 FFI), Electron toast XML |
| Build | electron-builder + GitHub Actions |
| Code quality | ESM everywhere, sandboxed renderers (contextIsolation), ESLint + Prettier |

---

## Phase Roadmap

| Phase | Timeline | What ships |
|---|---|---|
| **0** *(done)* | Week 1–2 | Electron window, emoji pet, tray icon |
| **1 (MVP)** *(done)* | Week 3–6 | Deadlines, speech bubbles, settings |
| **2** | Week 7–10 | Sprite sheets, window climbing, DnD |
| **3** | Week 11–14 | Multi-monitor, calendar sync |
| **4** | Month 4+ | AI messages (Claude API), marketplace |

---

## Known Limitations (v0.1)

- Characters are emoji-based — sprite sheet PNG support coming in Phase 2
- Window climbing requires OS accessibility permissions (Phase 2)
- No auto-updater yet (manual re-download for now)
- Icons in `assets/` are generated by `npm run icons` — replace them with real artwork any time
- In development (`npm start`) toasts are attributed to the Electron binary; the installed app gets a
  proper "PetDesk" identity from its Start Menu shortcut

---

## Accountability Companion MVP

PetDesk includes local-first focus sessions. Choose a task, start a timer, and let the pet encourage you while you work. Focus sessions can optionally monitor the foreground Windows application so you can define allowed apps for a session.

Activity awareness is opt-in and runs only during an active focus session. The MVP reads the foreground app/window name only; it does not capture screenshots, record keystrokes, use the camera or microphone, or upload data. If activity awareness is unavailable, the timer continues normally.

The first release supports Gentle, Coach, and Playful personalities. A distraction prompt always gives the user a choice to return, pause, or allow the app for the current session. PetDesk never assigns an automatic productivity score.

### Development and testing

```bash
npm install
npm test
npm run lint
npm start
```

Session summaries and focus preferences are stored locally by `electron-store`. The Focus tab includes monitoring status, completed-session history, and a clear-history control. Foreground polling starts only after the user enables activity awareness and starts a focus session, then stops when the session pauses, ends, or the renderer disconnects.

## License

MIT — build on it, fork it, ship it.

*Built with the gap nobody else filled.*
