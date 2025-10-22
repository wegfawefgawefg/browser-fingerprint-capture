// browser-discovery.js
// Auto-discovers installed browsers on Windows, Mac, and Linux

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Common browser installation paths by OS
 */
const BROWSER_PATHS = {
  // Chrome paths
  chrome: {
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    ],
  },

  // Firefox paths
  firefox: {
    linux: [
      '/usr/bin/firefox',
      '/usr/bin/firefox-esr',
      '/snap/bin/firefox',
      '/usr/lib/firefox/firefox',
    ],
    darwin: [
      '/Applications/Firefox.app/Contents/MacOS/firefox',
    ],
    win32: [
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
      process.env.LOCALAPPDATA + '\\Mozilla Firefox\\firefox.exe',
    ],
  },

  // Edge paths (Chromium-based)
  edge: {
    linux: [
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable',
    ],
    darwin: [
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    win32: [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
  },

  // Safari (Mac only)
  safari: {
    darwin: [
      '/Applications/Safari.app/Contents/MacOS/Safari',
    ],
  },

  // Brave
  brave: {
    linux: [
      '/usr/bin/brave-browser',
      '/usr/bin/brave',
      '/snap/bin/brave',
    ],
    darwin: [
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ],
    win32: [
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      process.env.LOCALAPPDATA + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    ],
  },
};

/**
 * Check if a file exists and is executable
 */
function fileExists(filepath) {
  try {
    if (!filepath) return false;
    fs.accessSync(filepath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to find browser using system PATH (which/where command)
 */
function findInPath(browserCommand) {
  try {
    const platform = process.platform;
    const command = platform === 'win32' ? 'where' : 'which';
    const result = execSync(`${command} ${browserCommand}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
    }).trim();

    // On Windows, 'where' can return multiple paths, take the first one
    const firstPath = result.split('\n')[0].trim();

    return firstPath || null;
  } catch {
    return null;
  }
}

/**
 * Discover all installed browsers on the current system
 * @returns {Object} Map of browser names to their executable paths
 */
function discoverBrowsers() {
  const platform = process.platform; // 'linux', 'darwin', 'win32'
  const discovered = {};

  console.log(`🔍 Discovering browsers on ${platform}...\n`);

  // Command names to search in PATH
  const pathCommands = {
    chrome: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'],
    firefox: ['firefox', 'firefox-esr'],
    edge: ['microsoft-edge', 'microsoft-edge-stable', 'msedge'],
    brave: ['brave-browser', 'brave', 'brave-browser-stable'],
  };

  for (const [browserName, paths] of Object.entries(BROWSER_PATHS)) {
    // First try hardcoded paths for this platform
    const platformPaths = paths[platform];

    if (platformPaths) {
      for (const browserPath of platformPaths) {
        if (fileExists(browserPath)) {
          discovered[browserName] = browserPath;
          console.log(`✅ Found ${browserName}: ${browserPath}`);
          break; // Found this browser, move to next
        }
      }
    }

    // If not found yet, try to find in system PATH
    if (!discovered[browserName] && pathCommands[browserName]) {
      for (const command of pathCommands[browserName]) {
        const foundPath = findInPath(command);
        if (foundPath) {
          discovered[browserName] = foundPath;
          console.log(`✅ Found ${browserName}: ${foundPath} (via PATH)`);
          break;
        }
      }
    }
  }

  if (Object.keys(discovered).length === 0) {
    console.log('❌ No browsers found!');
    console.log('Please install Chrome, Firefox, or another supported browser.');
  } else {
    console.log(`\n📊 Total browsers discovered: ${Object.keys(discovered).length}`);
  }

  return discovered;
}

/**
 * Get browser type for Playwright (chrome, firefox, webkit)
 */
function getPlaywrightBrowserType(browserName) {
  switch (browserName) {
    case 'chrome':
    case 'chromium':
    case 'edge':
    case 'brave':
      return 'chromium';
    case 'firefox':
      return 'firefox';
    case 'safari':
      return 'webkit';
    default:
      return null;
  }
}

module.exports = {
  discoverBrowsers,
  getPlaywrightBrowserType,
};
