/**
 * Recipe Sharing & Serverless Sync Module.
 * Compresses recipes into URL-hashes and generates crisp offline QR-codes
 * for instant desktop-to-mobile recipe transfer without accounts or backends.
 */

import LZString from 'lz-string';
import QRCode from 'qrcode';
import { normalizeState } from '../state.js';

/**
 * Strips superfluous internal UI state and packages only recipe essentials.
 * Minimizes compressed payload size for maximum QR code scannability.
 * @param {Object} state
 * @returns {Object} Compact recipe payload
 */
export function serializeRecipePayload(state) {
  const r = state.recipe || {};
  const e = state.equipment || {};
  const y = state.yeast || {};
  const w = state.water || {};

  return {
    r: {
      name: r.name || 'Nytt öl',
      batchVolume: Number(r.batchVolume) || 20,
      boilVolume: Number(r.boilVolume) || 25,
      boilTime: Number(r.boilTime) || 60,
      efficiency: Number(r.efficiency) || 75,
      styleId: r.styleId || '',
      notes: r.notes || '',
      carbonationVols: r.carbonationVols,
      fermentation: r.fermentation,
    },
    f: (state.fermentables || []).map((item) => ({
      name: item.name,
      amount: Number(item.amount) || 0,
      ebc: Number(item.ebc) || 0,
      type: item.type || 'base',
      potential: item.potential,
    })),
    h: (state.hops || []).map((item) => ({
      name: item.name,
      amount: Number(item.amount) || 0,
      alpha: Number(item.alpha) || 0,
      time: Number(item.time) || 0,
      use: item.use || 'kok',
      whirlpoolTemp: item.whirlpoolTemp,
      dryHopDay: item.dryHopDay,
      dryHopDays: item.dryHopDays,
    })),
    y: {
      name: y.name || '',
      lab: y.lab || '',
      type: y.type || 'ale',
      attMin: Number(y.attMin) || 72,
      attMax: Number(y.attMax) || 78,
    },
    m: (state.mash || []).map((step) => ({
      name: step.name,
      temp: Number(step.temp) || 65,
      time: Number(step.time) || 60,
      type: step.type || 'Infusion',
    })),
    w: {
      base: w.base,
      salts: w.salts,
      volume: Number(w.volume) || 25,
      acid: w.acid,
    },
    e: {
      id: e.id || 'standard',
      name: e.name || 'Standard 30L',
      batchVolume: Number(e.batchVolume) || 20,
      efficiency: Number(e.efficiency) || 75,
      boilOffRate: Number(e.boilOffRate) || 3.0,
      kettleLoss: Number(e.kettleLoss) || 2.0,
      grainAbsorption: Number(e.grainAbsorption) || 0.96,
      mashRatio: Number(e.mashRatio) || 3.0,
    },
  };
}

/**
 * Unpacks a compact payload back into standard Brygglabbet state shape.
 * @param {Object} payload
 * @returns {Object} Normalized application state
 */
export function deserializeRecipePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ogiltigt receptformat i delad länk');
  }

  const rawState = {
    recipe: payload.r || {},
    fermentables: payload.f || [],
    hops: payload.h || [],
    yeast: payload.y || {},
    mash: payload.m || [],
    water: payload.w || {},
    equipment: payload.e || {},
  };

  return normalizeState(rawState);
}

/**
 * Encodes state into a compressed URL hash fragment.
 * @param {Object} state
 * @param {'brew'|'recipe'} [mode='brew']
 * @returns {string} e.g. '#brew=N4Ig...'
 */
export function encodeRecipeToHash(state, mode = 'brew') {
  const payload = serializeRecipePayload(state);
  const json = JSON.stringify(payload);
  const compressed = LZString.compressToEncodedURIComponent(json);
  return `#${mode}=${compressed}`;
}

/**
 * Generates a full shareable URL containing the compressed recipe hash.
 * @param {Object} state
 * @param {'brew'|'recipe'} [mode='brew']
 * @param {string} [baseUrl]
 * @returns {string}
 */
export function generateRecipeShareUrl(state, mode = 'brew', baseUrl) {
  const base = baseUrl || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
  const hash = encodeRecipeToHash(state, mode);
  return `${base}${hash}`;
}

/**
 * Decodes state and mode from a URL hash string.
 * @param {string} hash - e.g. '#brew=N4Ig...' or '#recipe=N4Ig...'
 * @returns {{ state: Object, mode: 'brew'|'recipe' }|null}
 */
export function decodeRecipeFromHash(hash) {
  if (!hash || typeof hash !== 'string') return null;

  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const match = cleanHash.match(/^(brew|recipe)=(.+)$/);
  if (!match) return null;

  const mode = match[1];
  const compressed = match[2];

  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;

    const payload = JSON.parse(json);
    const state = deserializeRecipePayload(payload);
    return { state, mode };
  } catch (err) {
    console.error('[recipeSharing] Dekomprimeringsfel:', err);
    return null;
  }
}

/**
 * Generates an SVG QR-code string for the given share URL.
 * Renders entirely in-memory without external requests or canvas dependencies.
 * @param {string} url
 * @returns {Promise<string>} SVG markup
 */
export async function generateQrCodeSvg(url) {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 2,
    width: 260,
    color: {
      dark: '#1a130e', // Primary deep brown/black from app theme
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}
