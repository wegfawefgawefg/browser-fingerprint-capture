// fingerprint-loader.js
// Utility library for loading fingerprints from the fingerprints directory

const fs = require('fs/promises');
const path = require('path');
const { generateFingerprint } = require('./generate-fingerprint');

const FINGERPRINTS_DIR = 'fingerprints';

/**
 * Load a fingerprint from the collection
 * @param {Object} options - Loading options
 * @param {string} options.mode - 'random', 'first', 'specific', or 'generated'
 * @param {string} options.filename - Required if mode is 'specific'
 * @param {string|number} options.seed - Optional seed for deterministic generation
 * @param {string} options.generatedMode - 'seeded' or 'pure' when mode is 'generated'
 * @returns {Promise<Object>} The loaded fingerprint object
 */
async function loadFingerprint(options = {}) {
  const { mode = 'random', filename = null } = options;

  // Get all fingerprint files
  let files;
  try {
    files = await fs.readdir(FINGERPRINTS_DIR);
  } catch (error) {
    throw new Error(`Cannot read fingerprints directory: ${FINGERPRINTS_DIR}. Run capture-real-fingerprint.js first.`);
  }

  const fingerprintFiles = files.filter(f => f.endsWith('.json')).sort();

  if (fingerprintFiles.length === 0) {
    throw new Error('No fingerprints found. Run capture-real-fingerprint.js to collect fingerprints.');
  }

  let selectedFile;

  switch (mode) {
    case 'generated': {
      const synthetic = await generateFingerprint({
        seed: options.seed,
        mode: options.generatedMode || 'pure',
      });
      console.log(`🧪 Generated fingerprint (mode: ${mode}/${options.generatedMode || 'pure'})`);
      console.log(`   Browser: ${synthetic.browserName || 'N/A'}`);
      console.log(`   Platform: ${synthetic.navigator?.platform || 'N/A'}`);
      console.log(`   GPU: ${synthetic.webgl?.renderer || 'N/A'}`);
      return synthetic;
    }

    case 'first':
      selectedFile = fingerprintFiles[0];
      break;

    case 'specific':
      if (!filename) {
        throw new Error('filename is required when mode is "specific"');
      }
      if (!fingerprintFiles.includes(filename)) {
        throw new Error(`Fingerprint "${filename}" not found. Available: ${fingerprintFiles.join(', ')}`);
      }
      selectedFile = filename;
      break;

    case 'random':
    default:
      const randomIndex = Math.floor(Math.random() * fingerprintFiles.length);
      selectedFile = fingerprintFiles[randomIndex];
      break;
  }

  // Load and parse the selected fingerprint
  const filepath = path.join(FINGERPRINTS_DIR, selectedFile);
  const content = await fs.readFile(filepath, 'utf8');
  const fingerprint = JSON.parse(content);

  console.log(`📋 Loaded fingerprint: ${selectedFile} (mode: ${mode})`);
  console.log(`   Platform: ${fingerprint.navigator?.platform || 'N/A'}`);
  console.log(`   GPU: ${fingerprint.webgl?.renderer || 'N/A'}`);

  return fingerprint;
}

/**
 * List all available fingerprints
 * @returns {Promise<Array<string>>} Array of fingerprint filenames
 */
async function listFingerprints() {
  try {
    const files = await fs.readdir(FINGERPRINTS_DIR);
    return files.filter(f => f.endsWith('.json')).sort();
  } catch (error) {
    throw new Error(`Cannot read fingerprints directory: ${FINGERPRINTS_DIR}`);
  }
}

/**
 * Get count of available fingerprints
 * @returns {Promise<number>} Number of fingerprints
 */
async function getFingerprintCount() {
  const files = await listFingerprints();
  return files.length;
}

module.exports = {
  loadFingerprint,
  listFingerprints,
  getFingerprintCount,
  generateFingerprint,
  FINGERPRINTS_DIR,
};
