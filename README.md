# Browser Fingerprint Generator

Synthetic browser fingerprints for testing, research, and model training. The repo ships with a pure generator that composes fully synthetic fingerprints from weighted distributions, plus an optional seeded mode that mutates real captures. You can still collect real fingerprints locally, but generation is the primary workflow.

## Highlights

- 🎯 **Pure mode (default)** – builds an entire fingerprint (UA, platform, hardware, screen, WebGL, canvas, audio, plugins, feature flags, etc.) by sampling the distributions in `distribution_data/` and curated hardware/device pools.
- 🧬 **Seeded mode (opt-in)** – starts from a captured fingerprint and mutates it with the same distributions for realistic “variations of a real device”.
- 🧳 **Distribution-driven** – OS/browser/language/timezone/version weights live in CSVs so you can rebalance or extend without editing code.
- 🧪 **Programmatic loader** – `loadFingerprint()` can hand you random, specific, seeded, or generated fingerprints directly in Node scripts.
- 📸 **Optional capture** – keep using `capture-real-fingerprint.js` when you need fresh ground-truth data for seeding or benchmarking.

## Quick Start (Pure Generation)

```bash
# 1. Make sure you have Node 18+
# 2. Generate a pure fingerprint (prints JSON to stdout)
node generate-fingerprint.js

# Save the result into fingerprints/
node generate-fingerprint.js --save

# Deterministic run – same seed, same fingerprint
node generate-fingerprint.js --seed demo --save

# Opt into seeded mode when you want template-based output
node generate-fingerprint.js --mode seeded --seed demo --save
```

Generated files live under `fingerprints/` and follow the naming pattern:

```
fingerprints/
└── fingerprint-s-chrome-2025-10-22-xxxx.json
```

Each JSON contains the full fingerprint payload, and `sourceMetadata` records how it was generated (mode, sampled OS/browser/version, seed, template filename if any).

## Using the Loader

```javascript
const { loadFingerprint } = require('./fingerprint-loader');

// Pure synthetic (default)
const pure = await loadFingerprint({ mode: 'generated' });

// Deterministic pure
const deterministic = await loadFingerprint({
  mode: 'generated',
  seed: 'demo',
});

// Seeded variant based on a captured template
const seeded = await loadFingerprint({
  mode: 'generated',
  generatedMode: 'seeded',
  seed: 'demo',
});

// Classic usage still works
const randomCapture = await loadFingerprint();
const specific = await loadFingerprint({ mode: 'specific', filename: 'fingerprint-chrome-2025-10-22-abc123.json' });
```

## Distribution Data

The generator samples everything from the CSVs in `distribution_data/`:

| File | Purpose |
|------|---------|
| `os.csv` | Base OS weights (android, ios, windows, mac os, gnu/linux, …) |
| `browser.csv` | Base browser weights + compatibility enforcement |
| `language.csv` | Primary language code weights |
| `timezone.csv` | Timezone weights (`UTC±HH:MM`) |
| `os_*.csv` | OS-specific version detail weights (e.g., Android version numbers) |
| `browser_*.csv` | Browser-specific version detail weights |

Edit or add rows to rebalance the synthetic population—no code changes needed. The generator combines those weights with curated pools (device names, hardware capabilities, screen presets, WebGL profiles, plugin/mime libraries) to build cohesive fingerprints.

## Optional: Capture Real Fingerprints

The original capture tooling remains for when you need actual device data (e.g., to enrich seeded mode or compare against synthetics).

```bash
npm install
npm run capture        # or: node capture-real-fingerprint.js
```

What happens:

1. Detect installed browsers (Chrome, Firefox, Brave, Edge, Safari).
2. Launch each browser via Playwright (visible windows will open).
3. Capture navigator/screen/hardware/WebGL/canvas/audio/plugins/mime/feature data.
4. Save unique results to `fingerprints/` (existing files aren’t overwritten).

## Project Layout

| Path | Description |
|------|-------------|
| `generate-fingerprint.js` | CLI + module for generating pure/seeded fingerprints |
| `fingerprint-loader.js` | Helper for programmatic loading/generation |
| `distribution_data/` | CSVs defining weighted distributions |
| `capture-real-fingerprint.js` | Playwright-driven capture script (optional) |
| `browser-discovery.js` | Cross-platform browser detection |
| `fingerprints/` | Captured and generated output (git-ignored) |

## Requirements

- Node.js 18+ (pure generation uses only built-ins; Playwright capture still works with Node 14+ if you need it).
- Optional: local browsers installed when running the capture script.

## License

ISC
