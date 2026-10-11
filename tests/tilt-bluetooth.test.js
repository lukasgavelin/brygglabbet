import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  APPLE_COMPANY_ID,
  TILT_COLORS,
  fahrenheitToCelsius,
  celsiusToFahrenheit,
  estimateSignalQuality,
  isWebBluetoothSupported,
  isLeScanSupported,
  parseTiltAdvertisement,
  startTiltScan,
  startTiltSimulation,
} from '../src/core/tiltBluetooth.js';
import { getTiltPanelHtml, setupTiltPanel } from '../src/ui/tiltController.js';

describe('Tilt Bluetooth & IoT Core (tiltBluetooth.js)', () => {
  describe('Constants & Colors', () => {
    it('defines Apple Company ID as 0x004c', () => {
      expect(APPLE_COMPANY_ID).toBe(0x004c);
    });

    it('contains all 8 official Tilt colors with Swedish labels and hex codes', () => {
      const colors = Object.values(TILT_COLORS).map((c) => c.name);
      expect(colors).toContain('Röd');
      expect(colors).toContain('Grön');
      expect(colors).toContain('Svart');
      expect(colors).toContain('Lila');
      expect(colors).toContain('Orange');
      expect(colors).toContain('Blå');
      expect(colors).toContain('Gul');
      expect(colors).toContain('Rosa');
      expect(Object.keys(TILT_COLORS).length).toBe(8);
    });
  });

  describe('Temperature & Signal Conversions', () => {
    it('converts Fahrenheit to Celsius correctly', () => {
      expect(fahrenheitToCelsius(32)).toBe(0.0);
      expect(fahrenheitToCelsius(68)).toBe(20.0);
      expect(fahrenheitToCelsius(212)).toBe(100.0);
      expect(fahrenheitToCelsius(NaN)).toBe(20.0);
    });

    it('converts Celsius to Fahrenheit correctly', () => {
      expect(celsiusToFahrenheit(0)).toBe(32.0);
      expect(celsiusToFahrenheit(20)).toBe(68.0);
      expect(celsiusToFahrenheit(100)).toBe(212.0);
      expect(celsiusToFahrenheit(NaN)).toBe(68.0);
    });

    it('estimates signal quality based on RSSI dBm', () => {
      expect(estimateSignalQuality(-55).label).toBe('Utmärkt');
      expect(estimateSignalQuality(-70).label).toBe('Bra');
      expect(estimateSignalQuality(-80).label).toBe('Godkänd');
      expect(estimateSignalQuality(-92).label).toBe('Svag');
      expect(estimateSignalQuality(null).label).toBe('Okänd');
    });
  });

  describe('parseTiltAdvertisement', () => {
    function createTiltBuffer({
      uuidHex = 'a495bb10c5b14b44b5121370f02d74de', // Red Tilt
      tempF = 68,
      sgX1000 = 1052,
      txPower = -59,
      subType = 0x02,
      subLength = 0x15,
    } = {}) {
      const buf = new Uint8Array(23);
      buf[0] = subType;
      buf[1] = subLength;

      // UUID 16 bytes
      for (let i = 0; i < 16; i++) {
        buf[2 + i] = parseInt(uuidHex.substr(i * 2, 2), 16);
      }

      // Temp big-endian uint16
      buf[18] = (tempF >> 8) & 0xff;
      buf[19] = tempF & 0xff;

      // SG big-endian uint16
      buf[20] = (sgX1000 >> 8) & 0xff;
      buf[21] = sgX1000 & 0xff;

      // TX power
      buf[22] = txPower & 0xff;

      return buf;
    }

    it('parses valid Red Tilt advertisement buffer', () => {
      const buffer = createTiltBuffer({ tempF: 68, sgX1000: 1050 });
      const reading = parseTiltAdvertisement(buffer, -65);

      expect(reading).not.toBeNull();
      expect(reading.color).toBe('Röd');
      expect(reading.sg).toBe(1.050);
      expect(reading.tempC).toBe(20.0);
      expect(reading.tempF).toBe(68);
      expect(reading.rssi).toBe(-65);
      expect(reading.signal.label).toBe('Bra');
    });

    it('parses Blue Tilt advertisement correctly', () => {
      const buffer = createTiltBuffer({
        uuidHex: 'a495bb60c5b14b44b5121370f02d74de', // Blue
        tempF: 64,
        sgX1000: 1012,
      });
      const reading = parseTiltAdvertisement(buffer, -50);

      expect(reading).not.toBeNull();
      expect(reading.color).toBe('Blå');
      expect(reading.sg).toBe(1.012);
      expect(reading.signal.label).toBe('Utmärkt');
    });

    it('supports Web Bluetooth Map manufacturerData structure', () => {
      const buffer = createTiltBuffer({ tempF: 70, sgX1000: 1045 });
      const map = new Map();
      map.set(APPLE_COMPANY_ID, new DataView(buffer.buffer));

      const reading = parseTiltAdvertisement(map, -72);
      expect(reading).not.toBeNull();
      expect(reading.color).toBe('Röd');
      expect(reading.sg).toBe(1.045);
    });

    it('returns null for truncated or invalid data', () => {
      expect(parseTiltAdvertisement(null)).toBeNull();
      expect(parseTiltAdvertisement(new Uint8Array([0x01, 0x02]))).toBeNull();

      // Wrong subType or subLength
      const badHeader = createTiltBuffer({ subType: 0x99 });
      expect(parseTiltAdvertisement(badHeader)).toBeNull();

      // Non-Tilt UUID
      const nonTiltUUID = createTiltBuffer({ uuidHex: '00112233445566778899aabbccddeeff' });
      expect(parseTiltAdvertisement(nonTiltUUID)).toBeNull();

      // Unrealistic brewing SG (< 0.95 or > 1.25)
      const insaneSG = createTiltBuffer({ sgX1000: 1450 });
      expect(parseTiltAdvertisement(insaneSG)).toBeNull();
    });
  });

  describe('startTiltSimulation', () => {
    it('emits simulated readings and can be stopped', () => {
      vi.useFakeTimers();
      const readings = [];
      const stop = startTiltSimulation({
        onReading: (r) => readings.push(r),
        initialSG: 1.054,
        initialTempC: 19.5,
        color: 'Grön',
        intervalMs: 1000,
      });

      expect(readings.length).toBe(1);
      expect(readings[0].color).toBe('Grön');
      expect(readings[0].isSimulated).toBe(true);
      expect(readings[0].sg).toBeCloseTo(1.054, 2);

      vi.advanceTimersByTime(2500);
      expect(readings.length).toBe(3);

      stop();
      vi.advanceTimersByTime(2000);
      expect(readings.length).toBe(3); // Stopped, no more emissions

      vi.useRealTimers();
    });
  });

  describe('Web Bluetooth Feature Checks & Scan Handling', () => {
    const originalNavigator = globalThis.navigator;

    afterEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    });

    it('detects when Web Bluetooth is not supported', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });
      expect(isWebBluetoothSupported()).toBe(false);
      expect(isLeScanSupported()).toBe(false);
    });

    it('detects when requestLEScan is supported', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          bluetooth: {
            requestLEScan: vi.fn(),
          },
        },
        configurable: true,
        writable: true,
      });
      expect(isWebBluetoothSupported()).toBe(true);
      expect(isLeScanSupported()).toBe(true);
    });

    it('startTiltScan throws descriptive error when Web Bluetooth is missing', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });
      const onError = vi.fn();
      await expect(startTiltScan({ onReading: vi.fn(), onError })).rejects.toThrow('Web Bluetooth stöds inte');
      expect(onError).toHaveBeenCalled();
    });
  });
});

describe('Tilt UI Controller (tiltController.js)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders Tilt panel HTML with expected elements and prefixes', () => {
    const html = getTiltPanelHtml('test-unit');
    document.body.innerHTML = html;

    expect(document.getElementById('test-unit-tilt-panel')).not.toBeNull();
    expect(document.getElementById('test-unit-btn-tilt-scan')).not.toBeNull();
    expect(document.getElementById('test-unit-btn-tilt-demo')).not.toBeNull();
    expect(document.getElementById('test-unit-btn-tilt-stop')).not.toBeNull();
    expect(document.getElementById('test-unit-btn-tilt-log-now')).not.toBeNull();
    expect(document.getElementById('test-unit-tilt-autolog-toggle')).not.toBeNull();
  });

  it('starts demo simulation and updates DOM on click', () => {
    vi.useFakeTimers();
    document.body.innerHTML = getTiltPanelHtml('unit-demo');
    const panel = document.getElementById('unit-demo-tilt-panel');
    const controller = setupTiltPanel(panel, {
      idPrefix: 'unit-demo',
      defaultSG: 1.048,
      defaultTempC: 21.0,
    });

    const btnDemo = document.getElementById('unit-demo-btn-tilt-demo');
    btnDemo.click();

    expect(controller.isActive()).toBe(true);
    const sgEl = document.getElementById('unit-demo-tilt-sg-val');
    expect(sgEl.textContent).toContain('1.04');

    const badge = document.getElementById('unit-demo-tilt-status-badge');
    expect(badge.textContent).toBe('Simulering aktiv');

    controller.stop();
    expect(badge.textContent).toBe('Stoppad');
    expect(controller.isActive()).toBe(false);

    vi.useRealTimers();
  });

  it('triggers onLogReading callback when manual log button is pressed', () => {
    vi.useFakeTimers();
    document.body.innerHTML = getTiltPanelHtml('unit-log');
    const panel = document.getElementById('unit-log-tilt-panel');
    const logSpy = vi.fn();

    const controller = setupTiltPanel(panel, {
      idPrefix: 'unit-log',
      defaultSG: 1.055,
      defaultTempC: 18.5,
      onLogReading: logSpy,
    });

    // Start simulation to populate currentReading
    document.getElementById('unit-log-btn-tilt-demo').click();

    // Click Log Now
    document.getElementById('unit-log-btn-tilt-log-now').click();

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0].sg).toBeCloseTo(1.055, 2);
    expect(logSpy.mock.calls[0][0].tempC).toBeCloseTo(18.5, 0);
    expect(logSpy.mock.calls[0][0].note).toContain('Tilt Röd');

    controller.stop();
    vi.useRealTimers();
  });

  it('persists session across re-renders for the same prefix', () => {
    vi.useFakeTimers();
    // First render
    document.body.innerHTML = getTiltPanelHtml('persist-test');
    const panel1 = document.getElementById('persist-test-tilt-panel');
    const controller1 = setupTiltPanel(panel1, {
      idPrefix: 'persist-test',
      defaultSG: 1.060,
    });

    document.getElementById('persist-test-btn-tilt-demo').click();
    expect(controller1.isActive()).toBe(true);

    // Simulate batch view re-rendering (replacing DOM)
    document.body.innerHTML = getTiltPanelHtml('persist-test');
    const panel2 = document.getElementById('persist-test-tilt-panel');
    const controller2 = setupTiltPanel(panel2, {
      idPrefix: 'persist-test',
      defaultSG: 1.060,
    });

    expect(controller2.isActive()).toBe(true);
    const sgEl2 = document.getElementById('persist-test-tilt-sg-val');
    expect(sgEl2.textContent).toContain('1.06');

    controller2.stop();
    expect(controller2.isActive()).toBe(false);
    vi.useRealTimers();
  });
});
