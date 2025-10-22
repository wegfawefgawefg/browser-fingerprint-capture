#!/usr/bin/env node
/* eslint-disable no-console */

// normalize-amiunique.js
// Convert AmiUnique JSON exports into the local fingerprint schema used by
// capture-real-fingerprint.js

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const AMIUNIQUE_DIR = path.resolve(__dirname, 'amiunique');
const FINGERPRINTS_DIR = path.resolve(__dirname, 'fingerprints');

function cleanString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (
    lowered === 'none' ||
    lowered === 'null' ||
    lowered === 'not available' ||
    lowered === 'no value' ||
    lowered === 'not supported' ||
    lowered === 'undefined'
  ) {
    return null;
  }
  return trimmed;
}

function yesNoToBoolean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const lowered = String(value).trim().toLowerCase();
  if (!lowered) return null;
  if (['yes', 'true', '1', 'available', 'supported'].includes(lowered)) return true;
  if (['no', 'false', '0', 'not available', 'not supported', 'unsupported'].includes(lowered)) return false;
  return null;
}

function permissionToBoolean(value) {
  if (value === null || value === undefined) return null;
  const lowered = String(value).trim().toLowerCase();
  if (!lowered) return null;
  if (['granted', 'prompt', 'allow', 'allowed', 'yes'].includes(lowered)) return true;
  if (['denied', 'blocked', 'refused', 'no'].includes(lowered)) return false;
  return null;
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = cleanString(value);
  if (cleaned === null) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLanguages(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return [];
  return cleaned
    .split(',')
    .map(lang => lang.trim())
    .filter(Boolean);
}

function parsePlugins(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map(item => ({
        name: cleanString(item?.name) || null,
        description: cleanString(item?.description) || null,
        filename: cleanString(item?.filename) || null,
      }))
      .filter(p => p.name || p.description || p.filename);
  }
  if (typeof raw !== 'string') return [];
  const segments = raw.match(/Plugin \\d+:.*?(?=Plugin \\d+:|$)/gs);
  if (!segments) return [];
  return segments
    .map(segment => segment.replace(/Plugin \\d+:/, '').trim())
    .map(segment => {
      const parts = segment
        .split(';')
        .map(part => cleanString(part))
        .filter(Boolean);
      if (parts.length === 0) return null;
      const [name, description, filename] = parts;
      const sanitizedFilename = typeof filename === 'string' ? filename.replace(/\\.*$/, '') : filename;
      return {
        name: name || null,
        description: description || null,
        filename: cleanString(sanitizedFilename) || null,
      };
    })
    .filter(Boolean);
}

function parseMimeTypes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map(item => ({
        type: cleanString(item?.type) || null,
        description: cleanString(item?.description) || null,
        suffixes: cleanString(item?.suffixes) || null,
      }))
      .filter(m => m.type || m.description || m.suffixes);
  }
  if (typeof raw === 'string') {
    const cleaned = raw.trim();
    if (!cleaned) return [];
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parseMimeTypes(parsed);
      }
    } catch (error) {
      // Fall through to best-effort parsing below.
    }
    const segments = cleaned.match(/MimeType \\d+:.*?(?=MimeType \\d+:|$)/gs);
    if (!segments) return [];
    return segments
      .map(segment => segment.replace(/MimeType \\d+:/, '').trim())
      .map(segment => {
        const parts = segment
          .split(';')
          .map(part => cleanString(part))
          .filter(Boolean);
        if (parts.length === 0) return null;
        const [type, description, suffixes] = parts;
        return {
          type: type || null,
          description: description || null,
          suffixes: suffixes || null,
        };
      })
      .filter(Boolean);
  }
  return [];
}

function navigatorHasFeature(navigatorProps, name) {
  if (!Array.isArray(navigatorProps)) return null;
  return navigatorProps.includes(name);
}

function detectBrowserName(userAgent, summary) {
  if (summary) {
    const groups = summary['0'] || summary[0];
    if (Array.isArray(groups)) {
      const browserEntry = groups.find(item => item?.attribute === 'browser');
      if (browserEntry?.value) return String(browserEntry.value).toLowerCase();
    }
  }
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (ua.includes('brave/')) return 'brave';
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('firefox/')) return 'firefox';
  if (ua.includes('chrome/')) return ua.includes('android') ? 'chrome-android' : 'chrome';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'safari';
  if (ua.includes('opr/') || ua.includes('opera')) return 'opera';
  if (ua.includes('msie') || ua.includes('trident/')) return 'ie';
  return 'unknown';
}

function buildAttributesMap(document) {
  const groups = document?.attributes || {};
  const groupKeys = Object.keys(groups);
  if (groupKeys.length === 0) return {};
  const preferredKey = groupKeys
    .map(key => Number(key))
    .sort((a, b) => a - b)[0]
    .toString();
  const entries = groups[preferredKey] || [];
  return entries.reduce((acc, entry) => {
    if (!entry?.attribute) return acc;
    acc[entry.attribute] = entry.value;
    return acc;
  }, {});
}

function buildFingerprint(document) {
  const attrs = buildAttributesMap(document);
  const navigatorProps = Array.isArray(attrs.navigator_properties) ? attrs.navigator_properties : [];
  const languages = parseLanguages(attrs['languages-js']);

  const navigator = {
    userAgent: cleanString(attrs['userAgent-js']) || cleanString(attrs.userAgent) || null,
    appVersion: cleanString(attrs.appVersion),
    platform: cleanString(attrs.platform),
    vendor: cleanString(attrs.vendor),
    language: languages[0] || null,
    languages,
    cookieEnabled: yesNoToBoolean(attrs.cookieEnabled) ?? yesNoToBoolean(attrs.cookies),
    doNotTrack: cleanString(attrs.doNotTrack),
    hardwareConcurrency: parseNumber(attrs.hardwareConcurrency),
    deviceMemory: parseNumber(attrs.deviceMemory),
    maxTouchPoints: parseNumber(attrs.maxTouchPoints),
    product: cleanString(attrs.product),
    productSub: cleanString(attrs.productSub),
    webdriver: yesNoToBoolean(attrs.webdriver),
  };

  const screen = {
    width: parseNumber(attrs.screen_width),
    height: parseNumber(attrs.screen_height),
    availWidth: parseNumber(attrs.screen_availWidth),
    availHeight: parseNumber(attrs.screen_availHeight),
    colorDepth: parseNumber(attrs.screen_depth),
    pixelDepth: parseNumber(attrs.screen_pixel_depth),
  };

  const timezone = {
    offset: parseNumber(attrs.timezone),
    name: cleanString(attrs.timezoneName) || null,
  };

  const webglParams = attrs.webGLParameters || {};
  const webglGeneral = webglParams.general || {};
  const webgl = {
    supported: Boolean(cleanString(attrs.webGLVendor) || cleanString(attrs.webGLRenderer) || attrs.webGLData),
    vendor: cleanString(attrs.webGLVendor),
    renderer: cleanString(attrs.webGLRenderer),
    glVendor: cleanString(webglGeneral.VENDOR),
    glRenderer: cleanString(webglGeneral.RENDERER),
    version: cleanString(webglGeneral.VERSION),
    shadingLanguageVersion: cleanString(webglGeneral.SHADING_LANGUAGE_VERSION),
  };

  const audioContext = attrs.audioContext || {};
  const analyserNode = attrs.analyserNode || {};
  const audio = {
    supported: Boolean(audioContext && Object.keys(audioContext).length),
    sampleRate: parseNumber(audioContext.sampleRate),
    state: cleanString(audioContext.state),
    maxChannelCount: parseNumber(analyserNode.channelCount),
  };

  const permissions = attrs.permissions || {};
  const features = {
    indexedDB: yesNoToBoolean(attrs.storage_indexedDB),
    localStorage: yesNoToBoolean(attrs.storage_local),
    sessionStorage: yesNoToBoolean(attrs.storage_session),
    webgl: webgl.supported,
    webgl2: yesNoToBoolean(attrs.webGL2) ?? navigatorHasFeature(navigatorProps, 'webGL2'),
    serviceWorker:
      permissionToBoolean(permissions['service-worker']) ??
      navigatorHasFeature(navigatorProps, 'serviceWorker'),
    notification:
      permissionToBoolean(permissions.notifications) ??
      permissionToBoolean(attrs.notificationPermission?.permission),
    geolocation:
      permissionToBoolean(permissions.geolocation) ??
      navigatorHasFeature(navigatorProps, 'geolocation'),
  };

  const userAgent = navigator.userAgent;
  const browserName = detectBrowserName(userAgent, document.summary);

  return {
    navigator,
    screen,
    timezone,
    webgl,
    canvas: cleanString(attrs.canvas),
    audio,
    plugins: parsePlugins(attrs.plugins),
    mimeTypes: parseMimeTypes(attrs.mimeTypes),
    features,
    browserName,
    capturedFrom: 'amiunique.org',
    source: 'amiunique',
    sourceMetadata: {
      fpHashed: cleanString(document.fpHashed),
      cookieId: cleanString(document.cookieId),
    },
  };
}

async function normalizeFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const document = JSON.parse(content);
  const fingerprint = buildFingerprint(document);

  const hashBasis = JSON.stringify({
    userAgent: fingerprint.navigator.userAgent,
    platform: fingerprint.navigator.platform,
    gpuVendor: fingerprint.webgl.vendor,
    gpuRenderer: fingerprint.webgl.renderer,
    hardwareConcurrency: fingerprint.navigator.hardwareConcurrency,
    deviceMemory: fingerprint.navigator.deviceMemory,
    screen: fingerprint.screen,
    browserName: fingerprint.browserName,
  });
  const fingerprintHash = crypto.createHash('sha256').update(hashBasis).digest('hex').slice(0, 12);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const browserSegment = fingerprint.browserName || 'unknown';
  const filename = `fingerprint-c-${browserSegment}-amiunique-${timestamp}-${fingerprintHash}.json`;
  const outputPath = path.join(FINGERPRINTS_DIR, filename);

  await fs.mkdir(FINGERPRINTS_DIR, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(fingerprint, null, 2));

  console.log(`✅ Normalized ${path.basename(filePath)} -> ${path.relative(process.cwd(), outputPath)}`);
  return outputPath;
}

async function main() {
  const args = process.argv.slice(2);
  let targets = [];

  if (args.length > 0) {
    targets = args.map(input => path.resolve(process.cwd(), input));
  } else {
    let entries = [];
    try {
      entries = await fs.readdir(AMIUNIQUE_DIR);
    } catch (error) {
      console.error(`❌ Unable to read AmiUnique directory: ${AMIUNIQUE_DIR}`);
      console.error('   Pass explicit file paths to normalize or create the directory.');
      process.exit(1);
    }
    targets = entries
      .filter(name => name.toLowerCase().endsWith('.json'))
      .map(name => path.join(AMIUNIQUE_DIR, name));
  }

  if (targets.length === 0) {
    console.log('ℹ️  No AmiUnique JSON files found to normalize.');
    return;
  }

  for (const filePath of targets) {
    try {
      await normalizeFile(filePath);
    } catch (error) {
      console.error(`❌ Failed to normalize ${filePath}: ${error.message}`);
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildFingerprint,
  normalizeFile,
};
