/**
 * Modular Mobile App HTML Template.
 * Extracted from index.html to decouple mobile screen markup from the desktop DOM tree.
 */

export function getMobileAppTemplate() {
  return `
  <!-- Mobil Top Header -->
  <header class="mobile-header">
    <div class="mobile-header-brand">
      <span class="logo-icon"><svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M10 6h4M12 6v4l-4.5 7.5A1.2 1.2 0 0 0 8.5 19.3h7a1.2 1.2 0 0 0 1-1.8L12 10V6"/><path d="M9.5 16c1.5-.7 3.5 1 5 0"/></svg></span>
      <span class="mobile-brand-title">Brygglabbet</span>
    </div>
    <div class="mobile-recipe-name-wrap">
      <input type="text" id="mobile-recipe-name" value="Mitt nya öl" placeholder="Receptnamn...">
    </div>
    <button class="mobile-icon-btn" id="mobile-menu-btn" title="Meny">
      <svg class="svg-icon" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  </header>

  <!-- Mobil Meny-Dropdown -->
  <div class="mobile-menu-backdrop" id="mobile-menu-backdrop"></div>
  <div class="mobile-menu-dropdown" id="mobile-menu-dropdown">
    <div class="mobile-menu-header">Huvudverktyg</div>
    <button class="mobile-menu-item" id="mobile-menu-batches" style="font-weight:bold; color:var(--accent);"><span class="quick-icon">📒</span> Mina bryggningar</button>
    <button class="mobile-menu-item" id="mobile-menu-brewday" style="font-weight:bold; color:var(--accent-bright);"><span class="quick-icon">🍺</span> Bryggdagsläge</button>
    <button class="mobile-menu-item" id="mobile-menu-print"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Skriv ut bryggprotokoll</button>
    <button class="mobile-menu-item" id="mobile-menu-tools"><span class="quick-icon">🧰</span> Bryggverktyg</button>
    <hr class="mobile-menu-divider">
    <div class="mobile-menu-header">Recept-hantering</div>
    <button class="mobile-menu-item" id="mobile-menu-new"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 1-2 2v16a2 2 0 0 1 2 2h12a2 2 0 0 1 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg> Nytt recept</button>
    <button class="mobile-menu-item" id="mobile-menu-open"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Öppna sparat</button>
    <button class="mobile-menu-item" id="mobile-menu-save"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Spara recept</button>
    <button class="mobile-menu-item" id="mobile-menu-export"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Exportera JSON</button>
    <button class="mobile-menu-item" id="mobile-menu-export-beerxml"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Exportera BeerXML</button>
    <button class="mobile-menu-item" id="mobile-menu-import"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importera recept</button>
    <button class="mobile-menu-item" id="mobile-menu-share-qr"><span class="quick-icon">📱</span> Dela recept / QR-kod</button>
    <hr class="mobile-menu-divider">
    <div class="mobile-menu-header">Historik & Hjälp</div>
    <button class="mobile-menu-item" id="mobile-menu-undo">↩️ Ångra ändring</button>
    <button class="mobile-menu-item" id="mobile-menu-redo">↪️ Gör om ändring</button>
    <button class="mobile-menu-item" id="mobile-menu-guide"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Brygguide & Råvaror</button>
    <hr class="mobile-menu-divider">
    <button class="mobile-menu-item text-secondary" id="btn-switch-to-desktop">💻 Växla till skrivbordsvy</button>
  </div>

  <!-- Permanent Sticky Metrics Bar -->
  <div class="mobile-metrics-bar">
    <div class="mobile-metric-item">
      <span class="metric-lbl">OG</span>
      <span class="metric-val" id="mobile-metric-og">1.050</span>
    </div>
    <div class="mobile-metric-item">
      <span class="metric-lbl">ABV</span>
      <span class="metric-val highlight" id="mobile-metric-abv">5.2%</span>
    </div>
    <div class="mobile-metric-item">
      <span class="metric-lbl">IBU</span>
      <span class="metric-val" id="mobile-metric-ibu">35</span>
    </div>
    <div class="mobile-metric-item">
      <span class="metric-lbl">EBC</span>
      <span class="metric-val" id="mobile-metric-ebc">
        <span class="ebc-color-dot" id="mobile-metric-color-dot"></span>
        <span id="mobile-metric-ebc-text">12</span>
      </span>
    </div>
  </div>

  <!-- Mobile Screens Container -->
  <main class="mobile-screen-container" id="mobile-screen-container">

    <!-- Screen 1: Grunddata & Utrustning -->
    <section class="mobile-screen active" id="mobile-screen-recipe">
      <div class="mobile-screen-header flex-between">
        <h2>Grunddata & Utrustning</h2>
        <div style="display:flex; gap:6px">
          <button class="btn btn-ghost btn-sm" id="mobile-btn-preset-recipes">📋 Mallar</button>
          <button class="btn btn-secondary btn-sm" id="mobile-btn-scale-recipe">⚖️ Skala</button>
        </div>
      </div>

      <div class="mobile-card-form">
        <p class="section-label">🎯 Ölstil & Mål</p>
        <div class="mobile-form-group">
          <label for="mobile-recipe-style">BJCP-ölistil</label>
          <select id="mobile-recipe-style" class="mobile-select-lg">
            <option value="">— Välj stil —</option>
          </select>
        </div>

        <p class="section-label" style="margin-top:6px">⚙️ Utrustningsprofil</p>
        <div class="mobile-form-group">
          <label for="mobile-equipment-preset">Bryggverk / Utrustning</label>
          <select id="mobile-equipment-preset" class="mobile-select-lg"></select>
        </div>

        <div class="mobile-form-row-2">
          <div class="mobile-form-group">
            <label for="mobile-batch-volume">Bryggvolym (L)</label>
            <input type="number" inputmode="decimal" id="mobile-batch-volume" value="20" step="0.5">
          </div>
          <div class="mobile-form-group">
            <label for="mobile-boil-volume">Kokvolym (L)</label>
            <input type="number" inputmode="decimal" id="mobile-boil-volume" value="25" step="0.5">
          </div>
        </div>

        <div class="mobile-form-row-2">
          <div class="mobile-form-group">
            <label for="mobile-boil-time">Koktid (min)</label>
            <input type="number" inputmode="decimal" id="mobile-boil-time" value="60" step="5">
          </div>
          <div class="mobile-form-group">
            <label for="mobile-efficiency">Effektivitet (%)</label>
            <input type="number" inputmode="decimal" id="mobile-efficiency" value="75" step="1">
          </div>
        </div>

        <!-- Detaljerade förluster -->
        <p class="section-label" style="margin-top:6px">📊 Förlustparametrar</p>
        <div class="mobile-loss-grid">
          <div class="mobile-loss-item">
            <label for="mobile-eq-boiloff">Avdunstning (L/h)</label>
            <div class="mobile-stepper">
              <button class="stepper-btn" data-eq-loss="boilOffRate" data-dir="-0.5">–</button>
              <input type="number" inputmode="decimal" class="stepper-input" id="mobile-eq-boiloff" value="3.0" step="0.1">
              <button class="stepper-btn" data-eq-loss="boilOffRate" data-dir="0.5">+</button>
            </div>
          </div>
          <div class="mobile-loss-item">
            <label for="mobile-eq-kettle-loss">Grytförlust (L)</label>
            <div class="mobile-stepper">
              <button class="stepper-btn" data-eq-loss="kettleLoss" data-dir="-0.5">–</button>
              <input type="number" inputmode="decimal" class="stepper-input" id="mobile-eq-kettle-loss" value="2.0" step="0.5">
              <button class="stepper-btn" data-eq-loss="kettleLoss" data-dir="0.5">+</button>
            </div>
          </div>
          <div class="mobile-loss-item">
            <label for="mobile-eq-grain-abs">Maltabs. (L/kg)</label>
            <div class="mobile-stepper">
              <button class="stepper-btn" data-eq-loss="grainAbsorption" data-dir="-0.05">–</button>
              <input type="number" inputmode="decimal" class="stepper-input" id="mobile-eq-grain-abs" value="0.96" step="0.05">
              <button class="stepper-btn" data-eq-loss="grainAbsorption" data-dir="0.05">+</button>
            </div>
          </div>
          <div class="mobile-loss-item">
            <label for="mobile-eq-mash-thickness">Mäskkvot (L/kg)</label>
            <div class="mobile-stepper">
              <button class="stepper-btn" data-eq-loss="mashRatio" data-dir="-0.2">–</button>
              <input type="number" inputmode="decimal" class="stepper-input" id="mobile-eq-mash-thickness" value="3.0" step="0.1">
              <button class="stepper-btn" data-eq-loss="mashRatio" data-dir="0.2">+</button>
            </div>
          </div>
        </div>

        <!-- Beräknat vattenbehov -->
        <p class="section-label" style="margin-top:6px">💧 Beräknat Vattenbehov</p>
        <div class="mobile-water-calc-card">
          <div class="mobile-water-calc-row">
            <span>Mäskvatten:</span>
            <strong id="mobile-mash-water">— L</strong>
          </div>
          <div class="mobile-water-calc-row">
            <span>Lakvatten:</span>
            <strong id="mobile-sparge-water">— L</strong>
          </div>
          <div class="mobile-water-calc-row total">
            <span>Totalt vatten:</span>
            <strong id="mobile-total-water">— L</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- Screen 2: Malt & Mäskschema -->
    <section class="mobile-screen" id="mobile-screen-malt">
      <div class="mobile-screen-header flex-between">
        <h2>Malt & Mäskschema</h2>
        <button class="btn btn-primary btn-sm" id="mobile-btn-add-fermentable">＋ Lägg till malt</button>
      </div>

      <div class="mobile-summary-banner" id="mobile-malt-summary">
        <span>Totalt: <strong id="mobile-total-malt-kg">0.00 kg</strong></span>
        <span>EBC: <strong id="mobile-total-malt-ebc">0</strong></span>
      </div>

      <div id="mobile-fermentables-empty" class="mobile-empty-state">
        <div class="empty-icon">🌾</div>
        <p>Ingen malt tillagd ännu.</p>
        <button class="btn btn-primary" id="mobile-btn-empty-add-malt">＋ Välj malt ur databasen</button>
      </div>

      <div id="mobile-fermentables-list" class="mobile-cards-list"></div>

      <!-- Mäskschema -->
      <div class="mobile-card-form" style="margin-top:14px">
        <p class="section-label">🌡️ Mäskschema & Raster</p>
        <div class="mobile-preset-buttons">
          <button class="preset-btn" data-mobile-mash="single_light">65°C Torrt</button>
          <button class="preset-btn" data-mobile-mash="single_medium">67°C Medium</button>
          <button class="preset-btn" data-mobile-mash="single_full">69°C Fylligt</button>
        </div>

        <div id="mobile-mash-steps-list" class="mobile-cards-list" style="margin-top:10px"></div>

        <button class="btn btn-secondary btn-sm" id="mobile-btn-add-mash-step" style="margin-top:10px; width:100%">＋ Lägg till mäsksteg</button>
      </div>
    </section>

    <!-- Screen 3: Humlegivor -->
    <section class="mobile-screen" id="mobile-screen-hops">
      <div class="mobile-screen-header flex-between">
        <h2>Humlegivor</h2>
        <button class="btn btn-primary btn-sm" id="mobile-btn-add-hop">＋ Lägg till humle</button>
      </div>

      <div class="mobile-summary-banner" id="mobile-hops-summary">
        <span>Totalt: <strong id="mobile-total-hops-g">0 g</strong></span>
        <span>IBU: <strong id="mobile-total-hops-ibu">0.0</strong></span>
      </div>

      <div id="mobile-hops-empty" class="mobile-empty-state">
        <div class="empty-icon">🌿</div>
        <p>Ingen humle tillagd ännu.</p>
        <button class="btn btn-primary" id="mobile-btn-empty-add-hop">＋ Välj humle ur databasen</button>
      </div>

      <div id="mobile-hops-list" class="mobile-cards-list"></div>
    </section>

    <!-- Screen 4: Jäst & Vattenkemi -->
    <section class="mobile-screen" id="mobile-screen-yeast">
      <div class="mobile-screen-header">
        <h2>Jäst & Vattenkemi</h2>
      </div>

      <div class="mobile-card-form">
        <p class="section-label">🧫 Jäststam & Förjäsning</p>

        <div class="mobile-form-group">
          <label for="mobile-yeast-select">Välj ur jästdatabas</label>
          <select id="mobile-yeast-select" class="mobile-select-lg">
            <option value="">— Välj jäststam —</option>
          </select>
        </div>

        <div class="mobile-form-group">
          <label for="mobile-yeast-name">Jästnamn (Anpassad)</label>
          <input type="text" id="mobile-yeast-name" placeholder="t.ex. SafAle US-05">
        </div>

        <div class="mobile-form-row-2">
          <div class="mobile-form-group">
            <label for="mobile-yeast-lab">Tillverkare / Lab</label>
            <input type="text" id="mobile-yeast-lab" placeholder="Fermentis">
          </div>
          <div class="mobile-form-group">
            <label for="mobile-yeast-type">Jästtyp</label>
            <select id="mobile-yeast-type">
              <option value="ale">Ale (Överjäst)</option>
              <option value="lager">Lager (Underjäst)</option>
              <option value="wheat">Veteöl</option>
              <option value="kveik">Kveik</option>
              <option value="wild">Vild / Brett</option>
            </select>
          </div>
        </div>

        <div class="mobile-form-row-2">
          <div class="mobile-form-group">
            <label for="mobile-att-min">Förjäsning min (%)</label>
            <input type="number" inputmode="decimal" id="mobile-att-min" value="72">
          </div>
          <div class="mobile-form-group">
            <label for="mobile-att-max">Förjäsning max (%)</label>
            <input type="number" inputmode="decimal" id="mobile-att-max" value="78">
          </div>
        </div>

        <div class="mobile-form-group" style="margin-top:10px">
          <label for="mobile-ferm-profile">Jäsningsprofil</label>
          <select id="mobile-ferm-profile">
            <option value="auto">Automatisk (från jästtyp)</option>
            <option value="ale">Standard Ale (19°C, 12 dgr)</option>
            <option value="lager">Traditionell Lager (11°C, diacetylvila, kallagring)</option>
            <option value="kveik">Kveik Express (33°C, 4 dgr)</option>
            <option value="wheat">Veteöl / Belgisk (20°C, 10 dgr)</option>
          </select>
        </div>

        <label class="tool-check" style="margin:8px 0">
          <input type="checkbox" id="mobile-ferm-coldcrash"> Kallkrascha i schema (+2 dgr vid 3°C)
        </label>

        <div class="tool-result" id="mobile-ferm-schedule-summary" style="margin-top:8px; font-size:0.85rem;"></div>

        <hr class="mobile-menu-divider" style="margin: 16px 0">

        <p class="section-label">💧 Vattenbehandling & Salter <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(Valfritt)</span></p>

        <div class="mobile-form-group">
          <label for="mobile-water-preset">Ladda vatten-preset</label>
          <select id="mobile-water-preset" class="mobile-select-lg">
            <option value="">— Välj profil —</option>
          </select>
        </div>

        <div class="mobile-form-group" style="margin-bottom:12px">
          <label for="mobile-water-volume">Total behandlad vattenvolym (L)</label>
          <input type="number" inputmode="decimal" id="mobile-water-volume" value="25" min="1" step="0.5">
        </div>

        <div class="mobile-salt-grid">
          <div class="mobile-salt-item">
            <label>Gips (CaSO₄)</label>
            <div class="mobile-stepper">
              <button class="stepper-btn" data-salt="gypsum" data-dir="-1">–</button>
              <input type="number" inputmode="decimal" class="stepper-input" id="mobile-salt-gypsum" value="0" step="0.5">
              <button class="stepper-btn" data-salt="gypsum" data-dir="1">+</button>
            </div>
          </div>

          <div class="mobile-salt-item">
            <label>Kalciumklorid (CaCl₂)</label>
            <div class="mobile-stepper">
              <button class="stepper-btn" data-salt="calciumChloride" data-dir="-1">–</button>
              <input type="number" inputmode="decimal" class="stepper-input" id="mobile-salt-calciumChloride" value="0" step="0.5">
              <button class="stepper-btn" data-salt="calciumChloride" data-dir="1">+</button>
            </div>
          </div>

          <div class="mobile-salt-item">
            <label>Epsomsalt (MgSO₄)</label>
            <div class="mobile-stepper">
              <button class="stepper-btn" data-salt="epsomSalt" data-dir="-1">–</button>
              <input type="number" inputmode="decimal" class="stepper-input" id="mobile-salt-epsomSalt" value="0" step="0.5">
              <button class="stepper-btn" data-salt="epsomSalt" data-dir="1">+</button>
            </div>
          </div>

          <div class="mobile-salt-item">
            <label>Bordssalt (NaCl)</label>
            <div class="mobile-stepper">
              <button class="stepper-btn" data-salt="tableSalt" data-dir="-1">–</button>
              <input type="number" inputmode="decimal" class="stepper-input" id="mobile-salt-tableSalt" value="0" step="0.5">
              <button class="stepper-btn" data-salt="tableSalt" data-dir="1">+</button>
            </div>
          </div>
        </div>

        <div class="mobile-water-summary-box">
          <span>Cl⁻ / SO₄²⁻-kvot:</span>
          <strong id="mobile-water-ratio">1.0 (Balanserad)</strong>
        </div>

        <!-- Mobil: Mäsk-pH & syra -->
        <div class="card" id="mobile-card-mash-ph" style="margin-top:14px">
          <p class="section-label" style="margin-bottom:8px">🧪 Mäsk-pH &amp; syra</p>
          <div class="ph-summary">
            <div>
              <span class="tool-hint">Uppskattat mäsk-pH</span>
              <div class="ph-big" id="mobile-w-ph-value">—</div>
              <div class="tool-hint" id="mobile-w-ph-label"></div>
            </div>
            <div>
              <span class="tool-hint">Restalkalinitet (RA)</span>
              <div style="font-weight:700" id="mobile-w-ra-value">—</div>
              <div class="tool-hint" id="mobile-w-ra-label"></div>
            </div>
          </div>
          <label class="tool-check" style="margin:10px 0">
            <input type="checkbox" id="mobile-acid-enabled"> Justera pH med syra
          </label>
          <div id="mobile-acid-controls" class="hidden">
            <div class="mobile-form-group" style="margin-bottom:8px">
              <label class="form-label" for="mobile-acid-target-ph">Mål-pH</label>
              <input type="number" inputmode="decimal" id="mobile-acid-target-ph" value="5.4" min="5.0" max="5.8" step="0.05">
            </div>
            <div class="mobile-form-group" style="margin-bottom:8px">
              <label class="form-label" for="mobile-acid-type">Syra</label>
              <select id="mobile-acid-type">
                <option value="lactic:80">Mjölksyra 80 %</option>
                <option value="lactic:88">Mjölksyra 88 %</option>
                <option value="phosphoric:10">Fosforsyra 10 %</option>
                <option value="phosphoric:75">Fosforsyra 75 %</option>
              </select>
            </div>
            <label class="tool-check" style="margin:8px 0">
              <input type="checkbox" id="mobile-acid-treat-sparge" checked> Syra även lakvattnet
            </label>
            <div class="tool-result" id="mobile-acid-result" style="margin-top:8px"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Screen 5: Slutför & Starta Bryggdag -->
    <section class="mobile-screen" id="mobile-screen-brew">
      <div class="mobile-screen-header">
        <h2>Slutför & Starta Bryggdag</h2>
      </div>

      <!-- BJCP Stilmatchningsrapport -->
      <div class="mobile-card-form">
        <p class="section-label">🎯 BJCP Stilmatchning</p>
        <div class="mobile-style-match-box" id="mobile-style-match-box" style="margin-bottom:0">
          <div class="mobile-style-match-title" id="mobile-style-match-name">Välj ölstil i flik 1</div>
          <div id="mobile-style-bars-container"></div>
        </div>
      </div>

      <!-- Anteckningar -->
      <div class="mobile-card-form">
        <p class="section-label">📝 Receptnoteringar & Logg</p>
        <div class="mobile-form-group">
          <textarea id="mobile-recipe-notes" rows="4" placeholder="Fritext om receptet, inspirationer, vattengivor, provsmakningsmål eller processanpassningar..."></textarea>
        </div>
      </div>

      <!-- Ready To Brew CTA -->
      <div class="mobile-ready-card">
        <div class="mobile-ready-header">
          <div class="mobile-ready-icon">🍺</div>
          <div class="mobile-ready-title">
            <h3>Receptet är klart!</h3>
            <p>Starta bryggdagsläget med aktiva humlelarm, timers och steg-för-steg-guidning.</p>
          </div>
        </div>
        <div class="mobile-ready-actions">
          <button class="mobile-btn-hero" id="mobile-btn-start-brewday">
            <span class="quick-icon">🍺</span> Starta Bryggdagsläget →
          </button>
          <div class="mobile-ready-subactions">
            <button class="btn btn-secondary btn-sm" id="mobile-btn-batches">
              <span class="quick-icon">📒</span> Mina bryggningar
            </button>
            <button class="btn btn-secondary btn-sm" id="mobile-btn-print-brewday">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Skriv ut
            </button>
            <button class="btn btn-ghost btn-sm" id="mobile-btn-scale-brewday">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 16l3-8 3 8a3 3 0 0 1-6 0zM2 16l3-8 3 8a3 3 0 0 1-6 0zM12 3v18M3 7h18"/></svg> Skala
            </button>
            <button class="btn btn-secondary btn-sm" id="mobile-btn-share-qr">
              <span class="quick-icon">📱</span> QR
            </button>
          </div>
        </div>
      </div>
    </section>

  </main>

  <!-- Mobile Bottom Navigation (App Bar) -->
  <nav class="mobile-bottom-nav">
    <button class="mobile-nav-btn active" data-screen="mobile-screen-recipe">
      <span class="nav-icon"><svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
      <span class="nav-label">Profil</span>
    </button>
    <button class="mobile-nav-btn" data-screen="mobile-screen-malt">
      <span class="nav-icon"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M2 22s8-4 12-10"/><path d="M10 14c-1-3 0-6 4-9 0 0 1 3-1 6"/><path d="M14 10c-1-3 0-6 4-9 0 0 1 3-1 6"/><path d="M7 17c-2-2-1-5 2-7 0 0 2 2 0 5"/><path d="M11 13c-2-2-1-5 2-7 0 0 2 2 0 5"/></svg></span>
      <span class="nav-label">Malt & Mäsk</span>
    </button>
    <button class="mobile-nav-btn" data-screen="mobile-screen-hops">
      <span class="nav-icon"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2v3"/><path d="M12 5c-3 1-5 3.5-5 7 0 4.5 3.5 8 5 10 1.5-2 5-5.5 5-10 0-3.5-2-6-5-7z"/><path d="M12 7c-2 2-2 5 0 7"/><path d="M12 7c2 2 2 5 0 7"/><path d="M8.5 10c1 1.5 3 2 3.5 2"/><path d="M15.5 10c-1 1.5-3 2-3.5 2"/></svg></span>
      <span class="nav-label">Humle</span>
    </button>
    <button class="mobile-nav-btn" data-screen="mobile-screen-yeast">
      <span class="nav-icon">🧫</span>
      <span class="nav-label">Jäst & Vatten</span>
    </button>
    <button class="mobile-nav-btn" data-screen="mobile-screen-brew">
      <span class="nav-icon">🍺</span>
      <span class="nav-label">Bryggdag</span>
    </button>
  </nav>
`;
}

/**
 * Mounts the mobile layout into #mobile-app-view if empty.
 */
export function mountMobileAppView() {
  const container = document.getElementById('mobile-app-view');
  if (container && !container.hasChildNodes()) {
    container.innerHTML = getMobileAppTemplate();
    // Hook up empty state buttons
    document.getElementById('mobile-btn-empty-add-malt')?.addEventListener('click', () => {
      document.getElementById('mobile-btn-add-fermentable')?.click();
    });
    document.getElementById('mobile-btn-empty-add-hop')?.addEventListener('click', () => {
      document.getElementById('mobile-btn-add-hop')?.click();
    });
  }
}
