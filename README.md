# Auto Video Player

A lightweight browser extension that automatically plays videos at **2× speed** and advances to the next video when one ends — across **GeeksForGeeks, YouTube, Udemy, Coursera**, and any other site.

---

## Features

- **2× Playback Speed** — enforced continuously; resets if the site tries to change it.
- **Auto-Advance** — detects when a video ends and clicks the "Next" / "Next Track" button automatically.
- **Cross-Origin iframe Support** — injects into every frame (including sandboxed video iframes) via `all_frames: true`.
- **Idle-Bypass Heartbeat** — simulates subtle pointer and keyboard activity so the page never marks you as idle.
- **SPA / Next.js Compatible** — watches for URL changes and re-scans for new videos automatically.
- **Hardware-Like Clicks** — dispatches full `PointerEvent` + `MouseEvent` chains to satisfy autoplay policies and site click guards.

---

## Installation (Unpacked Extension)

> Requires a Chromium-based browser (Chrome, Edge, Brave, etc.)

1. **Clone or download** this repository.
2. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. The extension is now active on all tabs.

---

## How It Works

### Architecture

```
manifest.json
└── content_scripts → content.js   (injected in every frame of every page)
```

| Frame | Role |
|-------|------|
| **Top GFG / course frame** | Idle-bypass heartbeat · listens for `postMessage` from child iframes · clicks Next button |
| **Video iframe** | Finds `<video>`, sets 2× speed, plays, detects `ended`, then signals top frame via `postMessage` |

### Flow

```
Page loads
  └─► content.js injected in every frame
        ├─► scan() every 2 s → find largest visible <video>
        │     └─► attachVideo()
        │           ├─► set playbackRate = 2.0
        │           ├─► hwClick + video.play()
        │           └─► on 'ended' → requestNext()
        │                 ├─► direct: clickNext(document) / parent / top
        │                 └─► cross-origin fallback: postMessage → top → clickNext()
        └─► idle heartbeat (top frame only, every 15 s)
```

---

## Configuration

Open `content.js` and adjust the constants at the top:

| Constant | Default | Description |
|----------|---------|-------------|
| `SPEED`  | `2.0`   | Playback speed multiplier |
| `MSG_NEXT` | `'__AP_NEXT__'` | Internal cross-frame signal name |

---

## Supported Sites

The extension matches `*://*/*` so it runs everywhere, but the auto-advance logic is tuned for:

- **GeeksForGeeks** (GFG) — "Next »" and "Next Track" buttons
- **YouTube**
- **Udemy**
- **Coursera**

---

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Extension manifest (Manifest V3) |
| `content.js` | Core logic — speed enforcement, idle bypass, auto-advance |

---

## License

MIT — free to use, modify, and distribute.
