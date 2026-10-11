/**
 * Modular Modals HTML Template.
 * Extracted from index.html to decouple overlays from the main document flow.
 */

export function getModalsHtml() {
  return `
<!-- Modal: Välj malt -->
<div class="modal-overlay hidden" id="modal-fermentable">
  <div class="modal">
    <div class="modal-header">
      <h3 class="modal-title">Välj malt eller råvara</h3>
      <button class="modal-close" data-close="modal-fermentable">✕</button>
    </div>
    <div class="modal-search">
      <input type="text" id="fermentable-search" placeholder="Sök malt, mälteri eller egenskap...">
    </div>
    <div class="modal-list" id="fermentable-list"></div>
  </div>
</div>

<!-- Modal: Välj humle -->
<div class="modal-overlay hidden" id="modal-hop">
  <div class="modal">
    <div class="modal-header">
      <h3 class="modal-title">Välj humle</h3>
      <button class="modal-close" data-close="modal-hop">✕</button>
    </div>
    <div class="modal-search">
      <input type="text" id="hop-search" placeholder="Sök humlesort, karaktär eller ursprung...">
    </div>
    <div class="modal-list" id="hop-list"></div>
  </div>
</div>

<!-- Modal: Sparade recept -->
<div class="modal-overlay hidden" id="modal-recipes">
  <div class="modal">
    <div class="modal-header">
      <h3 class="modal-title"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Sparade recept</h3>
      <button class="modal-close" data-close="modal-recipes">✕</button>
    </div>
    <div class="modal-list" id="recipes-list"></div>
    <div id="no-recipes-msg" class="empty-state" style="display:none">
      <div class="empty-icon"><svg class="svg-icon svg-icon-xl" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
      <p>Inga sparade recept hittades.<br>Spara ett recept för att se det här.</p>
    </div>
  </div>
</div>

<!-- Modal: Exempelrecept (Mallar) -->
<div class="modal-overlay hidden" id="modal-preset-recipes">
  <div class="modal" style="max-width:600px">
    <div class="modal-header">
      <h3 class="modal-title"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 3v3m0 12v3M3 12h3m12 0h3m-3.5-6.5l-2 2m-7 7l-2 2m0-11l2 2m7 7l2 2"/></svg> Exempelrecept (Receptmallar)</h3>
      <button class="modal-close" data-close="modal-preset-recipes">✕</button>
    </div>
    <div class="modal-body" style="padding:16px 0">
      <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:16px">
        Välj ett beprövat exempelrecept som utgångspunkt. Du kan därefter fritt anpassa alla malter, humlegivor och mäsksteg efter din egen utrustning!
      </p>
      <div class="preset-recipes-grid" id="preset-recipes-list"></div>
    </div>
  </div>
</div>

<!-- Modal: Skala recept -->
<div class="modal-overlay hidden" id="modal-scale-recipe">
  <div class="modal" style="max-width:440px">
    <div class="modal-header">
      <h3 class="modal-title"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 16l3-8 3 8a3 3 0 0 1-6 0zM2 16l3-8 3 8a3 3 0 0 1-6 0zM12 3v18M3 7h18"/></svg> Skala recept</h3>
      <button class="modal-close" data-close="modal-scale-recipe">✕</button>
    </div>
    <div style="padding:16px 0">
      <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:16px">
        Alla malter (kg) och humletillsatser (g) skalas proportionerligt baserat på din nya batchvolym och effektivitet.
      </p>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label" for="scale-target-volume">Mål Batchvolym (L)</label>
        <div class="input-group">
          <input type="number" id="scale-target-volume" value="20" min="1" step="0.5">
          <span class="input-addon">L</span>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label" for="scale-target-efficiency">Mål Bryggeffektivitet (%)</label>
        <div class="input-group">
          <input type="number" id="scale-target-efficiency" value="75" min="10" max="100" step="1">
          <span class="input-addon">%</span>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px">
        <button class="btn btn-ghost" data-close="modal-scale-recipe">Avbryt</button>
        <button class="btn btn-primary" id="btn-confirm-scale">Skala receptets råvaror</button>
      </div>
    </div>
  </div>
</div>

<!-- Modal: Brygguide -->
<div class="modal-overlay hidden" id="modal-swe-info">
  <div class="modal" style="max-width:680px">
    <div class="modal-header">
      <h3 class="modal-title"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Brygguide – Utrustning, Råvaror & Butiker</h3>
      <button class="modal-close" data-close="modal-swe-info">✕</button>
    </div>
    <div class="modal-body" style="padding:16px 0; font-size:0.88rem; line-height:1.6; color:var(--text-secondary)">
      <div style="background:var(--bg-card-hover); border-radius:8px; padding:14px; margin-bottom:16px; border-left:4px solid var(--accent)">
        <h4 style="color:var(--text-primary); margin-bottom:6px; font-family:var(--font-heading)">🛠️ Vanlig Utrustning & Bryggverk</h4>
        <ul style="margin:0; padding-left:18px">
          <li><strong>Elbryggverk / All-In-One:</strong> Grainfather (G30, G40), Brewtools (B40pro, B80pro), BrewZilla Gen 4, Brew Monk & Coobra. Inbyggt element, mäskkorg och cirkulationspump.</li>
          <li><strong>BIAB (Brew In A Bag):</strong> Enkel mäskning direkt i spisgryta med mäskpåse. Mycket populärt och kräver lite utrustning.</li>
          <li><strong>Tre-kärl & Kylväskor:</strong> Igloo-kylväska med falskbotten eller nätingslang som mäskkärl + lakvattenvärmare. Klassisk hembryggarmetod.</li>
          <li><strong>Fermentering:</strong> Plastjäshink 30L, FermZilla / FermTank (tryckjäsning & kegging) eller stålfermentor.</li>
        </ul>
      </div>
      <div style="background:var(--bg-card-hover); border-radius:8px; padding:14px; margin-bottom:16px; border-left:4px solid #3b82f6">
        <h4 style="color:var(--text-primary); margin-bottom:6px; font-family:var(--font-heading)">🌾 Maltsorter & Mälterier i Butik</h4>
        <p style="margin-bottom:8px">
          <strong>Populära Mälterier:</strong> Weyermann (Tyskland), Castle Malting (Belgien), Crisp & Simpson (UK) samt Viking Malt (Sverige/Finland).
        </p>
        <p style="margin:0">
          <strong>Bas vs Specialmalt:</strong> Basmalt (Pilsner, Pale Ale, Maris Otter, Vienna, Munich) ger förjäsbara sockerarter. Karamellmalt (CaraPils, Crystal 60, Caramunchen, Special B) ger fyllighet och sötma. Rostad malt (Chokladmalt, Carafa I/III, Roasted Barley) ger färg och kaffetoner.
        </p>
      </div>
      <div style="background:var(--bg-card-hover); border-radius:8px; padding:14px; margin-bottom:16px; border-left:4px solid #10b981">
        <h4 style="color:var(--text-primary); margin-bottom:6px; font-family:var(--font-heading)">🌿 Humle & Jäst – Från Klassiskt till Modern Kveik</h4>
        <p style="margin-bottom:8px">
          <strong>Populära Humlesorter:</strong> Citra, Mosaic, Simcoe & Cascade för fruktdrivna IPAs; Saaz, Hallertau & Perle för lager; East Kent Goldings & Fuggles för engelsk ale.
        </p>
        <p style="margin:0">
          <strong>Jäst & Kveik:</strong> SafAle US-05, S-04 och Verdant IPA är standard för ales. W-34/70 & Novalager för lager. Kveik-jäst (Voss, Lutra, Hornindal) möjliggör snabb jäsning vid 25–40°C utan diacetyl – perfekt vid jäsning i rumstemperatur!
        </p>
      </div>
      <div style="background:var(--bg-card-hover); border-radius:8px; padding:14px; border-left:4px solid #f59e0b">
        <h4 style="color:var(--text-primary); margin-bottom:6px; font-family:var(--font-heading)">🛒 Butiker & SHBF</h4>
        <p style="margin:0">
          Handla råvaror och utrustning hos <strong>Maltmagnus</strong> (maltmagnus.se), <strong>Humlegårdens Ekolager / Mr. Malt</strong> (humle.se), <strong>PGW</strong> (pgw.se), <strong>Ölkompaniet</strong> och <strong>Lilla Köksbryggeriet</strong>. Se även <strong>shbf.se</strong> för Öltypsdefinitioner och hembryggarforum.
        </p>
      </div>
    </div>
  </div>
</div>

<!-- Modal: Bryggverktyg -->
<div class="modal-overlay hidden" id="modal-tools">
  <div class="modal" style="max-width:640px">
    <div class="modal-header">
      <h3 class="modal-title">🧰 Bryggverktyg</h3>
      <button class="modal-close" data-close="modal-tools">✕</button>
    </div>
    <div class="tools-tabs" id="tools-tabs" role="tablist">
      <button class="tools-tab active" data-tool="carb" role="tab">Kolsyra</button>
      <button class="tools-tab" data-tool="refrac" role="tab">Refraktometer</button>
      <button class="tools-tab" data-tool="hydro" role="tab">Hydrometer</button>
      <button class="tools-tab" data-tool="yeast" role="tab">Jäst</button>
      <button class="tools-tab" data-tool="strike" role="tab">Inmäskning</button>
      <button class="tools-tab" data-tool="tilt" role="tab">🧲 Tilt</button>
    </div>
    <div class="modal-body" id="tools-body" style="padding:12px 0"></div>
  </div>
</div>

<!-- Modal: Dela recept & QR-kod -->
<div class="modal-overlay hidden" id="modal-share-qr">
  <div class="modal" style="max-width:480px; text-align:center;">
    <div class="modal-header">
      <h3 class="modal-title">📱 Öppna eller dela i mobilen</h3>
      <button class="modal-close" data-close="modal-share-qr">✕</button>
    </div>
    <div class="modal-body" style="padding:16px 8px;">
      <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:14px;">
        Skanna QR-koden med mobilens kamera för att flytta över receptet direkt till garaget eller bryggrummet – helt serverlöst utan konto!
      </p>

      <div style="display:flex; justify-content:center; gap:12px; margin-bottom:14px;">
        <label style="font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <input type="radio" name="share-target-mode" value="brew" id="share-mode-brew" checked>
          <span>🍺 Starta i Bryggdagsläget</span>
        </label>
        <label style="font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <input type="radio" name="share-target-mode" value="recipe" id="share-mode-recipe">
          <span>📝 Öppna Receptet</span>
        </label>
      </div>

      <div id="share-qr-container" style="background:#ffffff; padding:16px; border-radius:12px; display:inline-flex; justify-content:center; align-items:center; box-shadow:0 4px 16px rgba(0,0,0,0.25); min-width:260px; min-height:260px; margin:0 auto 16px;">
        <span style="color:#666; font-size:0.85rem;">Genererar QR-kod...</span>
      </div>

      <div class="form-group" style="margin-top:8px;">
        <label class="form-label" for="share-url-input" style="text-align:left;">Direktlänk med komprimerat recept:</label>
        <div class="input-group">
          <input type="text" id="share-url-input" readonly style="font-size:0.8rem; background:var(--bg-card); cursor:text;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-share-url" style="white-space:nowrap;">📋 Kopiera</button>
        </div>
      </div>
    </div>
  </div>
</div>
`;
}

/**
 * Injects modal dialog markup into the DOM if not already present.
 * @param {string} [containerId='modals-root']
 */
export function mountModals(containerId = 'modals-root') {
  const container = document.getElementById(containerId);
  if (container && !container.hasChildNodes()) {
    container.innerHTML = getModalsHtml();
  }
}
