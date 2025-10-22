# Browser Fingerprint Capture Tool

Automated tool to capture real browser fingerprints from all installed browsers on Windows, Mac, and Linux.

## What It Does

- 🔍 **Auto-discovers** all installed browsers (Chrome, Firefox, Brave, Edge, Safari)
- 🌐 **Captures fingerprints** including GPU, screen, hardware, timezone, plugins, etc.
- 💾 **Saves as JSON** files for programmatic use
- 🚫 **Skips duplicates** automatically
- 🖥️ **Cross-platform** - works on Windows, Mac, and Linux

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will:
- Install Playwright
- Automatically download required browser binaries

### 2. Capture Fingerprints

```bash
npm run capture
```

Or:
```bash
node capture-real-fingerprint.js
```

### 3. What Happens

The tool will:
1. Scan your system for installed browsers
2. Launch each browser one by one (you'll see windows open)
3. Capture detailed fingerprint data
4. Save unique fingerprints to `fingerprints/` directory
5. Skip any duplicates

### 4. Collect Results

After running, send the entire `fingerprints/` folder to your team.

## Supported Browsers

- ✅ **Google Chrome** (all platforms)
- ✅ **Firefox** (all platforms)
- ✅ **Microsoft Edge** (Windows/Mac/Linux)
- ✅ **Brave Browser** (all platforms)
- ✅ **Safari** (Mac only)

## Output Files

Fingerprints are saved as JSON files with names like:

```
fingerprints/
├── fingerprint-chrome-2025-10-22-abc123def456.json
├── fingerprint-firefox-2025-10-22-789ghi012jkl.json
└── fingerprint-brave-2025-10-22-mno345pqr678.json
```

Each file contains:
- Navigator properties (userAgent, platform, language, etc.)
- Screen dimensions and color depth
- WebGL vendor and renderer (GPU info)
- Canvas and audio fingerprints
- Hardware info (cores, memory)
- Timezone and locale
- Installed plugins and MIME types
- Feature detection (IndexedDB, localStorage, etc.)

## Using Captured Fingerprints

The `fingerprint-loader.js` module provides easy access to captured fingerprints:

```javascript
const { loadFingerprint } = require('./fingerprint-loader');

// Load a random fingerprint
const fp = await loadFingerprint();

// Load the first fingerprint
const fp = await loadFingerprint({ mode: 'first' });

// Load a specific fingerprint
const fp = await loadFingerprint({
  mode: 'specific',
  filename: 'fingerprint-chrome-2025-10-22-abc123.json'
});

// Generate a fully synthetic fingerprint (pure mode is the default)
const synthetic = await loadFingerprint({
  mode: 'generated',
  seed: 'demo-seed',   // optional for deterministic output
});

// Generate a seeded fingerprint that anchors to a captured template
const seeded = await loadFingerprint({
  mode: 'generated',
  generatedMode: 'seeded',
  seed: 'demo-seed',
});

```

### Generate Single-Use Synthetic Fingerprints

You can also create stand-alone synthetic fingerprints without loading them through code:

```bash
# Preview a pure fingerprint (default mode; JSON printed to stdout)
node generate-fingerprint.js

# Generate a seeded fingerprint and save it
node generate-fingerprint.js --mode seeded --seed demo --save
```

Synthetic fingerprints are tagged with `source: "synthetic"` and filenames starting with `fingerprint-s-`.

- **Pure mode (default)** composes an entirely new fingerprint from the distributions and heuristic defaults, keeping operating-system/browser pairings and hardware characteristics plausible even for scenarios we have no direct captures for.
- **Seeded mode** reuses a captured fingerprint as structural scaffolding, then mutates key attributes using the weighted distributions to stay realistic without drifting too far from observed data.

Both modes sample operating systems, browsers, languages, timezones, and version details from the CSVs in `distribution_data/`.

## Troubleshooting

**No browsers found?**
- Make sure you have at least one supported browser installed
- The tool checks common installation paths and your system PATH

**Browser fails to launch?**
- **Firefox**: Uses Playwright's bundled version (this is normal and expected)
- **Chrome/Brave/Edge**: Should use your actual installed browsers

**"Duplicate fingerprint - skipping"?**
- Normal if you've already captured from this machine
- Only unique fingerprints are saved

**Permission errors?**
- Make sure you have permission to read browser executables
- On Linux, browsers should be in standard paths or PATH

## Requirements

- **Node.js** 14 or higher
- At least one supported browser installed
- ~300MB disk space for Playwright browser binaries

## Dependencies

- `playwright` (^1.56.1) - Browser automation library

## Files

- `capture-real-fingerprint.js` - Main capture script
- `browser-discovery.js` - Cross-platform browser detection
- `fingerprint-loader.js` - Utility for loading captured fingerprints
- `package.json` - Dependencies and scripts

## License

ISC
