#!/usr/bin/env node
/* eslint-disable no-console */

// generate-fingerprint.js
// Supports seeded (template-based) and pure (fully synthetic) browser fingerprint generation.

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const FINGERPRINTS_DIR = path.resolve(__dirname, 'fingerprints');
const DISTRIBUTION_DIR = path.resolve(__dirname, 'distribution_data');

const MOBILE_OS = new Set(['android', 'ios']);

const DEFAULT_PLATFORMS = {
  android: 'Linux armv81',
  ios: 'iPhone',
  'mac os': 'MacIntel',
  windows: 'Win32',
  'gnu/linux based': 'Linux x86_64',
  others: 'Unknown',
};

const BROWSER_OS_COMPATIBILITY = {
  chrome: new Set(['android', 'windows', 'mac os', 'gnu/linux based', 'ios']),
  firefox: new Set(['android', 'windows', 'mac os', 'gnu/linux based']),
  edge: new Set(['windows', 'mac os']),
  safari: new Set(['mac os']),
  'mobile safari': new Set(['ios']),
  brave: new Set(['windows', 'mac os', 'gnu/linux based']),
  opera: new Set(['windows', 'mac os', 'gnu/linux based', 'android']),
  gsa: new Set(['android', 'ios']),
  'samsung browser': new Set(['android']),
  webkit: new Set(['mac os']),
};

const BROWSER_VENDOR = {
  chrome: 'Google Inc.',
  firefox: 'Mozilla Foundation',
  edge: 'Microsoft Corporation',
  safari: 'Apple Inc.',
  'mobile safari': 'Apple Inc.',
  brave: 'Brave Software',
  opera: 'Opera Software',
  gsa: 'Google Inc.',
  'samsung browser': 'Samsung Electronics',
  webkit: 'Apple Inc.',
};

const DEFAULT_WEBGL = {
  android: {
    supported: true,
    vendor: 'Qualcomm',
    renderer: 'Qualcomm Adreno',
    glVendor: 'Qualcomm',
    glRenderer: 'OpenGL ES 3.2 V@415.0',
    version: 'WebGL 1.0',
    shadingLanguageVersion: 'WebGL GLSL ES 1.0',
  },
  ios: {
    supported: true,
    vendor: 'Apple Inc.',
    renderer: 'Apple GPU',
    glVendor: 'Apple Inc.',
    glRenderer: 'Apple GPU',
    version: 'WebGL 2.0',
    shadingLanguageVersion: 'WebGL GLSL ES 3.0',
  },
  windows: {
    supported: true,
    vendor: 'Google Inc.',
    renderer: 'ANGLE (NVIDIA GeForce GTX, Direct3D11)',
    glVendor: 'Google Inc.',
    glRenderer: 'ANGLE',
    version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
    shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
  },
  'mac os': {
    supported: true,
    vendor: 'ATI Technologies Inc.',
    renderer: 'AMD Radeon Pro',
    glVendor: 'ATI Technologies Inc.',
    glRenderer: 'AMD Radeon Pro',
    version: 'WebGL 2.0',
    shadingLanguageVersion: 'WebGL GLSL ES 3.0',
  },
  'gnu/linux based': {
    supported: true,
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel(R) UHD Graphics)',
    glVendor: 'Google Inc.',
    glRenderer: 'ANGLE',
    version: 'WebGL 1.0',
    shadingLanguageVersion: 'WebGL GLSL ES 1.0',
  },
  others: {
    supported: true,
    vendor: 'Google Inc.',
    renderer: 'WebGL Renderer',
    glVendor: 'Google Inc.',
    glRenderer: 'ANGLE',
    version: 'WebGL 1.0',
    shadingLanguageVersion: 'WebGL GLSL ES 1.0',
  },
};

const DEFAULT_AUDIO = {
  supported: true,
  sampleRate: 48000,
  state: 'running',
  maxChannelCount: 2,
};

const DEFAULT_FEATURES_DESKTOP = {
  indexedDB: true,
  localStorage: true,
  sessionStorage: true,
  webgl: true,
  webgl2: true,
  serviceWorker: true,
  notification: true,
  geolocation: true,
};

const DEFAULT_FEATURES_MOBILE = {
  indexedDB: true,
  localStorage: true,
  sessionStorage: true,
  webgl: true,
  webgl2: true,
  serviceWorker: true,
  notification: false,
  geolocation: true,
};

const DEFAULT_SCREENS = {
  android: { width: 412, height: 915, availWidth: 412, availHeight: 865, colorDepth: 24, pixelDepth: 24 },
  ios: { width: 390, height: 844, availWidth: 390, availHeight: 780, colorDepth: 32, pixelDepth: 32 },
  windows: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 },
  'mac os': { width: 1440, height: 900, availWidth: 1440, availHeight: 860, colorDepth: 24, pixelDepth: 24 },
  'gnu/linux based': { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 },
  others: { width: 1280, height: 720, availWidth: 1280, availHeight: 690, colorDepth: 24, pixelDepth: 24 },
};

const SCREEN_PRESETS = {
  android: [
    { width: 360, height: 800, colorDepth: 24, pixelDepth: 24 },
    { width: 390, height: 844, colorDepth: 24, pixelDepth: 24 },
    { width: 412, height: 915, colorDepth: 24, pixelDepth: 24 },
    { width: 430, height: 932, colorDepth: 24, pixelDepth: 24 },
  ],
  ios: [
    { width: 375, height: 812, colorDepth: 32, pixelDepth: 32 },
    { width: 390, height: 844, colorDepth: 32, pixelDepth: 32 },
    { width: 414, height: 896, colorDepth: 32, pixelDepth: 32 },
    { width: 428, height: 926, colorDepth: 32, pixelDepth: 32 },
  ],
  windows: [
    { width: 1920, height: 1080, colorDepth: 24, pixelDepth: 24 },
    { width: 2560, height: 1440, colorDepth: 24, pixelDepth: 24 },
    { width: 1366, height: 768, colorDepth: 24, pixelDepth: 24 },
    { width: 3840, height: 2160, colorDepth: 24, pixelDepth: 24 },
  ],
  'mac os': [
    { width: 1440, height: 900, colorDepth: 24, pixelDepth: 24 },
    { width: 1680, height: 1050, colorDepth: 24, pixelDepth: 24 },
    { width: 2560, height: 1440, colorDepth: 30, pixelDepth: 30 },
    { width: 2880, height: 1800, colorDepth: 30, pixelDepth: 30 },
  ],
  'gnu/linux based': [
    { width: 1920, height: 1080, colorDepth: 24, pixelDepth: 24 },
    { width: 2560, height: 1440, colorDepth: 24, pixelDepth: 24 },
    { width: 1600, height: 900, colorDepth: 24, pixelDepth: 24 },
    { width: 3440, height: 1440, colorDepth: 24, pixelDepth: 24 },
  ],
};

const HARDWARE_FALLBACKS = {
  android: {
    hardwareConcurrency: [4, 6, 8, 12],
    deviceMemory: [4, 6, 8, 12],
    maxTouchPoints: [5, 8, 10],
    doNotTrack: [null, '1', 'unspecified'],
  },
  ios: {
    hardwareConcurrency: [4, 6, 8],
    deviceMemory: [null, null, 4],
    maxTouchPoints: [5, 10],
    doNotTrack: [null, 'unspecified'],
  },
  windows: {
    hardwareConcurrency: [4, 8, 12, 16, 20, 24, 32],
    deviceMemory: [4, 8, 16, 32, 64],
    maxTouchPoints: [0, 0, 1, 5],
    doNotTrack: [null, '1', '0', 'unspecified'],
  },
  'mac os': {
    hardwareConcurrency: [4, 6, 8, 12, 16, 24],
    deviceMemory: [8, 16, 32],
    maxTouchPoints: [0, 0, 1, 3],
    doNotTrack: [null, 'unspecified'],
  },
  'gnu/linux based': {
    hardwareConcurrency: [4, 8, 12, 16, 32],
    deviceMemory: [8, 16, 32],
    maxTouchPoints: [0, 1, 2],
    doNotTrack: [null, 'unspecified'],
  },
  others: {
    hardwareConcurrency: [4, 8],
    deviceMemory: [8, 16],
    maxTouchPoints: [0, 1, 5],
    doNotTrack: [null, 'unspecified'],
  },
};

const ANDROID_DEVICES = [
  'Pixel 8',
  'Pixel 7',
  'Pixel 6',
  'SM-S928U',
  'SM-S918B',
  'SM-G998U',
  'OnePlus 11',
  'MI 13',
];

const IOS_DEVICES = [
  'iPhone; CPU iPhone OS 18_0 like Mac OS X',
  'iPhone; CPU iPhone OS 18_1 like Mac OS X',
  'iPhone; CPU iPhone OS 17_6 like Mac OS X',
  'iPad; CPU OS 17_5 like Mac OS X',
];

const MAC_PLATFORMS = ['MacIntel', 'MacPPC', 'Mac68K'];
const WINDOWS_PLATFORMS = ['Win32', 'Win64', 'Windows'];
const LINUX_PLATFORMS = ['Linux x86_64', 'Linux armv81', 'Linux i686'];

const WEBGL_CANDIDATES = {
  android: [
    {
      supported: true,
      vendor: 'Qualcomm',
      renderer: 'Adreno (TM) 740',
      glVendor: 'Qualcomm',
      glRenderer: 'Adreno (TM) 740',
      version: 'WebGL 2.0 (OpenGL ES 3.2 V@154.0)',
      shadingLanguageVersion: 'WebGL GLSL ES 3.0',
    },
    {
      supported: true,
      vendor: 'ARM',
      renderer: 'Mali-G715',
      glVendor: 'ARM',
      glRenderer: 'Mali-G715',
      version: 'WebGL 2.0',
      shadingLanguageVersion: 'WebGL GLSL ES 3.0',
    },
  ],
  ios: [
    {
      supported: true,
      vendor: 'Apple Inc.',
      renderer: 'Apple GPU',
      glVendor: 'Apple Inc.',
      glRenderer: 'Apple GPU',
      version: 'WebGL 2.0 (OpenGL ES 3.0)',
      shadingLanguageVersion: 'WebGL GLSL ES 3.00',
    },
  ],
  windows: [
    {
      supported: true,
      vendor: 'Google Inc.',
      renderer: 'ANGLE (NVIDIA GeForce RTX 3080, Direct3D11)',
      glVendor: 'Google Inc.',
      glRenderer: 'ANGLE',
      version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0)',
    },
    {
      supported: true,
      vendor: 'Google Inc.',
      renderer: 'ANGLE (Intel(R) UHD Graphics 630, Direct3D11)',
      glVendor: 'Google Inc.',
      glRenderer: 'ANGLE',
      version: 'WebGL 2.0 (OpenGL ES 3.0 Chromium)',
      shadingLanguageVersion: 'WebGL GLSL ES 3.0 (OpenGL ES GLSL ES 3.0)',
    },
  ],
  'mac os': [
    {
      supported: true,
      vendor: 'Apple Inc.',
      renderer: 'Apple M3',
      glVendor: 'Apple Inc.',
      glRenderer: 'Apple M3',
      version: 'WebGL 2.0',
      shadingLanguageVersion: 'WebGL GLSL ES 3.0',
    },
    {
      supported: true,
      vendor: 'ATI Technologies Inc.',
      renderer: 'AMD Radeon RX 6800 XT',
      glVendor: 'ATI Technologies Inc.',
      glRenderer: 'AMD Radeon RX 6800 XT',
      version: 'WebGL 2.0',
      shadingLanguageVersion: 'WebGL GLSL ES 3.0',
    },
  ],
  'gnu/linux based': [
    {
      supported: true,
      vendor: 'Mesa/X.org',
      renderer: 'AMD Radeon RX 5700 XT (RADV NAVI10)',
      glVendor: 'X.Org',
      glRenderer: 'AMD Radeon RX 5700 XT (RADV NAVI10)',
      version: 'WebGL 2.0 (OpenGL ES 3.0 Mesa 24.0)',
      shadingLanguageVersion: 'WebGL GLSL ES 3.0',
    },
    {
      supported: true,
      vendor: 'NVIDIA Corporation',
      renderer: 'NVIDIA GeForce RTX 3060/PCIe/SSE2',
      glVendor: 'NVIDIA Corporation',
      glRenderer: 'NVIDIA GeForce RTX 3060/PCIe/SSE2',
      version: 'WebGL 2.0 (OpenGL ES 3.0 NVIDIA 550.40)',
      shadingLanguageVersion: 'WebGL GLSL ES 3.0',
    },
  ],
};

const AUDIO_SAMPLE_RATES = [44100, 48000];
const AUDIO_STATES = ['running', 'suspended'];

const FEATURE_VARIATION = {
  indexedDB: 0.02,
  localStorage: 0.02,
  sessionStorage: 0.02,
  webgl: 0.05,
  webgl2: 0.2,
  serviceWorker: 0.1,
  notification: 0.3,
  geolocation: 0.1,
};

const PLUGIN_LIBRARY = {
  default: [
    { name: 'Chrome PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
    { name: 'Native Client', description: '', filename: 'internal-nacl-plugin' },
    { name: 'Widevine Content Decryption Module', description: 'Enables playback of protected content', filename: 'widevinecdmadapter.plugin' },
    { name: 'Shockwave Flash', description: 'Shockwave Flash 32.0 r0', filename: 'pepflashplayer.dll' },
    { name: 'QuickTime Plug-in', description: 'QuickTime Plug-in 7.7.3', filename: 'npqtplugin.dll' },
  ],
  mac: [
    { name: 'Java Applet Plug-in', description: 'Java TM Plug-in 2', filename: 'JTPlugin.plugin' },
    { name: 'Silverlight Plug-In', description: '5.1.50901.0', filename: 'Silverlight.plugin' },
  ],
  windows: [
    { name: 'Windows Media Player Plug-in', description: '', filename: 'np-mswmp.dll' },
  ],
};

const MIMETYPE_LIBRARY = {
  default: [
    { type: 'application/pdf', description: '', suffixes: 'pdf' },
    { type: 'application/x-google-chrome-pdf', description: 'Portable Document Format', suffixes: 'pdf' },
    { type: 'application/x-nacl', description: '', suffixes: '' },
  ],
  media: [
    { type: 'video/mp4', description: 'MP4 Video', suffixes: 'mp4' },
    { type: 'audio/webm', description: 'WebM audio', suffixes: 'webm' },
    { type: 'application/x-shockwave-flash', description: 'Shockwave Flash', suffixes: 'swf' },
  ],
};

let distributionCache = null;

function toLowerKey(value, fallback = 'unknown') {
  if (!value || typeof value !== 'string') return fallback;
  return value.trim().toLowerCase() || fallback;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createPRNG(seed) {
  if (seed === undefined || seed === null) {
    return () => Math.random();
  }

  let hash = seed;
  if (typeof seed === 'string') {
    const hashBuffer = crypto.createHash('sha256').update(seed).digest();
    hash = hashBuffer.readUInt32LE(0);
  }
  hash = hash >>> 0;

  return function prng() {
    hash += 0x6d2b79f5;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pushValue(map, key, value) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
}

function pickRandom(list, rand) {
  if (!Array.isArray(list) || !list.length) return undefined;
  const index = Math.floor(rand() * list.length);
  return list[Math.max(0, Math.min(index, list.length - 1))];
}

function maybeReplace(current, candidates, rand, chance, cloneFn = x => x) {
  if (!candidates || !candidates.length) return current;
  if (rand() >= chance) return current;

  let next = pickRandom(candidates, rand);
  if (next === undefined) return current;

  const currentSerialized = JSON.stringify(current);
  let attempts = candidates.length;
  while (attempts > 0 && JSON.stringify(next) === currentSerialized) {
    next = pickRandom(candidates, rand);
    attempts -= 1;
  }

  return cloneFn(next);
}

function sampleNumeric(list, rand, fallback) {
  if (list && list.length) {
    const value = pickRandom(list, rand);
    if (value !== undefined) return value;
  }
  return fallback;
}

function sampleFromArray(primary, fallback, rand, defaultValue) {
  if (Array.isArray(primary) && primary.length) {
    return pickRandom(primary, rand);
  }
  if (Array.isArray(fallback) && fallback.length) {
    return pickRandom(fallback, rand);
  }
  if (typeof defaultValue === 'function') {
    return defaultValue();
  }
  if (Array.isArray(defaultValue)) {
    return pickRandom(defaultValue, rand);
  }
  return defaultValue;
}

function randomInt(min, max, rand) {
  const r = rand();
  return Math.floor(r * (max - min + 1)) + min;
}

function randomBool(probability, rand) {
  return rand() < probability;
}

function randomSubset(list, rand, { min = 0, max = list.length } = {}) {
  if (!Array.isArray(list) || !list.length) return [];
  const count = Math.min(list.length, randomInt(min, max, rand));
  const pool = [...list];
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(rand() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function generateRandomCanvas(rand, { minLength = 512, maxLength = 2048 } = {}) {
  const length = randomInt(minLength, maxLength, rand);
  const buffer = crypto.randomBytes(length);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function isUserAgentCompatible(userAgent, osCategory) {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  switch (osCategory) {
    case 'android':
      return lower.includes('android');
    case 'ios':
      return lower.includes('iphone') || lower.includes('ipad');
    case 'windows':
      return lower.includes('windows');
    case 'mac os':
      return lower.includes('macintosh') || lower.includes('mac os x');
    case 'gnu/linux based':
      return lower.includes('linux') || lower.includes('x11');
    default:
      return true;
  }
}

function isPlatformCompatible(platform, osCategory) {
  if (!platform) return false;
  const lower = platform.toLowerCase();
  switch (osCategory) {
    case 'android':
      return lower.includes('linux') || lower.includes('android');
    case 'ios':
      return lower.includes('iphone') || lower.includes('ipad');
    case 'windows':
      return lower.includes('win');
    case 'mac os':
      return lower.includes('mac');
    case 'gnu/linux based':
      return lower.includes('linux');
    default:
      return true;
  }
}

function computeFingerprintHash(fingerprint) {
  const basis = JSON.stringify({
    userAgent: fingerprint.navigator?.userAgent,
    platform: fingerprint.navigator?.platform,
    gpuVendor: fingerprint.webgl?.vendor,
    gpuRenderer: fingerprint.webgl?.renderer,
    hardwareConcurrency: fingerprint.navigator?.hardwareConcurrency,
    deviceMemory: fingerprint.navigator?.deviceMemory,
    screen: fingerprint.screen,
    browserName: fingerprint.browserName,
  });
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 12);
}

function stripBom(value) {
  if (!value) return value;
  return value.replace(/^\ufeff/, '');
}

function parseWeightedCsv(content) {
  const lines = stripBom(content).replace(/\r/g, '').split('\n');
  if (lines.length <= 1) return [];

  const result = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const cleaned = stripBom(line);
    const parts = cleaned.split(',');
    if (parts.length < 2) continue;

    const rawCategory = stripBom(parts[0]).replace(/^"+|"+$/g, '').trim();
    const rawWeight = parts.slice(1).join(',').replace(/^"+|"+$/g, '').trim();
    if (!rawCategory) continue;

    const weight = Number(rawWeight);
    if (!Number.isFinite(weight)) continue;

    result.push({
      label: rawCategory,
      key: rawCategory.toLowerCase(),
      weight,
    });
  }

  return result;
}

async function loadWeightedCsv(filename) {
  try {
    const filepath = path.join(DISTRIBUTION_DIR, filename);
    const content = await fs.readFile(filepath, 'utf8');
    return parseWeightedCsv(content);
  } catch (error) {
    return [];
  }
}

function sampleWeightedCategory(entries, allowedKeys, rand) {
  if (!entries || !entries.length) return null;

  let filtered = entries;
  if (allowedKeys && allowedKeys.size) {
    filtered = entries.filter(entry => allowedKeys.has(entry.key));
  }

  if (!filtered.length) return null;

  const total = filtered.reduce((sum, entry) => sum + (entry.weight || 0), 0);
  if (total <= 0) {
    return pickRandom(filtered, rand);
  }

  const target = rand() * total;
  let cumulative = 0;
  for (const entry of filtered) {
    cumulative += entry.weight || 0;
    if (target <= cumulative) return entry;
  }

  return filtered[filtered.length - 1];
}

function detectOsCategory(fingerprint) {
  const platform = toLowerKey(fingerprint.navigator?.platform || '');
  const ua = toLowerKey(fingerprint.navigator?.userAgent || '');
  const browser = toLowerKey(fingerprint.browserName || '');

  if (platform.includes('iphone') || platform.includes('ipad') || browser === 'mobile safari') {
    return 'ios';
  }

  if (platform.includes('mac')) {
    return 'mac os';
  }

  if (platform.includes('win')) {
    return 'windows';
  }

  if (platform.includes('android') || ua.includes('android') || browser === 'samsung browser') {
    return 'android';
  }

  if (platform.includes('linux')) {
    return 'gnu/linux based';
  }

  return 'others';
}

async function ensureDistributions() {
  if (distributionCache) return distributionCache;

  const [browser, os, language, timezone] = await Promise.all([
    loadWeightedCsv('browser.csv'),
    loadWeightedCsv('os.csv'),
    loadWeightedCsv('language.csv'),
    loadWeightedCsv('timezone.csv'),
  ]);

  const browserVersions = {};
  await Promise.all(
    Object.entries(BROWSER_OS_COMPATIBILITY).map(async ([browserKey]) => {
      const filename = `browser_${browserKey.replace(/\\s+/g, '_')}.csv`;
      browserVersions[browserKey] = await loadWeightedCsv(filename);
    }),
  );

  const osDetails = {};
  await Promise.all(
    Object.keys(DEFAULT_PLATFORMS).map(async osKey => {
      const filename = OS_DETAIL_FILENAME_BY_CATEGORY[osKey];
      if (!filename) {
        osDetails[osKey] = [];
        return;
      }
      osDetails[osKey] = await loadWeightedCsv(filename);
    }),
  );

  distributionCache = {
    browser,
    os,
    language,
    timezone,
    browserVersions,
    osDetails,
  };

  return distributionCache;
}

const OS_DETAIL_FILENAME_BY_CATEGORY = {
  android: 'os_android.csv',
  windows: 'os_windows.csv',
  ios: 'os_ios.csv',
  'mac os': 'os_mac.csv',
  'gnu/linux based': 'os_linux.csv',
};

async function loadSourceFingerprints(options = {}) {
  const { includeSynthetic = false } = options;
  let files = [];
  try {
    files = await fs.readdir(FINGERPRINTS_DIR);
  } catch (error) {
    throw new Error(`Cannot read fingerprints directory: ${FINGERPRINTS_DIR}`);
  }

  const records = [];
  for (const filename of files) {
    if (!filename.endsWith('.json')) continue;
    const filepath = path.join(FINGERPRINTS_DIR, filename);
    try {
      const content = await fs.readFile(filepath, 'utf8');
      const data = JSON.parse(content);
      if (!includeSynthetic && (data.synthetic || data.source === 'synthetic')) {
        continue;
      }
      const browserKey = toLowerKey(data.browserName);
      const osCategory = detectOsCategory(data);
      records.push({
        filename,
        filepath,
        fingerprint: data,
        browserKey,
        osCategory,
      });
    } catch (error) {
      // Skip malformed files.
    }
  }

  if (!records.length) {
    throw new Error('No source fingerprints available for generation.');
  }

  return buildAggregates(records);
}

function buildAggregates(records) {
  const aggregates = {
    records,
    byBrowser: new Map(),
    byPlatform: new Map(),
    byOsCategory: new Map(),
    byOsBrowser: new Map(),
    browsersByOsCategory: new Map(),
    navigatorsByOsBrowser: new Map(),
    navigatorsGlobal: [],
    platformsByOsCategory: new Map(),
    languagesByBrowser: new Map(),
    languagesByPlatform: new Map(),
    languagesByCode: new Map(),
    languagesGlobal: [],
    timezonesByBrowser: new Map(),
    timezonesByPlatform: new Map(),
    timezonesByOffset: new Map(),
    timezonesByOsCategory: new Map(),
    timezonesGlobal: [],
    hardwareConcurrencyByPlatform: new Map(),
    hardwareConcurrencyByOsCategory: new Map(),
    hardwareConcurrencyGlobal: [],
    deviceMemoryByPlatform: new Map(),
    deviceMemoryByOsCategory: new Map(),
    deviceMemoryGlobal: [],
    maxTouchPointsByPlatform: new Map(),
    maxTouchPointsByOsCategory: new Map(),
    maxTouchPointsGlobal: [],
    screensByPlatform: new Map(),
    screensByOsCategory: new Map(),
    screensGlobal: [],
    userAgentsByBrowser: new Map(),
    userAgentsGlobal: [],
    doNotTrackByBrowser: new Map(),
    doNotTrackGlobal: [],
    webglByOsCategory: new Map(),
    canvasByOsCategory: new Map(),
    audioByOsCategory: new Map(),
    featuresByBrowser: new Map(),
    pluginsByBrowser: new Map(),
    mimeTypesByBrowser: new Map(),
    supportedBrowsers: new Set(),
    supportedOsCategories: new Set(),
  };

  for (const record of records) {
    const fp = record.fingerprint;
    const browserKey = record.browserKey;
    const osCategory = record.osCategory;
    const platformKey = toLowerKey(fp.navigator?.platform);

    aggregates.supportedBrowsers.add(browserKey);
    aggregates.supportedOsCategories.add(osCategory);

    pushValue(aggregates.byBrowser, browserKey, record);
    pushValue(aggregates.byPlatform, platformKey, record);
    pushValue(aggregates.byOsCategory, osCategory, record);

    const osBrowserKey = `${osCategory}::${browserKey}`;
    pushValue(aggregates.byOsBrowser, osBrowserKey, record);

    if (!aggregates.browsersByOsCategory.has(osCategory)) {
      aggregates.browsersByOsCategory.set(osCategory, new Set());
    }
    aggregates.browsersByOsCategory.get(osCategory).add(browserKey);

    if (fp.navigator?.platform) {
      pushValue(aggregates.platformsByOsCategory, osCategory, fp.navigator.platform);
    }

    if (fp.navigator) {
      const navigatorClone = clone(fp.navigator);
      pushValue(aggregates.navigatorsByOsBrowser, osBrowserKey, navigatorClone);
      aggregates.navigatorsGlobal.push(navigatorClone);
    }

    const languages = Array.isArray(fp.navigator?.languages)
      ? fp.navigator.languages.filter(Boolean)
      : [];
    if (languages.length) {
      const cloneLanguages = [...languages];
      pushValue(aggregates.languagesByBrowser, browserKey, cloneLanguages);
      pushValue(aggregates.languagesByPlatform, platformKey, cloneLanguages);
      aggregates.languagesGlobal.push(cloneLanguages);

      const primaryCode = toLowerKey(cloneLanguages[0]?.split('-')[0]);
      if (primaryCode) {
        pushValue(aggregates.languagesByCode, primaryCode, cloneLanguages);
      }
      for (const entry of cloneLanguages) {
        const code = toLowerKey(entry.split('-')[0]);
        if (code) {
          pushValue(aggregates.languagesByCode, code, cloneLanguages);
        }
      }
    }

    if (fp.timezone && (fp.timezone.offset !== undefined || fp.timezone.name)) {
      const tzClone = { ...fp.timezone };
      pushValue(aggregates.timezonesByBrowser, browserKey, tzClone);
      pushValue(aggregates.timezonesByPlatform, platformKey, tzClone);
      pushValue(aggregates.timezonesByOsCategory, osCategory, tzClone);
      aggregates.timezonesGlobal.push(tzClone);

      if (Number.isFinite(tzClone.offset)) {
        pushValue(aggregates.timezonesByOffset, tzClone.offset, tzClone);
      }
    }

    const hw = fp.navigator?.hardwareConcurrency;
    if (typeof hw === 'number' && Number.isFinite(hw)) {
      pushValue(aggregates.hardwareConcurrencyByPlatform, platformKey, hw);
      pushValue(aggregates.hardwareConcurrencyByOsCategory, osCategory, hw);
      aggregates.hardwareConcurrencyGlobal.push(hw);
    }

    const devMem = fp.navigator?.deviceMemory;
    if (typeof devMem === 'number' && Number.isFinite(devMem)) {
      pushValue(aggregates.deviceMemoryByPlatform, platformKey, devMem);
      pushValue(aggregates.deviceMemoryByOsCategory, osCategory, devMem);
      aggregates.deviceMemoryGlobal.push(devMem);
    }

    const touch = fp.navigator?.maxTouchPoints;
    if (typeof touch === 'number' && Number.isFinite(touch)) {
      pushValue(aggregates.maxTouchPointsByPlatform, platformKey, touch);
      pushValue(aggregates.maxTouchPointsByOsCategory, osCategory, touch);
      aggregates.maxTouchPointsGlobal.push(touch);
    }

    if (fp.screen && Number.isFinite(fp.screen.width) && Number.isFinite(fp.screen.height)) {
      const screenClone = { ...fp.screen };
      pushValue(aggregates.screensByPlatform, platformKey, screenClone);
      pushValue(aggregates.screensByOsCategory, osCategory, screenClone);
      aggregates.screensGlobal.push(screenClone);
    }

    if (fp.navigator?.userAgent) {
      pushValue(aggregates.userAgentsByBrowser, browserKey, fp.navigator.userAgent);
      aggregates.userAgentsGlobal.push(fp.navigator.userAgent);
    }

    const dnt = fp.navigator?.doNotTrack;
    if (dnt !== undefined && dnt !== null) {
      pushValue(aggregates.doNotTrackByBrowser, browserKey, dnt);
      aggregates.doNotTrackGlobal.push(dnt);
    }

    if (fp.webgl) {
      pushValue(aggregates.webglByOsCategory, osCategory, { ...fp.webgl });
    }

    if (fp.canvas) {
      pushValue(aggregates.canvasByOsCategory, osCategory, fp.canvas);
    }

    if (fp.audio) {
      pushValue(aggregates.audioByOsCategory, osCategory, { ...fp.audio });
    }

    if (fp.features) {
      pushValue(aggregates.featuresByBrowser, browserKey, { ...fp.features });
    }

    if (Array.isArray(fp.plugins)) {
      pushValue(aggregates.pluginsByBrowser, browserKey, clone(fp.plugins));
    }

    if (Array.isArray(fp.mimeTypes)) {
      pushValue(aggregates.mimeTypesByBrowser, browserKey, clone(fp.mimeTypes));
    }
  }

  return aggregates;
}

function sampleLanguageSet(aggregates, distributions, rand) {
  const languageEntry = sampleWeightedCategory(distributions.language, null, rand);
  if (!languageEntry) {
    return {
      languages: pickRandom(aggregates.languagesGlobal, rand) || ['en-US', 'en'],
      code: 'en',
    };
  }

  const code = toLowerKey(languageEntry.label);
  const candidates = aggregates.languagesByCode.get(code);
  if (candidates && candidates.length) {
    return {
      languages: [...pickRandom(candidates, rand)],
      code,
    };
  }

  const lower = code.toLowerCase();
  const upper = lower.toUpperCase();
  return {
    languages: [`${lower}-${upper}`, lower],
    code,
  };
}

function timezoneLabelToOffset(label) {
  const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(label);
  if (!match) return null;

  const sign = match[1] === '-' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  return sign * (hours * 60 + minutes);
}

function sampleTimezoneObject(aggregates, distributions, rand, osCategory) {
  const tzEntry = sampleWeightedCategory(distributions.timezone, null, rand);
  if (!tzEntry) {
    const fallback = pickRandom(aggregates.timezonesByOsCategory.get(osCategory), rand)
      || pickRandom(aggregates.timezonesGlobal, rand);
    if (fallback) {
      return { timezone: { ...fallback }, label: fallback.name || null };
    }
    return { timezone: { offset: 0, name: 'UTC+00:00' }, label: 'UTC+00:00' };
  }

  const label = tzEntry.label;
  const offset = timezoneLabelToOffset(label);
  if (offset === null) {
    return { timezone: { offset: 0, name: label }, label };
  }

  const candidates = aggregates.timezonesByOffset.get(offset);
  if (candidates && candidates.length) {
    return { timezone: { ...pickRandom(candidates, rand) }, label };
  }

  return { timezone: { offset, name: label }, label };
}

function sampleBrowserVersion(browserKey, distributions, rand) {
  const versions = distributions.browserVersions[browserKey];
  if (!versions || !versions.length) {
    return { label: null };
  }

  const entry = sampleWeightedCategory(versions, null, rand);
  if (!entry) return { label: null };
  return { label: entry.label };
}

function sampleOsDetail(osCategory, distributions, rand) {
  const details = distributions.osDetails[osCategory];
  if (!details || !details.length) {
    return { label: null };
  }

  const entry = sampleWeightedCategory(details, null, rand);
  if (!entry) return { label: null };
  return { label: entry.label };
}

function replaceVersionToken(text, token, replacement) {
  if (!text || !token || !replacement) return text;
  const regex = new RegExp(`${token}\\/(\\d+(?:\\.\\d+)*)`);
  if (regex.test(text)) {
    return text.replace(regex, `${token}/${replacement}`);
  }
  return text;
}

function applyBrowserVersion(fingerprint, browserKey, versionLabel) {
  if (!versionLabel || !fingerprint.navigator) return;

  const navigatorData = fingerprint.navigator;
  let userAgent = navigatorData.userAgent || '';
  let appVersion = navigatorData.appVersion || userAgent;
  const major = String(versionLabel).trim();

  switch (browserKey) {
    case 'chrome':
    case 'brave':
    case 'opera':
    case 'edge':
      userAgent = replaceVersionToken(userAgent, 'Chrome', `${major}.0.0.0`);
      appVersion = replaceVersionToken(appVersion, 'Chrome', `${major}.0.0.0`);
      if (browserKey === 'edge') {
        userAgent = replaceVersionToken(userAgent, 'Edg', `${major}.0.0.0`);
      }
      break;
    case 'firefox':
      userAgent = replaceVersionToken(userAgent, 'Firefox', `${major}.0`);
      appVersion = replaceVersionToken(appVersion, 'Firefox', `${major}.0`);
      break;
    case 'safari':
      userAgent = replaceVersionToken(userAgent, 'Version', `${major}.0`);
      appVersion = replaceVersionToken(appVersion, 'Version', `${major}.0`);
      break;
    case 'mobile safari':
      userAgent = replaceVersionToken(userAgent, 'Version', `${major}`);
      appVersion = replaceVersionToken(appVersion, 'Version', `${major}`);
      break;
    case 'gsa':
      userAgent = replaceVersionToken(userAgent, 'GSA', `${major}.0`);
      break;
    case 'samsung browser':
      userAgent = replaceVersionToken(userAgent, 'SamsungBrowser', `${major}.0`);
      break;
    default:
      break;
  }

  fingerprint.navigator.userAgent = userAgent;
  if (fingerprint.navigator.appVersion) {
    fingerprint.navigator.appVersion = appVersion;
  }
}

function applyOsDetail(fingerprint, osCategory, detailLabel) {
  if (!detailLabel || !fingerprint.navigator) return;
  const navigatorData = fingerprint.navigator;
  let userAgent = navigatorData.userAgent || '';
  const formattedDot = detailLabel.replace(/_/g, '.');

  switch (osCategory) {
    case 'android':
      userAgent = userAgent.replace(/Android [^;\\)]+/, `Android ${formattedDot}`);
      break;
    case 'ios':
      userAgent = userAgent.replace(/OS [0-9_]+/, `OS ${detailLabel}`);
      break;
    case 'mac os':
      userAgent = userAgent.replace(/Mac OS X [0-9_]+/, `Mac OS X ${detailLabel}`);
      break;
    case 'windows':
      userAgent = userAgent.replace(/Windows NT [0-9.]+/, `Windows NT ${formattedDot}`);
      break;
    default:
      break;
  }

  fingerprint.navigator.userAgent = userAgent;
}

function buildDefaultNavigator(osCategory, browserKey, languageSet, hardware, rand, osDetailLabel) {
  const primaryLanguage = languageSet[0] || 'en-US';
  const vendor = BROWSER_VENDOR[browserKey] || 'Google Inc.';
  const platform = sampleFromArray(
    osCategory === 'mac os' ? MAC_PLATFORMS : osCategory === 'windows' ? WINDOWS_PLATFORMS : osCategory === 'gnu/linux based' ? LINUX_PLATFORMS : null,
    null,
    rand,
    DEFAULT_PLATFORMS[osCategory] || DEFAULT_PLATFORMS.others,
  );
  const androidVersion = osDetailLabel ? osDetailLabel.replace(/_/g, '.') : sampleFromArray(null, ['13', '14', '12'], rand, '14');
  const iosDevice = sampleFromArray(null, IOS_DEVICES, rand, IOS_DEVICES[0]);
  const androidDevice = sampleFromArray(null, ANDROID_DEVICES, rand, ANDROID_DEVICES[0]);
  const macVersion = osDetailLabel ? osDetailLabel.replace(/_/g, '_') : '10_15_7';
  const windowsVersion = osDetailLabel ? osDetailLabel.replace(/_/g, '.') : '10.0';

  let userAgent;

  switch (browserKey) {
    case 'chrome':
      if (osCategory === 'android') {
        userAgent = `Mozilla/5.0 (Linux; Android ${androidVersion}; ${androidDevice}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36`;
      } else if (osCategory === 'ios') {
        userAgent = `Mozilla/5.0 (${iosDevice}) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1`;
      } else if (osCategory === 'windows') {
        userAgent = `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
      } else if (osCategory === 'mac os') {
        userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
      } else {
        userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
      }
      break;
    case 'firefox':
      if (osCategory === 'android') {
        userAgent = `Mozilla/5.0 (Android ${androidVersion}; Mobile; rv:140.0) Gecko/20100101 Firefox/140.0`;
      } else if (osCategory === 'windows') {
        userAgent = `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0`;
      } else if (osCategory === 'mac os') {
        userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}; rv:140.0) Gecko/20100101 Firefox/140.0`;
      } else {
        userAgent = `Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0`;
      }
      break;
    case 'safari':
    case 'webkit':
      userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15`;
      break;
    case 'mobile safari':
      userAgent = `Mozilla/5.0 (${iosDevice}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1`;
      break;
    case 'edge':
      if (osCategory === 'mac os') {
        userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0`;
      } else {
        userAgent = `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0`;
      }
      break;
    case 'brave':
      if (osCategory === 'windows') {
        userAgent = `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
      } else if (osCategory === 'mac os') {
        userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
      } else {
        userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
      }
      break;
    case 'opera':
      userAgent = `Mozilla/5.0 (${osCategory === 'windows' ? `Windows NT ${windowsVersion}; Win64; x64` : 'X11; Linux x86_64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/120.0.0.0`;
      break;
    case 'gsa':
      userAgent = osCategory === 'android'
        ? `Mozilla/5.0 (Linux; Android ${androidVersion}; ${androidDevice}) AppleWebKit/537.36 (KHTML, like Gecko) GSA/123.0.0.0 Mobile Safari/537.36`
        : `Mozilla/5.0 (${iosDevice}) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/123.0.0.0 Mobile/15E148 Safari/604.1`;
      break;
    case 'samsung browser':
      userAgent = `Mozilla/5.0 (Linux; Android ${androidVersion}; ${androidDevice}) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/120.0.0.0 Mobile Safari/537.36`;
      break;
    default:
      userAgent = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
  }

  return {
    userAgent,
    appVersion: userAgent,
    platform,
    vendor,
    language: primaryLanguage,
    languages: [...languageSet],
    cookieEnabled: true,
    doNotTrack: hardware.doNotTrack ?? null,
    hardwareConcurrency: hardware.hardwareConcurrency,
    deviceMemory: hardware.deviceMemory,
    maxTouchPoints: hardware.maxTouchPoints,
    product: 'Gecko',
    productSub: '20030107',
    webdriver: false,
  };
}

function buildNavigatorFromTemplate(template, overrides) {
  const navigatorData = overrides.defaultNavigator ? clone(overrides.defaultNavigator) : {};

  if (template) {
    const templateClone = clone(template);

    Object.entries(templateClone).forEach(([key, value]) => {
      if (
        [
          'userAgent',
          'appVersion',
          'platform',
          'languages',
          'language',
          'hardwareConcurrency',
          'deviceMemory',
          'maxTouchPoints',
          'doNotTrack',
        ].includes(key)
      ) {
        return;
      }
      navigatorData[key] = value;
    });

    if (isUserAgentCompatible(templateClone.userAgent, overrides.osCategory)) {
      navigatorData.userAgent = templateClone.userAgent;
      navigatorData.appVersion = templateClone.appVersion || templateClone.userAgent;
    }

    if (isPlatformCompatible(templateClone.platform, overrides.osCategory)) {
      navigatorData.platform = templateClone.platform;
    }
  }

  navigatorData.languages = [...overrides.languageSet];
  navigatorData.language = overrides.languageSet[0] || navigatorData.language || 'en-US';
  navigatorData.platform =
    overrides.platform ||
    navigatorData.platform ||
    DEFAULT_PLATFORMS[overrides.osCategory] ||
    DEFAULT_PLATFORMS.others;
  navigatorData.vendor =
    navigatorData.vendor ||
    BROWSER_VENDOR[overrides.browserKey] ||
    'Google Inc.';
  navigatorData.cookieEnabled = navigatorData.cookieEnabled !== undefined ? navigatorData.cookieEnabled : true;
  navigatorData.product = navigatorData.product || 'Gecko';
  navigatorData.productSub = navigatorData.productSub || '20030107';
  navigatorData.webdriver = false;

  if (overrides.hardwareConcurrency !== undefined && overrides.hardwareConcurrency !== null) {
    navigatorData.hardwareConcurrency = overrides.hardwareConcurrency;
  } else if (navigatorData.hardwareConcurrency === undefined) {
    navigatorData.hardwareConcurrency = MOBILE_OS.has(overrides.osCategory) ? 8 : 16;
  }

  if (overrides.deviceMemory !== undefined) {
    navigatorData.deviceMemory = overrides.deviceMemory;
  }

  if (overrides.maxTouchPoints !== undefined && overrides.maxTouchPoints !== null) {
    navigatorData.maxTouchPoints = overrides.maxTouchPoints;
  } else if (navigatorData.maxTouchPoints === undefined) {
    navigatorData.maxTouchPoints = MOBILE_OS.has(overrides.osCategory) ? 5 : 0;
  }

  navigatorData.doNotTrack =
    overrides.doNotTrack ??
    navigatorData.doNotTrack ??
    null;

  navigatorData.userAgent = navigatorData.userAgent || (overrides.defaultNavigator ? overrides.defaultNavigator.userAgent : '');
  navigatorData.appVersion = navigatorData.appVersion || navigatorData.userAgent;

  return navigatorData;
}

function buildWebGL(aggregates, osCategory, rand) {
  const candidates = aggregates.webglByOsCategory.get(osCategory)
    || aggregates.webglByOsCategory.get('others');
  if (candidates && candidates.length && rand() < 0.6) {
    return { ...pickRandom(candidates, rand) };
  }
  const fallback = WEBGL_CANDIDATES[osCategory];
  if (fallback && fallback.length) {
    return { ...pickRandom(fallback, rand) };
  }
  return { ...(DEFAULT_WEBGL[osCategory] || DEFAULT_WEBGL.others) };
}

function buildCanvas(aggregates, osCategory, rand) {
  const candidates = aggregates.canvasByOsCategory.get(osCategory)
    || aggregates.canvasByOsCategory.get('others')
    || aggregates.canvasByOsCategory.get('mac os')
    || aggregates.canvasByOsCategory.get('gnu/linux based');
  if (candidates && candidates.length && rand() < 0.5) {
    return pickRandom(candidates, rand);
  }
  return generateRandomCanvas(rand);
}

function buildAudio(aggregates, osCategory, rand) {
  const candidates = aggregates.audioByOsCategory.get(osCategory)
    || aggregates.audioByOsCategory.get('others');
  const audio = candidates && candidates.length && rand() < 0.6
    ? { ...pickRandom(candidates, rand) }
    : { ...DEFAULT_AUDIO };
  audio.sampleRate = sampleFromArray(null, AUDIO_SAMPLE_RATES, rand, audio.sampleRate || DEFAULT_AUDIO.sampleRate);
  audio.state = sampleFromArray(null, AUDIO_STATES, rand, audio.state || DEFAULT_AUDIO.state);
  audio.maxChannelCount = sampleFromArray(null, [1, 2, 2, 2, 6, 8], rand, audio.maxChannelCount || DEFAULT_AUDIO.maxChannelCount);
  return audio;
}

function buildFeatures(aggregates, browserKey, osCategory, rand) {
  const candidates = aggregates.featuresByBrowser.get(browserKey);
  const base = candidates && candidates.length && rand() < 0.6
    ? { ...pickRandom(candidates, rand) }
    : MOBILE_OS.has(osCategory)
      ? { ...DEFAULT_FEATURES_MOBILE }
      : { ...DEFAULT_FEATURES_DESKTOP };

  Object.entries(FEATURE_VARIATION).forEach(([key, variation]) => {
    if (base[key] === undefined) return;
    if (randomBool(variation, rand)) {
      base[key] = !base[key];
    }
  });

  if (!base.webgl && base.webgl2) base.webgl2 = false;
  if (base.webgl && base.webgl2 === undefined) {
    base.webgl2 = randomBool(MOBILE_OS.has(osCategory) ? 0.2 : 0.5, rand);
  }
  return base;
}

function buildPlugins(aggregates, browserKey, osCategory, rand) {
  if (MOBILE_OS.has(osCategory) || browserKey === 'mobile safari') {
    return [];
  }
  const candidates = aggregates.pluginsByBrowser.get(browserKey);
  if (candidates && candidates.length && rand() < 0.6) {
    return clone(pickRandom(candidates, rand));
  }
  const library = [
    ...PLUGIN_LIBRARY.default,
    ...(osCategory === 'mac os' ? PLUGIN_LIBRARY.mac : []),
    ...(osCategory === 'windows' ? PLUGIN_LIBRARY.windows : []),
  ];
  return randomSubset(library, rand, { min: 1, max: Math.min(4, library.length) });
}

function buildMimeTypes(aggregates, browserKey, osCategory, rand) {
  if (MOBILE_OS.has(osCategory) || browserKey === 'mobile safari') {
    return [];
  }
  const candidates = aggregates.mimeTypesByBrowser.get(browserKey);
  if (candidates && candidates.length && rand() < 0.6) {
    return clone(pickRandom(candidates, rand));
  }
  const library = [
    ...MIMETYPE_LIBRARY.default,
    ...(MIMETYPE_LIBRARY.media),
  ];
  return randomSubset(library, rand, { min: 1, max: Math.min(5, library.length) });
}

function buildScreen(aggregates, osCategory, rand) {
  const candidates = aggregates.screensByOsCategory.get(osCategory);
  if (candidates && candidates.length && rand() < 0.6) {
    const sampled = { ...pickRandom(candidates, rand) };
    sampled.availWidth = sampled.availWidth ?? sampled.width;
    sampled.availHeight = sampled.availHeight ?? Math.max(0, sampled.height - (MOBILE_OS.has(osCategory) ? 80 : 40));
    return sampled;
  }
  const preset = sampleFromArray(
    SCREEN_PRESETS[osCategory],
    SCREEN_PRESETS.android,
    rand,
    DEFAULT_SCREENS[osCategory] || DEFAULT_SCREENS.others,
  );
  const screen = { ...(preset || DEFAULT_SCREENS[osCategory] || DEFAULT_SCREENS.others) };
  screen.availWidth = screen.width;
  const reserved = MOBILE_OS.has(osCategory)
    ? randomInt(60, 140, rand)
    : randomInt(0, 120, rand);
  screen.availHeight = Math.max(0, screen.height - reserved);
  return screen;
}

function buildHardwareSamples(aggregates, osCategory, rand) {
  const fallback = HARDWARE_FALLBACKS[osCategory] || HARDWARE_FALLBACKS.others;
  const hardwareConcurrencyValue = sampleFromArray(
    aggregates.hardwareConcurrencyByOsCategory.get(osCategory),
    fallback.hardwareConcurrency,
    rand,
    () => (MOBILE_OS.has(osCategory) ? 8 : 16),
  );
  const deviceMemoryValue = sampleFromArray(
    aggregates.deviceMemoryByOsCategory.get(osCategory),
    fallback.deviceMemory,
    rand,
    () => (MOBILE_OS.has(osCategory) ? 6 : 16),
  );
  const maxTouchPointsValue = sampleFromArray(
    aggregates.maxTouchPointsByOsCategory.get(osCategory),
    fallback.maxTouchPoints,
    rand,
    () => (MOBILE_OS.has(osCategory) ? 5 : 0),
  );
  const doNotTrackValue = sampleFromArray(
    aggregates.doNotTrackGlobal,
    fallback.doNotTrack,
    rand,
    null,
  );

  return {
    hardwareConcurrency: hardwareConcurrencyValue ?? (MOBILE_OS.has(osCategory) ? 8 : 16),
    deviceMemory: deviceMemoryValue ?? null,
    maxTouchPoints: maxTouchPointsValue ?? 0,
    doNotTrack: doNotTrackValue ?? null,
  };
}

function finalizeFingerprint(fingerprint, meta) {
  const hash = computeFingerprintHash(fingerprint);
  const timestamp = (fingerprint.generatedAt || new Date().toISOString())
    .replace(/[:.]/g, '-')
    .split('T')[0];
  const browserSegment = toLowerKey(fingerprint.browserName || 'unknown').replace(/\s+/g, '-');
  const filename = `fingerprint-s-${browserSegment}-${timestamp}-${hash}.json`;
  return { fingerprint, hash, filename, meta };
}

function validateFingerprintConsistency(fingerprint, osCategory, browserKey) {
  const warnings = [];
  const navigatorData = fingerprint.navigator || {};
  const ua = navigatorData.userAgent || '';
  const platform = toLowerKey(navigatorData.platform);

  if (osCategory === 'ios') {
    if (!ua.includes('iPhone') && !ua.includes('iPad')) {
      warnings.push('iOS fingerprint without iPhone/iPad in userAgent.');
    }
    if (!platform.includes('iphone') && !platform.includes('ipad')) {
      warnings.push('iOS fingerprint with non-iOS navigator.platform.');
    }
    if ((navigatorData.maxTouchPoints || 0) < 1) {
      warnings.push('iOS fingerprint missing touch support.');
    }
  }

  if (osCategory === 'android') {
    if (!ua.includes('Android')) {
      warnings.push('Android fingerprint missing Android in userAgent.');
    }
    if ((navigatorData.maxTouchPoints || 0) < 1) {
      warnings.push('Android fingerprint missing touch support.');
    }
  }

  if (osCategory === 'windows' && !ua.includes('Windows')) {
    warnings.push('Windows fingerprint missing Windows in userAgent.');
  }

  if (browserKey === 'mobile safari' && !ua.includes('Mobile')) {
    warnings.push('Mobile Safari fingerprint missing Mobile in userAgent.');
  }

  return warnings;
}

function ensureNavigatorFields(navigatorData, languageSet, osCategory, browserKey) {
  navigatorData.languages = [...languageSet];
  navigatorData.language = languageSet[0] || navigatorData.language || 'en-US';
  navigatorData.platform =
    navigatorData.platform ||
    DEFAULT_PLATFORMS[osCategory] ||
    DEFAULT_PLATFORMS.others;
  navigatorData.vendor =
    navigatorData.vendor ||
    BROWSER_VENDOR[browserKey] ||
    'Google Inc.';
  navigatorData.cookieEnabled =
    navigatorData.cookieEnabled !== undefined ? navigatorData.cookieEnabled : true;
  navigatorData.product = navigatorData.product || 'Gecko';
  navigatorData.productSub = navigatorData.productSub || '20030107';
  navigatorData.webdriver = false;
}

function ensureFeatureFlags(fingerprint, osCategory) {
  if (!fingerprint.features) {
    fingerprint.features = MOBILE_OS.has(osCategory)
      ? { ...DEFAULT_FEATURES_MOBILE }
      : { ...DEFAULT_FEATURES_DESKTOP };
  }
  fingerprint.features.webgl = fingerprint.webgl?.supported ?? fingerprint.features.webgl ?? true;
  fingerprint.features.webgl2 = fingerprint.features.webgl2 ?? fingerprint.features.webgl;
}

function buildBaseContext(options) {
  return Promise.all([
    loadSourceFingerprints({ includeSynthetic: options.includeSynthetic }),
    ensureDistributions(),
  ]).then(([aggregates, distributions]) => ({ aggregates, distributions }));
}

function sampleOsCategory(distributions, rand, mode, aggregates) {
  if (mode === 'seeded') {
    const entry = sampleWeightedCategory(distributions.os, aggregates.supportedOsCategories, rand);
    return entry ? entry.key : pickRandom([...aggregates.supportedOsCategories], rand) || 'unknown';
  }

  const entry = sampleWeightedCategory(distributions.os, null, rand);
  return entry ? entry.key : pickRandom(distributions.os, rand)?.key || 'unknown';
}

function sampleBrowser(distributions, rand, osCategory, aggregates, mode) {
  const compatibilitySet = new Set(
    [...(Object.entries(BROWSER_OS_COMPATIBILITY))]
      .filter(([, osSet]) => osSet.has(osCategory))
      .map(([browserKey]) => browserKey),
  );

  let allowedSet;
  if (mode === 'seeded') {
    const byOs = aggregates.browsersByOsCategory.get(osCategory);
    allowedSet = byOs ? new Set([...byOs].filter(browserKey => compatibilitySet.has(browserKey))) : compatibilitySet;
  } else {
    allowedSet = compatibilitySet;
  }

  const entry = sampleWeightedCategory(distributions.browser, allowedSet, rand);
  if (entry) return entry.key;
  const fallback = pickRandom([...allowedSet], rand);
  if (fallback) return fallback;
  return pickRandom(distributions.browser, rand)?.key || 'unknown';
}

function selectSeededPool(aggregates, osCategory, browserKey) {
  const poolKey = `${osCategory}::${browserKey}`;
  let pool = aggregates.byOsBrowser.get(poolKey);
  if (!pool || !pool.length) {
    pool = aggregates.byBrowser.get(browserKey);
  }
  if (!pool || !pool.length) {
    pool = aggregates.records;
  }
  return pool;
}

function createSeededFingerprint(baseRecord, aggregates, distributions, rand, timestamp, osCategory, browserKey) {
  const languageSample = sampleLanguageSet(aggregates, distributions, rand);
  const timezoneSample = sampleTimezoneObject(aggregates, distributions, rand, osCategory);
  const browserVersionSample = sampleBrowserVersion(browserKey, distributions, rand);
  const osDetailSample = sampleOsDetail(osCategory, distributions, rand);

  const synthetic = clone(baseRecord.fingerprint) || {};
  const platformKey = toLowerKey(synthetic.navigator?.platform);

  if (synthetic.navigator) {
    synthetic.navigator.languages = [...languageSample.languages];
    synthetic.navigator.language = synthetic.navigator.languages[0] || synthetic.navigator.language;

    const hwCandidates = aggregates.hardwareConcurrencyByPlatform.get(platformKey) || aggregates.hardwareConcurrencyGlobal;
    synthetic.navigator.hardwareConcurrency = maybeReplace(
      synthetic.navigator.hardwareConcurrency,
      hwCandidates,
      rand,
      0.4,
    );

    const memCandidates = aggregates.deviceMemoryByPlatform.get(platformKey) || aggregates.deviceMemoryGlobal;
    synthetic.navigator.deviceMemory = maybeReplace(
      synthetic.navigator.deviceMemory,
      memCandidates,
      rand,
      0.35,
    );

    const touchCandidates = aggregates.maxTouchPointsByPlatform.get(platformKey) || aggregates.maxTouchPointsGlobal;
    synthetic.navigator.maxTouchPoints = maybeReplace(
      synthetic.navigator.maxTouchPoints,
      touchCandidates,
      rand,
      0.5,
    );

    const dntCandidates = aggregates.doNotTrackByBrowser.get(browserKey) || aggregates.doNotTrackGlobal;
    synthetic.navigator.doNotTrack = maybeReplace(
      synthetic.navigator.doNotTrack,
      dntCandidates,
      rand,
      0.25,
    );
  }

  if (synthetic.timezone) {
    synthetic.timezone = { ...timezoneSample.timezone };
  } else {
    synthetic.timezone = { ...timezoneSample.timezone };
  }

  if (synthetic.screen) {
    const screenCandidates = aggregates.screensByPlatform.get(platformKey) || aggregates.screensGlobal;
    const newScreen = maybeReplace(
      synthetic.screen,
      screenCandidates,
      rand,
      0.5,
      screen => ({ ...screen }),
    );
    synthetic.screen = newScreen || synthetic.screen;
  }

  synthetic.synthetic = true;
  synthetic.source = 'synthetic';
  synthetic.capturedFrom = 'fingerprint-generator';
  synthetic.generatedAt = timestamp;
  synthetic.syntheticId = crypto.randomBytes(8).toString('hex');
  synthetic.browserName = synthetic.browserName || browserKey;

  synthetic.sourceMetadata = {
    ...(synthetic.sourceMetadata || {}),
    generator: 'generate-fingerprint.js',
    baseFilename: baseRecord.filename,
    seed: null,
    sampledBrowser: browserKey,
    sampledOsCategory: osCategory,
    sampledOsDetail: osDetailSample.label || null,
    sampledBrowserVersion: browserVersionSample.label || null,
    sampledLanguageCode: languageSample.code || null,
    sampledTimezoneLabel: timezoneSample.label || null,
    generationMode: 'seeded',
  };

  applyOsDetail(synthetic, osCategory, osDetailSample.label);
  applyBrowserVersion(synthetic, browserKey, browserVersionSample.label);

  ensureNavigatorFields(synthetic.navigator, languageSample.languages, osCategory, browserKey);
  ensureFeatureFlags(synthetic, osCategory);

  const warnings = validateFingerprintConsistency(synthetic, osCategory, browserKey);
  if (warnings.length) {
    console.warn('⚠️  Seeded fingerprint consistency warnings:', warnings.join(' | '));
  }

  synthetic.sourceMetadata.seed = null;

  return {
    fingerprint: synthetic,
    meta: {
      browserKey,
      osCategory,
      languageSample,
      timezoneSample,
      browserVersionSample,
      osDetailSample,
    },
  };
}

function createPureFingerprint(context, options, rand, timestamp) {
  const { aggregates, distributions } = context;

  const osCategory = sampleOsCategory(distributions, rand, 'pure', aggregates);
  const browserKey = sampleBrowser(distributions, rand, osCategory, aggregates, 'pure');

  const languageSample = sampleLanguageSet(aggregates, distributions, rand);
  const timezoneSample = sampleTimezoneObject(aggregates, distributions, rand, osCategory);
  const browserVersionSample = sampleBrowserVersion(browserKey, distributions, rand);
  const osDetailSample = sampleOsDetail(osCategory, distributions, rand);

  const hardware = buildHardwareSamples(aggregates, osCategory, rand);

  const platformCandidates = aggregates.platformsByOsCategory.get(osCategory);
  const platform = sampleFromArray(
    platformCandidates,
    osCategory === 'mac os' ? MAC_PLATFORMS : osCategory === 'windows' ? WINDOWS_PLATFORMS : osCategory === 'gnu/linux based' ? LINUX_PLATFORMS : null,
    rand,
    DEFAULT_PLATFORMS[osCategory] || DEFAULT_PLATFORMS.others,
  );

  const navigatorTemplate =
    pickRandom(aggregates.navigatorsByOsBrowser.get(`${osCategory}::${browserKey}`), rand)
    || pickRandom(aggregates.navigatorsGlobal, rand);

  const defaultNavigator = buildDefaultNavigator(osCategory, browserKey, languageSample.languages, hardware, rand, osDetailSample.label);
  defaultNavigator.platform = platform;

  const navigatorData = buildNavigatorFromTemplate(navigatorTemplate, {
    languageSet: languageSample.languages,
    osCategory,
    browserKey,
    hardwareConcurrency: hardware.hardwareConcurrency,
    deviceMemory: hardware.deviceMemory,
    maxTouchPoints: hardware.maxTouchPoints,
    doNotTrack: hardware.doNotTrack,
    platform,
    defaultNavigator,
  });

  ensureNavigatorFields(navigatorData, languageSample.languages, osCategory, browserKey);

  const fingerprint = {
    navigator: navigatorData,
    screen: buildScreen(aggregates, osCategory, rand),
    timezone: { ...timezoneSample.timezone },
    webgl: buildWebGL(aggregates, osCategory, rand),
    canvas: buildCanvas(aggregates, osCategory, rand),
    audio: buildAudio(aggregates, osCategory, rand),
    plugins: buildPlugins(aggregates, browserKey, osCategory, rand),
    mimeTypes: buildMimeTypes(aggregates, browserKey, osCategory, rand),
    features: buildFeatures(aggregates, browserKey, osCategory, rand),
    browserName: browserKey,
    source: 'synthetic',
    synthetic: true,
    capturedFrom: 'fingerprint-generator',
    generatedAt: timestamp,
    syntheticId: crypto.randomBytes(8).toString('hex'),
    sourceMetadata: {
      generator: 'generate-fingerprint.js',
      baseFilename: null,
      seed: options.seed ?? null,
      sampledBrowser: browserKey,
      sampledOsCategory: osCategory,
      sampledOsDetail: osDetailSample.label || null,
      sampledBrowserVersion: browserVersionSample.label || null,
      sampledLanguageCode: languageSample.code || null,
      sampledTimezoneLabel: timezoneSample.label || null,
      generationMode: 'pure',
    },
  };

  applyOsDetail(fingerprint, osCategory, osDetailSample.label);
  applyBrowserVersion(fingerprint, browserKey, browserVersionSample.label);
  ensureFeatureFlags(fingerprint, osCategory);

  const warnings = validateFingerprintConsistency(fingerprint, osCategory, browserKey);
  if (warnings.length) {
    console.warn('⚠️  Pure fingerprint consistency warnings:', warnings.join(' | '));
  }

  return { fingerprint, meta: { browserKey, osCategory } };
}

async function generateSeededFingerprint(options = {}) {
  const context = await buildBaseContext(options);
  const { aggregates, distributions } = context;
  const rand = createPRNG(options.seed);
  const timestamp = new Date().toISOString();

  const osCategory = sampleOsCategory(distributions, rand, 'seeded', aggregates);
  const browserKey = sampleBrowser(distributions, rand, osCategory, aggregates, 'seeded');
  const pool = selectSeededPool(aggregates, osCategory, browserKey);
  const baseRecord = pickRandom(pool, rand) || aggregates.records[0];

  const { fingerprint } = createSeededFingerprint(
    baseRecord,
    aggregates,
    distributions,
    rand,
    timestamp,
    osCategory,
    browserKey,
  );

  fingerprint.sourceMetadata.seed = options.seed ?? null;

  return finalizeFingerprint(fingerprint, { baseRecord, mode: 'seeded' });
}

async function generatePureFingerprint(options = {}) {
  const context = await buildBaseContext(options);
  const rand = createPRNG(options.seed);
  const timestamp = new Date().toISOString();

  const { fingerprint } = createPureFingerprint(context, options, rand, timestamp);

  return finalizeFingerprint(fingerprint, { baseRecord: null, mode: 'pure' });
}

async function generateFingerprintWithMeta(options = {}) {
  const mode = options.mode || 'pure';
  if (mode === 'pure') {
    return generatePureFingerprint(options);
  }
  return generateSeededFingerprint(options);
}

async function generateFingerprint(options = {}) {
  const { fingerprint } = await generateFingerprintWithMeta(options);
  return fingerprint;
}

function printUsage() {
  console.log(`Usage: node generate-fingerprint.js [options]

Options:
  -m, --mode <mode>     Generation mode: pure | seeded (default: pure)
  -s, --seed <seed>     Provide a deterministic seed (number or string)
      --save            Persist the generated fingerprint into the fingerprints directory
  -o, --output <path>   Write the generated fingerprint to a specific path
  -h, --help            Show this help message
`);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '-m':
      case '--mode':
        options.mode = argv[++i];
        break;
      case '-s':
      case '--seed':
        options.seed = argv[++i];
        break;
      case '--save':
        options.save = true;
        break;
      case '-o':
      case '--output':
        options.output = argv[++i];
        break;
      case '-h':
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }
  return options;
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode || 'pure';
  if (mode !== 'seeded' && mode !== 'pure') {
    console.error('❌ Invalid mode. Expected "seeded" or "pure".');
    process.exit(1);
  }

  try {
    const result = await generateFingerprintWithMeta({ mode, seed: args.seed });
    const { fingerprint, filename } = result;
    const json = JSON.stringify(fingerprint, null, 2);

    if (args.output) {
      const outputPath = path.resolve(process.cwd(), args.output);
      await fs.writeFile(outputPath, json);
      console.log(`✅ Generated fingerprint saved to ${outputPath}`);
      return;
    }

    if (args.save) {
      await fs.mkdir(FINGERPRINTS_DIR, { recursive: true });
      const targetPath = path.join(FINGERPRINTS_DIR, filename);
      await fs.writeFile(targetPath, json);
      console.log(`✅ Generated ${mode} fingerprint`);
      console.log(`   Saved as ${path.relative(process.cwd(), targetPath)}`);
      return;
    }

    console.log(json);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  generateFingerprint,
  generateFingerprintWithMeta,
};
