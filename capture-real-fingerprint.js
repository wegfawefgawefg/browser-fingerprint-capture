// capture-real-fingerprint.js
// Captures YOUR machine's real browser fingerprints to use in automation
const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { discoverBrowsers, getPlaywrightBrowserType } = require('./browser-discovery');

const FINGERPRINTS_DIR = 'fingerprints';

/**
 * Capture fingerprint from a specific browser
 */
async function captureBrowserFingerprint(browserName, browserPath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌐 Capturing fingerprint from: ${browserName}`);
  console.log(`   Path: ${browserPath}`);
  console.log('='.repeat(60));

  const playwrightType = getPlaywrightBrowserType(browserName);
  if (!playwrightType) {
    console.log(`⚠️  Unsupported browser type: ${browserName}`);
    return null;
  }

  // Select the appropriate Playwright browser launcher
  let playwrightBrowser;
  switch (playwrightType) {
    case 'chromium':
      playwrightBrowser = chromium;
      break;
    case 'firefox':
      playwrightBrowser = firefox;
      break;
    case 'webkit':
      playwrightBrowser = webkit;
      break;
  }

  let browser;
  try {
    console.log(`🔧 Attempting to launch with executablePath: ${browserPath}`);

    // Special handling for Firefox - Playwright needs its own patched Firefox
    if (browserName === 'firefox' || browserName === 'safari') {
      console.log(
        `ℹ️  Note: Using Playwright's bundled ${playwrightType} (your system ${browserName} isn't compatible)`
      );
      browser = await playwrightBrowser.launch({
        headless: false,
        timeout: 30000, // 30 second timeout
      });
    } else {
      browser = await playwrightBrowser.launch({
        executablePath: browserPath,
        headless: false,
      });
    }
    console.log(`✅ Successfully launched ${browserName}`);
  } catch (error) {
    console.error(`❌ Failed to launch ${browserName}`);
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split('\n')[0]}`);
    }
    return null;
  }

  const context = await browser.newContext({
    // No overrides - we want the REAL values
  });

  const page = await context.newPage();

  try {
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (error) {
    console.error(`❌ Failed to load page in ${browserName}: ${error.message}`);
    await browser.close();
    return null;
  }

  console.log('📸 Capturing fingerprint from browser context...');

  // Try to override webdriver flag (this may or may not work depending on browser)
  await page.addInitScript(() => {
    // Try to delete and redefine navigator.webdriver
    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    } catch (e) {
      // May fail in some browsers
    }
  });

  // Reload to apply the script
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Capture EVERYTHING from the real browser
  const fingerprint = await page.evaluate(async () => {
    // Helper: Detect GPU info
    function getWebGLInfo() {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return { supported: false };

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          supported: true,
          vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
          renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
          glVendor: gl.getParameter(gl.VENDOR),
          glRenderer: gl.getParameter(gl.RENDERER),
          version: gl.getParameter(gl.VERSION),
          shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        };
      } catch (e) {
        return { supported: false, error: e.message };
      }
    }

    // Helper: Canvas fingerprint
    function getCanvasFingerprint() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Hello, world!', 2, 15);
        return canvas.toDataURL();
      } catch (e) {
        return null;
      }
    }

    // Helper: Audio context fingerprint
    function getAudioFingerprint() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return { supported: false };

        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const analyser = ctx.createAnalyser();
        const gainNode = ctx.createGain();

        oscillator.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(ctx.destination);

        return {
          supported: true,
          sampleRate: ctx.sampleRate,
          state: ctx.state,
          maxChannelCount: ctx.destination.maxChannelCount,
        };
      } catch (e) {
        return { supported: false };
      }
    }

    // Helper: Screen info
    const screenInfo = {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
    };

    // Helper: Plugins
    const plugins = Array.from(navigator.plugins || []).map(p => ({
      name: p.name,
      description: p.description,
      filename: p.filename,
    }));

    // Helper: MimeTypes
    const mimeTypes = Array.from(navigator.mimeTypes || []).map(m => ({
      type: m.type,
      description: m.description,
      suffixes: m.suffixes,
    }));

    // Main fingerprint object
    return {
      // Navigator
      navigator: {
        userAgent: navigator.userAgent,
        appVersion: navigator.appVersion,
        platform: navigator.platform,
        vendor: navigator.vendor,
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints,
        product: navigator.product,
        productSub: navigator.productSub,
        webdriver: navigator.webdriver,
      },

      // Screen
      screen: screenInfo,

      // Timezone
      timezone: {
        offset: new Date().getTimezoneOffset(),
        name: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },

      // Graphics
      webgl: getWebGLInfo(),
      canvas: getCanvasFingerprint(),
      audio: getAudioFingerprint(),

      // Browser features
      plugins: plugins.slice(0, 10), // Limit output
      mimeTypes: mimeTypes.slice(0, 10),

      // Feature detection
      features: {
        indexedDB: !!window.indexedDB,
        localStorage: !!window.localStorage,
        sessionStorage: !!window.sessionStorage,
        webgl: !!document.createElement('canvas').getContext('webgl'),
        webgl2: !!document.createElement('canvas').getContext('webgl2'),
        serviceWorker: 'serviceWorker' in navigator,
        notification: 'Notification' in window,
        geolocation: 'geolocation' in navigator,
      },
    };
  });

  await browser.close();

  // Add browser name to fingerprint metadata
  fingerprint.browserName = browserName;
  fingerprint.capturedFrom = browserPath;

  console.log('✅ Fingerprint captured!');
  console.log(`  Platform: ${fingerprint.navigator.platform}`);
  console.log(`  User Agent: ${fingerprint.navigator.userAgent}`);
  console.log(`  GPU Vendor: ${fingerprint.webgl.vendor || 'N/A'}`);
  console.log(`  GPU Renderer: ${fingerprint.webgl.renderer || 'N/A'}`);
  console.log(`  Screen: ${fingerprint.screen.width}x${fingerprint.screen.height}`);
  console.log(`  WebDriver: ${fingerprint.navigator.webdriver}`);
  console.log(`  Hardware Cores: ${fingerprint.navigator.hardwareConcurrency}`);
  console.log(`  Device Memory: ${fingerprint.navigator.deviceMemory || 'N/A'} GB`);

  return fingerprint;
}

/**
 * Main execution
 */
(async () => {
  console.log('🚀 Real Browser Fingerprint Capture Tool');
  console.log('=========================================\n');

  // Discover all installed browsers
  const browsers = discoverBrowsers();

  if (Object.keys(browsers).length === 0) {
    console.log('\n❌ No browsers found. Please install Chrome, Firefox, or another supported browser.');
    process.exit(1);
  }

  // Create fingerprints directory if it doesn't exist
  try {
    await fs.mkdir(FINGERPRINTS_DIR, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }

  // Load existing fingerprints for duplicate checking
  const existingFiles = await fs.readdir(FINGERPRINTS_DIR);
  const existingFingerprints = [];

  for (const file of existingFiles) {
    if (file.endsWith('.json')) {
      try {
        const content = await fs.readFile(path.join(FINGERPRINTS_DIR, file), 'utf8');
        existingFingerprints.push(JSON.parse(content));
      } catch (e) {
        // Skip invalid files
      }
    }
  }

  let capturedCount = 0;
  let duplicateCount = 0;

  // Capture from each discovered browser
  for (const [browserName, browserPath] of Object.entries(browsers)) {
    const fingerprint = await captureBrowserFingerprint(browserName, browserPath);

    if (!fingerprint) {
      continue; // Browser failed to launch or capture
    }

    // Generate a hash of the fingerprint for uniqueness checking
    const fingerprintHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        userAgent: fingerprint.navigator.userAgent,
        platform: fingerprint.navigator.platform,
        gpuVendor: fingerprint.webgl.vendor,
        gpuRenderer: fingerprint.webgl.renderer,
        hardwareConcurrency: fingerprint.navigator.hardwareConcurrency,
        deviceMemory: fingerprint.navigator.deviceMemory,
        screen: fingerprint.screen,
        browserName: browserName,
      }))
      .digest('hex')
      .substring(0, 12);

    // Check for duplicates by comparing key characteristics
    let isDuplicate = false;
    for (const existing of existingFingerprints) {
      if (
        existing.navigator?.userAgent === fingerprint.navigator.userAgent &&
        existing.navigator?.platform === fingerprint.navigator.platform &&
        existing.webgl?.vendor === fingerprint.webgl.vendor &&
        existing.webgl?.renderer === fingerprint.webgl.renderer &&
        existing.navigator?.hardwareConcurrency === fingerprint.navigator.hardwareConcurrency &&
        existing.screen?.width === fingerprint.screen.width &&
        existing.screen?.height === fingerprint.screen.height &&
        existing.browserName === browserName
      ) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      console.log(`⚠️  Duplicate fingerprint - skipping`);
      duplicateCount++;
    } else {
      // Generate filename with browser name, timestamp and hash
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `fingerprint-${browserName}-${timestamp}-${fingerprintHash}.json`;
      const filepath = path.join(FINGERPRINTS_DIR, filename);

      // Save to fingerprints directory
      await fs.writeFile(filepath, JSON.stringify(fingerprint, null, 2));

      console.log(`💾 Saved: ${filename}`);
      capturedCount++;
      existingFingerprints.push(fingerprint);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Capture Summary');
  console.log('='.repeat(60));
  console.log(`Browsers discovered: ${Object.keys(browsers).length}`);
  console.log(`New fingerprints captured: ${capturedCount}`);
  console.log(`Duplicates skipped: ${duplicateCount}`);
  console.log(`Total fingerprints in collection: ${existingFingerprints.length}`);
  console.log('\n✅ Done! Use fingerprint-loader.js to load these fingerprints in your automation.');
})();
