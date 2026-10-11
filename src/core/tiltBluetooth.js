/**
 * Tilt Digital Hydrometer Web Bluetooth & IoT Integration Module.
 * Parses BLE iBeacon advertisements from Tilt Hydrometers directly in browser.
 * Zero-backend, 100% client-side IoT gravity and temperature logging.
 */

export const APPLE_COMPANY_ID = 0x004c;

export const TILT_COLORS = {
  a495bb10c5b14b44b5121370f02d74de: { name: 'Röd', colorHex: '#ef4444' },
  a495bb20c5b14b44b5121370f02d74de: { name: 'Grön', colorHex: '#10b981' },
  a495bb30c5b14b44b5121370f02d74de: { name: 'Svart', colorHex: '#1f2937' },
  a495bb40c5b14b44b5121370f02d74de: { name: 'Lila', colorHex: '#8b5cf6' },
  a495bb50c5b14b44b5121370f02d74de: { name: 'Orange', colorHex: '#f97316' },
  a495bb60c5b14b44b5121370f02d74de: { name: 'Blå', colorHex: '#3b82f6' },
  a495bb70c5b14b44b5121370f02d74de: { name: 'Gul', colorHex: '#eab308' },
  a495bb80c5b14b44b5121370f02d74de: { name: 'Rosa', colorHex: '#ec4899' },
};

/**
 * Converts Fahrenheit to Celsius rounded to 1 decimal.
 * @param {number} tempF
 * @returns {number} tempC
 */
export function fahrenheitToCelsius(tempF) {
  if (typeof tempF !== 'number' || isNaN(tempF)) return 20.0;
  return Math.round(((tempF - 32) * (5 / 9)) * 10) / 10;
}

/**
 * Converts Celsius to Fahrenheit rounded to 1 decimal.
 * @param {number} tempC
 * @returns {number} tempF
 */
export function celsiusToFahrenheit(tempC) {
  if (typeof tempC !== 'number' || isNaN(tempC)) return 68.0;
  return Math.round((tempC * (9 / 5) + 32) * 10) / 10;
}

/**
 * Categorizes RSSI dBm into a human-readable quality level.
 * @param {number} [rssi]
 * @returns {{ label: string, bars: number, color: string }}
 */
export function estimateSignalQuality(rssi) {
  if (typeof rssi !== 'number') return { label: 'Okänd', bars: 1, color: '#9ca3af' };
  if (rssi >= -60) return { label: 'Utmärkt', bars: 4, color: '#10b981' };
  if (rssi >= -75) return { label: 'Bra', bars: 3, color: '#3b82f6' };
  if (rssi >= -85) return { label: 'Godkänd', bars: 2, color: '#f59e0b' };
  return { label: 'Svag', bars: 1, color: '#ef4444' };
}

/**
 * Checks whether Web Bluetooth API is supported in the current environment.
 * @returns {boolean}
 */
export function isWebBluetoothSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
}

/**
 * Checks whether Web Bluetooth LE passive scanning is supported.
 * @returns {boolean}
 */
export function isLeScanSupported() {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.bluetooth && typeof navigator.bluetooth.requestLEScan === 'function')
  );
}

/**
 * Parses raw iBeacon manufacturerData from a Bluetooth advertisement event.
 * @param {DataView|Uint8Array|ArrayBuffer|Map} manufacturerData
 * @param {number} [rssi]
 * @returns {object|null} Parsed reading or null if not a valid Tilt
 */
export function parseTiltAdvertisement(manufacturerData, rssi = null) {
  if (!manufacturerData) return null;

  let view = null;

  if (typeof Map !== 'undefined' && manufacturerData instanceof Map) {
    const raw = manufacturerData.get(APPLE_COMPANY_ID);
    if (!raw) return null;
    view = raw instanceof DataView ? raw : new DataView(raw.buffer || raw);
  } else if (manufacturerData instanceof DataView) {
    view = manufacturerData;
  } else if (manufacturerData.buffer instanceof ArrayBuffer) {
    view = new DataView(manufacturerData.buffer);
  } else if (Array.isArray(manufacturerData)) {
    view = new DataView(new Uint8Array(manufacturerData).buffer);
  }

  if (!view || view.byteLength < 22) return null;

  // iBeacon Header: Byte 0 = 0x02, Byte 1 = 0x15 (21 bytes following)
  const subType = view.getUint8(0);
  const subLength = view.getUint8(1);
  if (subType !== 0x02 || subLength !== 0x15) {
    return null;
  }

  // Extract 16 bytes UUID (Bytes 2-17)
  let uuidHex = '';
  for (let i = 2; i < 18; i++) {
    uuidHex += view.getUint8(i).toString(16).padStart(2, '0');
  }

  const tiltInfo = TILT_COLORS[uuidHex.toLowerCase()];
  if (!tiltInfo) {
    // Not a known Tilt color UUID
    return null;
  }

  // Bytes 18-19: Temp in Fahrenheit (Big Endian)
  const tempF = view.getUint16(18, false);
  const tempC = fahrenheitToCelsius(tempF);

  // Bytes 20-21: Specific Gravity x 1000 (Big Endian)
  const sgRaw = view.getUint16(20, false);
  const sg = Math.round((sgRaw / 1000) * 1000) / 1000;

  // Sanity check: Realistic brewing range (SG 0.980 - 1.180, Temp -10 - 70°C)
  if (sg < 0.95 || sg > 1.25 || tempC < -10 || tempC > 80) {
    return null;
  }

  // Byte 22: TX Power (calibrated RSSI at 1 meter)
  const txPower = view.byteLength > 22 ? view.getInt8(22) : -59;

  return {
    color: tiltInfo.name,
    colorHex: tiltInfo.colorHex,
    uuid: uuidHex,
    sg,
    tempC,
    tempF,
    rssi: typeof rssi === 'number' ? rssi : null,
    txPower,
    signal: estimateSignalQuality(rssi),
    timestamp: Date.now(),
  };
}

/**
 * Starts a live Web Bluetooth LE scan for Tilt Hydrometers.
 * @param {object} options
 * @param {Function} options.onReading - (reading: object) => void
 * @param {Function} [options.onError] - (error: Error) => void
 * @param {Function} [options.onStatus] - (status: string) => void
 * @returns {Promise<Function>} stopScan function
 */
export async function startTiltScan({ onReading, onError, onStatus }) {
  if (!isWebBluetoothSupported()) {
    const err = new Error('Web Bluetooth stöds inte i denna webbläsare. Använd Chrome, Edge eller Bluefy (iOS).');
    if (onError) onError(err);
    throw err;
  }

  if (!isLeScanSupported()) {
    const err = new Error(
      'Web Bluetooth scanning (requestLEScan) kräver att flaggan "Experimental Web Platform features" är aktiverad i chrome://flags.'
    );
    if (onError) onError(err);
    throw err;
  }

  if (onStatus) onStatus('Söker efter Tilt iBeacon-signaler...');

  let scan = null;
  try {
    scan = await navigator.bluetooth.requestLEScan({
      acceptAllAdvertisements: true,
      keepRepeatedDevices: true,
    });
  } catch (err) {
    if (onError) onError(err);
    throw err;
  }

  const handleAdvertisement = (event) => {
    try {
      const reading = parseTiltAdvertisement(event.manufacturerData, event.rssi);
      if (reading) {
        if (onReading) onReading(reading);
      }
    } catch (e) {
      console.warn('[TiltBluetooth] Kunde inte tolka annonsering:', e);
    }
  };

  navigator.bluetooth.addEventListener('advertisementreceived', handleAdvertisement);

  if (onStatus) onStatus('Lyssnar på Tilt-signaler...');

  return function stopScan() {
    try {
      if (scan && scan.active && typeof scan.stop === 'function') {
        scan.stop();
      }
      navigator.bluetooth.removeEventListener('advertisementreceived', handleAdvertisement);
      if (onStatus) onStatus('Skanning stoppad.');
    } catch (e) {
      console.warn('[TiltBluetooth] Fel vid avstängning av skanning:', e);
    }
  };
}

/**
 * Simulates real-time Tilt Hydrometer broadcasts for testing, demo and environments
 * without Bluetooth hardware or experimental flags.
 * @param {object} options
 * @param {Function} options.onReading - (reading: object) => void
 * @param {number} [options.initialSG=1.050]
 * @param {number} [options.initialTempC=19.8]
 * @param {string} [options.color='Röd']
 * @param {number} [options.intervalMs=2500]
 * @returns {Function} stopSimulation function
 */
export function startTiltSimulation({
  onReading,
  initialSG = 1.050,
  initialTempC = 19.8,
  color = 'Röd',
  intervalMs = 2500,
}) {
  const tiltColorEntry = Object.values(TILT_COLORS).find((c) => c.name.toLowerCase() === color.toLowerCase()) || TILT_COLORS.a495bb10c5b14b44b5121370f02d74de;

  let currentSG = Number(initialSG) || 1.050;
  let currentTempC = Number(initialTempC) || 19.8;
  let currentRssi = -68;

  const emit = () => {
    // Subtle realistic fluctuations
    const sgJitter = (Math.random() - 0.5) * 0.0004;
    const tempJitter = (Math.random() - 0.5) * 0.15;
    const rssiJitter = Math.round((Math.random() - 0.5) * 4);

    currentSG = Math.round(Math.max(0.995, currentSG + sgJitter) * 1000) / 1000;
    currentTempC = Math.round((currentTempC + tempJitter) * 10) / 10;
    currentRssi = Math.min(-45, Math.max(-95, currentRssi + rssiJitter));

    const reading = {
      color: tiltColorEntry.name,
      colorHex: tiltColorEntry.colorHex,
      uuid: 'a495bb10c5b14b44b5121370f02d74de',
      sg: currentSG,
      tempC: currentTempC,
      tempF: celsiusToFahrenheit(currentTempC),
      rssi: currentRssi,
      txPower: -59,
      signal: estimateSignalQuality(currentRssi),
      timestamp: Date.now(),
      isSimulated: true,
    };

    if (onReading) onReading(reading);
  };

  emit();
  const timer = setInterval(emit, intervalMs);

  return function stopSimulation() {
    clearInterval(timer);
  };
}
