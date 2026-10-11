/**
 * Tilt Digital Hydrometer UI Controller.
 * Handles Bluetooth LE scanning, live telemetry display, demo simulation,
 * and seamless logging into batch gravity logs.
 */

import {
  isWebBluetoothSupported,
  isLeScanSupported,
  startTiltScan,
  startTiltSimulation,
} from '../core/tiltBluetooth.js';
import { sgToPlato, formatSG } from '../core/calculations.js';
import { showToast } from './toast.js';

/**
 * Active background sessions by panel prefix so re-renders of the batch view
 * do not interrupt live scans or demo simulations.
 */
const activeSessions = new Map();

/**
 * Returns HTML template string for the Tilt Hydrometer IoT Panel.
 * @param {string} [idPrefix='']
 * @returns {string} HTML markup
 */
export function getTiltPanelHtml(idPrefix = '') {
  const p = idPrefix ? `${idPrefix}-` : '';

  return `
    <div class="tilt-iot-panel" id="${p}tilt-panel">
      <div class="tilt-panel-header">
        <div class="tilt-header-title">
          <span class="tilt-pulse-icon">📡</span>
          <strong>Tilt Hydrometer (IoT Bluetooth)</strong>
          <span class="badge badge-info" id="${p}tilt-status-badge">Klar att ansluta</span>
        </div>
        <div class="tilt-header-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="${p}btn-tilt-scan" title="Sök efter Tilt iBeacons via Web Bluetooth">
            📡 Sök Bluetooth
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="${p}btn-tilt-demo" title="Starta interaktiv Tilt-simulering för test">
            🧪 Testa Demo
          </button>
          <button type="button" class="btn btn-danger btn-sm hidden" id="${p}btn-tilt-stop" title="Stoppa aktiv avläsning">
            ⏹️ Stoppa
          </button>
        </div>
      </div>

      <div id="${p}tilt-live-card" class="tilt-live-card hidden">
        <div class="tilt-reading-row">
          <div class="tilt-color-indicator">
            <span class="tilt-color-dot" id="${p}tilt-color-dot"></span>
            <span id="${p}tilt-color-name" style="font-weight:700">Röd Tilt</span>
          </div>
          <div class="tilt-reading-metrics">
            <div class="tilt-metric-box">
              <span class="tilt-metric-lbl">Gravitet</span>
              <span class="tilt-metric-val" id="${p}tilt-sg-val">1.050</span>
              <span class="tilt-metric-sub" id="${p}tilt-plato-val">12.4 °P</span>
            </div>
            <div class="tilt-metric-box">
              <span class="tilt-metric-lbl">Temperatur</span>
              <span class="tilt-metric-val" id="${p}tilt-temp-val">20.0 °C</span>
              <span class="tilt-metric-sub" id="${p}tilt-tempf-val">68.0 °F</span>
            </div>
            <div class="tilt-metric-box">
              <span class="tilt-metric-lbl">Signal (RSSI)</span>
              <span class="tilt-metric-val" id="${p}tilt-rssi-val">-68 dBm</span>
              <span class="tilt-metric-sub" id="${p}tilt-quality-val" style="color:#10b981">Bra</span>
            </div>
          </div>
          <div class="tilt-actions-box">
            <button type="button" class="btn btn-primary btn-sm" id="${p}btn-tilt-log-now">
              💾 Logga mätning
            </button>
            <label class="tilt-autolog-label">
              <input type="checkbox" id="${p}tilt-autolog-toggle"> Auto-logg (15 min)
            </label>
          </div>
        </div>
        <div class="tilt-live-footer">
          <span class="tilt-updated-time" id="${p}tilt-updated-time">Senaste sändning: just nu</span>
          <span id="${p}tilt-mode-hint" class="tilt-mode-hint"></span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Initializes interactive logic for a Tilt Hydrometer IoT Panel.
 * @param {HTMLElement} panelEl - Root element of the panel
 * @param {object} options
 * @param {string} [options.idPrefix='']
 * @param {Function} [options.onLogReading] - (reading: { sg, tempC, note }) => void
 * @param {number} [options.defaultSG=1.050]
 * @param {number} [options.defaultTempC=20.0]
 * @returns {object} Controller instance
 */
export function setupTiltPanel(panelEl, options = {}) {
  if (!panelEl) return { stop: () => {} };

  const prefixKey = options.idPrefix || 'default';
  const p = options.idPrefix ? `${options.idPrefix}-` : '';
  const onLog = options.onLogReading || (() => {});
  const defaultSG = options.defaultSG || 1.050;
  const defaultTempC = options.defaultTempC || 20.0;

  const btnScan = panelEl.querySelector(`#${p}btn-tilt-scan`);
  const btnDemo = panelEl.querySelector(`#${p}btn-tilt-demo`);
  const btnStop = panelEl.querySelector(`#${p}btn-tilt-stop`);
  const btnLog = panelEl.querySelector(`#${p}btn-tilt-log-now`);
  const toggleAuto = panelEl.querySelector(`#${p}tilt-autolog-toggle`);

  const statusBadge = panelEl.querySelector(`#${p}tilt-status-badge`);
  const liveCard = panelEl.querySelector(`#${p}tilt-live-card`);
  const colorDot = panelEl.querySelector(`#${p}tilt-color-dot`);
  const colorName = panelEl.querySelector(`#${p}tilt-color-name`);
  const sgVal = panelEl.querySelector(`#${p}tilt-sg-val`);
  const platoVal = panelEl.querySelector(`#${p}tilt-plato-val`);
  const tempVal = panelEl.querySelector(`#${p}tilt-temp-val`);
  const tempFVal = panelEl.querySelector(`#${p}tilt-tempf-val`);
  const rssiVal = panelEl.querySelector(`#${p}tilt-rssi-val`);
  const qualityVal = panelEl.querySelector(`#${p}tilt-quality-val`);
  const updatedTime = panelEl.querySelector(`#${p}tilt-updated-time`);
  const modeHint = panelEl.querySelector(`#${p}tilt-mode-hint`);

  function updateStatus(text, badgeClass = 'badge-info') {
    if (statusBadge) {
      statusBadge.textContent = text;
      statusBadge.className = `badge ${badgeClass}`;
    }
  }

  function renderReading(reading) {
    if (!reading) return;

    if (liveCard) liveCard.classList.remove('hidden');
    if (btnStop) btnStop.classList.remove('hidden');

    if (colorDot) colorDot.style.background = reading.colorHex || '#ef4444';
    if (colorName) colorName.textContent = `${reading.color} Tilt`;

    if (sgVal) sgVal.textContent = formatSG(reading.sg);
    if (platoVal) platoVal.textContent = `${sgToPlato(reading.sg).toFixed(1)} °P`;
    if (tempVal) tempVal.textContent = `${reading.tempC.toFixed(1)} °C`;
    if (tempFVal) tempFVal.textContent = `${reading.tempF.toFixed(1)} °F`;

    if (rssiVal) rssiVal.textContent = reading.rssi !== null ? `${reading.rssi} dBm` : '—';
    if (qualityVal && reading.signal) {
      qualityVal.textContent = reading.signal.label;
      qualityVal.style.color = reading.signal.color;
    }

    if (updatedTime) {
      const d = new Date(reading.timestamp);
      updatedTime.textContent = `Senast: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }

    if (modeHint) {
      modeHint.textContent = reading.isSimulated ? '🧪 Simulering (Demo)' : '📡 Live Bluetooth';
    }

    updateStatus(reading.isSimulated ? 'Simulering aktiv' : 'Signal ansluten', 'badge-success');
  }

  // Check if an existing session is running for this prefix
  const existing = activeSessions.get(prefixKey);
  if (existing) {
    existing.onLog = onLog;
    existing.domUpdater = renderReading;
    if (existing.currentReading) {
      renderReading(existing.currentReading);
    }
    if (toggleAuto) {
      toggleAuto.checked = Boolean(existing.autoLogEnabled);
    }
  }

  function handleReading(reading) {
    const session = activeSessions.get(prefixKey);
    if (session) {
      session.currentReading = reading;
    }

    renderReading(reading);

    // Auto-log check: once every 15 min if checked
    if (session?.autoLogEnabled && session.currentReading) {
      const now = Date.now();
      if (now - (session.lastAutoLogTime || 0) >= 15 * 60 * 1000) {
        session.lastAutoLogTime = now;
        session.onLog({
          sg: session.currentReading.sg,
          tempC: session.currentReading.tempC,
          note: `Tilt ${session.currentReading.color}${session.currentReading.isSimulated ? ' (Demo)' : ''} [Auto]`,
        });
        showToast(`Auto-loggad Tilt: ${formatSG(session.currentReading.sg)} SG (${session.currentReading.tempC}°C)`);
      }
    }
  }

  function stop() {
    const session = activeSessions.get(prefixKey);
    if (session?.stopFn) {
      session.stopFn();
    }
    activeSessions.delete(prefixKey);
    if (btnStop) btnStop.classList.add('hidden');
    updateStatus('Stoppad', 'badge-secondary');
  }

  // Toggle autolog
  toggleAuto?.addEventListener('change', () => {
    let session = activeSessions.get(prefixKey);
    if (!session) {
      session = {
        stopFn: null,
        currentReading: null,
        autoLogEnabled: toggleAuto.checked,
        lastAutoLogTime: 0,
        onLog,
        domUpdater: renderReading,
      };
      activeSessions.set(prefixKey, session);
    } else {
      session.autoLogEnabled = toggleAuto.checked;
    }
  });

  // Sök Bluetooth
  btnScan?.addEventListener('click', async () => {
    stop();

    if (!isWebBluetoothSupported()) {
      showToast('Web Bluetooth stöds inte i denna webbläsare. Använd Chrome eller Edge.', 'warning');
      return;
    }

    if (!isLeScanSupported()) {
      showToast('Web Bluetooth scanning kräver chrome://flags/#enable-experimental-web-platform-features.', 'warning');
      return;
    }

    updateStatus('Söker Tilt...', 'badge-warning');

    const session = {
      stopFn: null,
      currentReading: null,
      autoLogEnabled: toggleAuto?.checked || false,
      lastAutoLogTime: 0,
      onLog,
      domUpdater: renderReading,
    };
    activeSessions.set(prefixKey, session);

    try {
      session.stopFn = await startTiltScan({
        onReading: handleReading,
        onError: (err) => {
          showToast(`Bluetooth-fel: ${err.message}`, 'error');
          updateStatus('Fel', 'badge-danger');
          stop();
        },
        onStatus: (msg) => updateStatus(msg, 'badge-info'),
      });
    } catch (e) {
      console.warn('[TiltPanel] Kunde inte starta skanning:', e);
      stop();
    }
  });

  // Testa Demo / Simulering
  btnDemo?.addEventListener('click', () => {
    stop();
    updateStatus('Startar demo...', 'badge-info');

    const session = {
      stopFn: null,
      currentReading: null,
      autoLogEnabled: toggleAuto?.checked || false,
      lastAutoLogTime: 0,
      onLog,
      domUpdater: renderReading,
    };
    activeSessions.set(prefixKey, session);

    session.stopFn = startTiltSimulation({
      onReading: handleReading,
      initialSG: defaultSG,
      initialTempC: defaultTempC,
      color: 'Röd',
      intervalMs: 2500,
    });

    showToast('Tilt-simulering startad! Sänder mätningar var 2.5s.', 'success');
  });

  // Stoppa
  btnStop?.addEventListener('click', () => {
    stop();
    showToast('Tilt-avläsning stoppad.');
  });

  // Logga mätning manuellt
  btnLog?.addEventListener('click', () => {
    const session = activeSessions.get(prefixKey);
    const reading = session?.currentReading;
    if (!reading) {
      showToast('Ingen Tilt-mätning tillgänglig att logga ännu.', 'warning');
      return;
    }

    const logFn = session?.onLog || onLog;
    logFn({
      sg: reading.sg,
      tempC: reading.tempC,
      note: `Tilt ${reading.color}${reading.isSimulated ? ' (Demo)' : ''}`,
    });
    if (session) session.lastAutoLogTime = Date.now();
    showToast(`Mätning sparad: ${formatSG(reading.sg)} SG (${reading.tempC}°C)`, 'success');
  });

  return {
    stop,
    getLatestReading: () => activeSessions.get(prefixKey)?.currentReading || null,
    isActive: () => Boolean(activeSessions.get(prefixKey)),
  };
}
