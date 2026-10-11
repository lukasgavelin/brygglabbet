# 🏛️ Teknisk Dokumentation & Systemarkitektur – Brygglabbet

Denna dokumentation beskriver den tekniska arkitekturen, datamodellerna, beräkningsmotorerna och UI-flödena i **Brygglabbet**.

---

## 1. Systemöversikt & Designprinciper

Brygglabbet är byggt som en modern, snabb Single Page Application (SPA) utan externa tunga ramverk (React/Vue/Angular), vilket ger omedelbar laddningstid, minimal bundle-storlek och noll runtime overhead.

### Kärnprinciper:
- **Zero-Framework Vanilla ES Modules**: Ren JavaScript (ES2022+) strukturerad i moduler med strikt ansvarsfördelning.
- **Single Source of Truth (`State`)**: All applikationsdata lagras och hanteras centralt i `src/state.js`.
- **Rena Beräkningsfunktioner (`src/core/calculations.js`)**: Deterministiska, biverkningsfria funktioner för alla bryggformler, täckta av automatiserade enhetstester.
- **Dubbelriktad standardisering & Profilskydd**: Inbyggt stöd för både modern JSON-receptlagring och industristandarden **BeerXML 1.0**, där befintliga utrustnings- och vattenprofiler bevaras intakta vid import av ofullständiga filer.
- **Web APIs & Hårdvaruintegration**:
  - **Screen Wake Lock API (`src/core/wakelock.js`)**: Håller skärmen tänd under bryggning och timers.
  - **Web Bluetooth Scanning API (`src/core/tiltBluetooth.js`)**: Passiv Bluetooth LE iBeacon-skanning av digitala Tilt-hydrometrar för realtidsgravitet (SG/°P), temperatur och signalstyrka (RSSI) med inbyggd simulator för alla webbläsare.
  - **Web Audio API & Notification API**: Syntetiserade harmoniska larmsignaler kombinerat med OS-systemnotiser.
  - **Navigator Vibration API**: Haptisk feedback på mobila enheter.
  - **Web Storage API (`safeStorage`)**: Kvantitets- och kvotskyddad persistens med persistent autosave.
  - **Vite PWA & Workbox Precaching**: Automatisk precaching av alla hashade JS/CSS-bundles för 100 % driftsäkerhet i källare och garage utan nätverk.
  - **`@media print`**: Optimerad utskriftslayout för fysiska bryggprotokoll.

---

## 2. Katalog- och Modulstruktur

```
brygglabbet/
├── index.html                   # Huvud-HTML med desktop- och mobilcontainrar samt modaler
├── style.css                    # Amber/Gold Design System, CSS variabler och responsivitet
├── vite.config.js               # Vite bundler, VitePWA precaching & Vitest-konfiguration
├── package.json                 # Skript och beroenden (Vite, VitePWA, Vitest, Prettier, ESLint)
├── public/                      # Statiska tillgångar & Cloudflare Pages konfiguration
│   ├── _redirects               # SPA fallback routing
│   ├── _headers                 # Caching och säkerhetspolicies
│   ├── favicon.svg              # Appikon i vektorformat
│   └── manifest.webmanifest     # PWA manifestdeklaration
├── docs/
│   ├── ARCHITECTURE.md          # Detaljerad teknisk arkitektur- och formeldokumentation
│   └── RADDNINGSPAKET.md        # Detaljerat räddningspaket och premortem-reparationsplan
├── src/
│   ├── main.js                  # Applikationens bootstrap, händelselyssnare och genvägar
│   ├── state.js                 # Central state manager, historikstack (Undo/Redo), batch sync & baseState
│   ├── types.js                 # JSDoc typdefinitioner för recept, ingredienser och utrustning
│   ├── constants.js             # Formelmultiplikatorer, enhetsomvandlingar och standardvärden
│   ├── core/
│   │   ├── calculations.js      # computeRecipeMetrics & rena beräkningsmotorer (inkl. vatten/saltskalning)
│   │   ├── brewtools.js         # Verktygsberäkningar (kolsyra, refraktometer, hydrometer, jäst, strike, syra)
│   │   ├── batches.js           # Batch-CRUD, jässchema, tidslinje & .ics-export
│   │   ├── beerxml.js           # BeerXML 1.0 parser och serializer med kolsyra & givmetadata
│   │   ├── recipeSharing.js     # Serverlös QR- och hash-komprimering (lz-string) & SVG QR-rendering
│   │   ├── tiltBluetooth.js     # Tilt Hydrometer Web Bluetooth LE scanning, iBeacon-tolk & fysiksimulator
│   │   ├── wakelock.js          # Screen Wake Lock API manager med visibilitychange-stöd
│   │   ├── storage.js           # safeStorage & safeSessionStorage med QuotaExceeded-skydd
│   │   ├── data.js              # Databas-exporteringshubb
│   │   └── data/                # Statiska databaser för ingredienser och profiler
│   │       ├── malts.js         # 40+ malter och sockerarter med EBC och potentiellt utbyte
│   │       ├── hops.js          # 45+ humlesorter med alfasyrariktlinjer
│   │       ├── yeasts.js        # 26 jäststammar med förjäsningsgrad och tempintervall
│   │       ├── styles.js        # 32 BJCP 2021 ölstilar med gränsvärden
│   │       ├── equipment.js     # Utrustningsförinställningar (Grainfather, Brewtools m.fl.)
│   │       ├── water.js         # Vattenprofiler (Stockholm, Göteborg, Pilsen, München m.fl.)
│   │       ├── mash.js          # Standardmässcheman (Enkelsteg, Multi-steg, Dekoktion)
│   │       └── preset-recipes.js# Kompletta exempelreceptmallar
│   └── ui/
│       ├── batches.js           # Mina bryggningar (historik, tidslinje, logg, flaskning & betyg)
│       ├── tiltController.js    # Tilt IoT panel controller, live DOM-rendering & sessionsbevarande
│       ├── brewday.js           # Interaktivt bryggdagsläge, monoton timestamp-timer, Wake Lock & humlelarm
│       ├── shareQr.js           # Serverlös QR-delningsdialog, URL-kopiering & startup-hashavlyssnare
│       ├── tools.js             # Bryggverktygspanel (kolsyra, refraktometer, hydrometer, jäst, strike, tilt)
│       ├── equipment.js         # Utrustningsprofilsvy & förlustparametrar
│       ├── fermentables.js      # Maltlista, tillsätt/ta bort, färgbidrag
│       ├── hops.js              # Humleschema, whirlpool-temp & torrhumling
│       ├── yeast.js             # Jästval, dämpningsintervall & jässchemaprofil
│       ├── mash.js              # Mäskstegsredigerare & mäskschemaväljare
│       ├── water.js             # Vattenprofilsjustering, salttillsatser, mäsk-pH & syra
│       ├── recipes.js           # Receptsparning, full workspace backup, persistent autosave & import/export
│       ├── sidebar.js           # Desktop-sidopanel med live-beräkningar och EBC-platta
│       ├── styleMatch.js        # BJCP stilmatchningsgrafer och toleransindikatorer
│       ├── print.js             # Utskriftsgenerator för bryggprotokoll
│       ├── tabs.js              # Flik- & dragspelsnavigation, quick-nav scrollspy & badges
│       ├── modals.js            # Modaldialoghantering med sök- och filtreringsstöd
│       ├── syncBridge.js        # Unifierad tvåvägssynk & händelsedelegation mellan desktop och mobil
│       ├── stepper.js           # Touch-vänliga inkrement/dekrement-knappar
│       ├── toast.js             # Animerade toast-notifikationer
│       ├── icons.js             # SVG-ikonsamling
│       ├── errorBoundary.js     # Global crash recovery & error boundary
│       ├── templates/           # Utbrutna HTML-templates (minskar index.html från 1500+ till ~900 rader)
│       │   └── modalsTemplate.js# Modulära modaldialoger (8 modaler inkl. QR-delning)
│       └── mobile/              # Parallellt mobiloptimerat gränssnitt med full paritet
│           ├── mobileApp.js     # Mobilvy-initiering & skärmorkestrering
│           ├── mobileNav.js     # Mobil bottenmeny, header-synk & horisontella swipe-gester
│           ├── mobileCards.js   # Mobilanpassade ingredienskort med in-place DOM-uppdatering
│           ├── mobileStepper.js # Kontinuerlig auto-repeat och acceleration för mobil-stepprar
│           └── mobileTemplate.js# Modulärt mobil-layouttemplate (Header, Sticky Bar, 5 Skärmar, App Bar)
└── tests/
    ├── calculations.test.js     # Tester för alla bryggformler och kemiberäkningar
    ├── brewtools.test.js        # Tester för verktygskalkyler och syraformler
    ├── batches.test.js          # Tester för batcher, scheman och .ics-export
    ├── tilt-bluetooth.test.js   # Tester för Tilt Web Bluetooth, iBeacon-avkodning, simulator & UI
    ├── data.test.js             # Integritetstest för unika ID:n och fält i databaserna
    ├── beerxml.test.js          # Tester för BeerXML-import och export
    ├── mash.test.js             # Tester för mäskvatten och tidsberäkningar
    ├── recipes.test.js          # Tester för receptmallar och validering
    ├── state.test.js            # Tester för state-uppdateringar och historikstack
    ├── integration.test.js      # Integrationsflödestester för receptberäkning
    ├── storage-resilience.test.js # Tester för persistens, kvotskydd och PWA-filer
    ├── rescue-fixes.test.js     # Tester för vatten/saltskalning, BeerXML-skydd, Wake Lock & full backup
    ├── architecture-modularization.test.js # Tester för index.html modularisering och desktop-mobil synk
    ├── recipe-sharing.test.js   # Tester för serverlös receptdelning, URL-hash & offline QR-kod
    ├── mobile-optimization.test.js # Tester för touch-gestik, swipe-navigering, in-place rendering & safe-area
    └── ui-smoke.test.js         # Rök- och integrationsfälttester (desktop + mobil)
```

---

## 3. Data- och Tillståndsmodell (`State`)

Applikationens tillstånd modelleras som ett centralt reaktivt JavaScript-objekt:

```javascript
const State = {
  recipe: {
    name: "Kust-IPA",
    styleId: "21A",
    batchVolume: 20,       // Liter vört i jäskärlet
    boilVolume: 25.5,      // Beräknad pre-boil volym (L)
    boilTime: 60,          // Total koktid (min)
    efficiency: 75,        // Mäskeffektivitet (%)
    notes: "",             // Receptanteckningar
    carbonationVols: 2.5,  // Önskad kolsyrenivå (volymer CO2)
    fermentation: { profile: "auto", coldCrash: false, customStages: [] }
  },
  fermentables: [
    { id: 1, name: "Pilsnermalt", amount: 4.5, yield: 80, ebc: 3.5, type: "base" }
  ],
  hops: [
    { id: 1, name: "Citra", amount: 30, alpha: 12.5, time: 15, use: "kok", form: "pellets" }
  ],
  yeast: {
    name: "SafAle US-05", lab: "Fermentis", type: "ale", attMin: 78, attMax: 82, tempMin: 18, tempMax: 28, notes: ""
  },
  mash: [
    { id: 1, name: "Försockring", temp: 66, time: 60, type: "Infusion" }
  ],
  water: {
    volume: 25,
    base: { name: "Stockholm", ca: 30, mg: 4, na: 10, cl: 15, so4: 35, hco3: 70 },
    salts: { gypsum: 4.2, calciumChloride: 1.5, epsomSalt: 2.0, tableSalt: 0, bakingSoda: 0, chalk: 0 },
    acid: { enabled: false, targetPH: 5.4, type: "lactic", strength: 80, treatSparge: true }
  },
  equipment: {
    id: "custom_30l",
    name: "Standard Gryta 30L",
    batchVolume: 20,
    efficiency: 75,
    boilOffRate: 3.0,      // L/h
    kettleLoss: 2.0,       // L
    fermenterLoss: 1.0,    // L
    grainAbsorption: 0.96, // L/kg krossad malt
    mashRatio: 3.0,        // L/kg malt
    grainTemp: 18          // °C
  }
};
```

### Profilbevarande Normalisering (`normalizeState(raw, baseState)`)
När partiell data laddas (såsom BeerXML som saknar utrustning eller vattenprofiler) skickar `applyState(targetState, newState)` in befintligt `targetState` som `baseState`. Detta garanterar att användarens anpassade utrustningsprofiler och vattenkemi aldrig skrivs över av standardvärden.

### Persistent Autosave & Full Workspace Backup
1. **Autosave**: Sparas löpande till `safeStorage` (nyckel: `brygglabbet_autosave`). Påbörjade recept överlever om fliken stängs, webbläsaren kraschar eller datorn startas om, och kan återställas inom 24 timmar.
2. **Fullständig Säkerhetskopia (`exportFullWorkspaceBackup`)**: Serialiserar hela databasen till en samlad JSON-fil med schemat:
   ```json
   {
     "_format": "brygglabbet_full_backup",
     "_version": 2,
     "createdAt": "2026-10-10T12:00:00.000Z",
     "currentRecipe": { ... },
     "recipes": { "Recept 1": { ... }, "Recept 2": { ... } },
     "batches": [ ... ]
   }
   ```
   Vid import identifieras formatet automatiskt och alla recept och batcher slås ihop i webbläsarens lagring.

---

## 4. Beräkningsmodeller & Algoritmer

Samtliga matematiska modeller i `src/core/calculations.js` och `src/core/brewtools.js` är standardiserade och testade:

### 4.0 Gemensam Beräkningspipeline (`computeRecipeMetrics`)
För att garantera 100 % paritet mellan samtliga vyer (desktop-editor, mobilläge, bryggdag, batchhistorik och utskriftsprotokoll) körs alla receptberäkningar genom en samlad, ren pipeline: `computeRecipeMetrics(State)`. Den returnerar ett enhetligt `metrics`-objekt med `og`, `fg`, `abv`, `ibu`, `ibuPerHop`, `ebc`, `ebcPerFermentable`, `volumes`, `mashPH`, `waterRequirements` m.m.

### 4.1 Stammvörtstyrka (OG) & Slutgravitet (FG)
- **Gravitetsenheter (GU)**:
  $$\text{GU}_{\text{malt}} = \text{Vikt (kg)} \times (\text{Potential} - 1.000) \times 1000 \times 8.3454 \times \frac{\text{Effektivitet}}{100}$$
  $$\text{OG (SG)} = 1.000 + \frac{\sum \text{GU}}{\text{Batchvolym (L)} \times 0.264172}$$
- **°Plato**:
  $$^\circ\text{P} = (-1 \times 616.868) + (1111.14 \times \text{SG}) - (630.272 \times \text{SG}^2) + (135.997 \times \text{SG}^3)$$
- **FG**: Beräknas utifrån OG och jästens genomsnittliga förjäsningsgrad:
  $$\text{FG} = 1.000 + \frac{(\text{OG} - 1.000) \times (1 - \text{Attenuation})}{1}$$
- **Alkoholhalt (ABV)**:
  $$\text{ABV} = (\text{OG} - \text{FG}) \times 131.25$$

### 4.2 Bitterhet (Tinseth med kokgravitet & Malowicki-whirlpool)
- **Kokgravitet ($\text{SG}_{\text{boil}}$)**:
  Tinseths bitytnyttjande beräknas mot vörtens densitet under koket snarare än slut-OG:
  $$U(t, \text{SG}_{\text{boil}}) = \left(1.65 \times 0.000125^{(\text{SG}_{\text{boil}} - 1)}\right) \times \left(\frac{1 - e^{-0.04 \times t}}{4.15}\right)$$
  - *Pelletjustering*: $+10\%$ utbyte jämfört med hela kottar.
  - *Whirlpool / Hop Stand*: Temperaturberoende isomeriseringsfaktor enligt Malowicki & Shellhammer (2005):
    $$\text{tempFactor}(T) = \frac{k(T)}{k(100^\circ\text{C})}$$
    vilket motsvarar ca $50\%$ utbyte vid $85^\circ\text{C}$ och minimal isomerisering under $70^\circ\text{C}$.
- **IBU per giva**:
  $$\text{IBU} = \frac{\text{Mängd (g)} \times (\text{Alfasyra } \% / 100) \times U \times \text{tempFactor} \times 1000}{\text{Batchvolym (L)}}$$

### 4.3 Färg (EBC via Dan Morey)
- **Malt Color Units (MCU)**:
  $$\text{MCU} = \frac{\sum (\text{Vikt (kg)} \times 2.20462 \times \text{SRM}_{\text{malt}})}{\text{Batchvolym (Gallons)}}$$
- **SRM & EBC**:
  $$\text{SRM} = 1.4922 \times \text{MCU}^{0.6859}, \quad \text{EBC} = \text{SRM} \times 1.97$$

### 4.4 Vatten- och Volymberäkningar
- **Pre-boil Kokvolym**:
  $$V_{\text{boil}} = V_{\text{batch}} + (\text{BoilOffRate} \times \frac{\text{BoilTime}}{60}) + \text{KettleLoss} + \text{FermenterLoss}$$
- **Mäskvattenvolym**:
  $$V_{\text{mash}} = M_{\text{malt}} \times \text{Mäskkvot}$$
- **Totalt Vattenbehov**:
  $$V_{\text{total}} = V_{\text{boil}} + (M_{\text{malt}} \times \text{GrainAbsorption})$$
- **Lakvattenvolym**:
  $$V_{\text{sparge}} = V_{\text{total}} - V_{\text{mash}}$$

### 4.5 Vattenkemi, Mäsk-pH & Syra (`calculations.js` & `brewtools.js`)
- **Jonbidrag (ppm / mg/L)**: Beräknas utifrån molekylvikter för $\text{CaSO}_4$, $\text{CaCl}_2$, $\text{MgSO}_4$, $\text{NaCl}$, $\text{NaHCO}_3$ och $\text{CaCO}_3$ per behandlad vattenvolym (`water.volume`).
- **Residualalkalinitet (RA)**:
  $$\text{RA} = \text{Alkalinitet} - \left(\frac{\text{Ca}^{2+}}{3.5}\right) - \left(\frac{\text{Mg}^{2+}}{7}\right)$$
- **Mäsk-pH**: Beräknas via laddningsbalans per malttyp (basmalt, karamellmalt, mörkrostat och syramalt) kombinerat med vattnets residualalkalinitet.
- **Syradosering (`acidAddition` & `spargeAcid`)**: Exakt invers beräkning av milliekvivalenter syra som krävs för att nå mål-pH, med stöd för 80%/88% mjölksyra och 10%/75% fosforsyra samt surmaltsekvivalent.

### 4.6 Receptskalning (`scaleRecipe`)
Skalar om receptet vid byte av batchstorlek eller effektivitet:
- **Malt**: $\text{Mängd} \times \text{volRatio} \times \text{effRatio}$ (socker undantas från effektivitetsjustering).
- **Humle**: $\text{Mängd} \times \text{volRatio}$.
- **Vatten & Salter**: Behandlad vattenvolym, kokvolym och samtliga bryggsalter skalas proportionellt mot $\text{volRatio}$, vilket bevarar jonprofiler och beräknat mäsk-pH.

---

## 5. BeerXML 1.0 Standardisering (`src/core/beerxml.js`)

Brygglabbet stöder fullständig tvåvägskonvertering till **BeerXML 1.0**:
- **Export**: Serialiserar `State` till ett standardkompatibelt `<RECIPES><RECIPE>...</RECIPE></RECIPES>`-XML-dokument.
- **Import**: Parsar BeerXML via `DOMParser`, konverterar alla imperiala enheter (gal, lb, oz) till metriska standarder (L, kg, g) och läser in malter, humlegivor, jäst, mäskscheman och receptnoteringar.
- **Profilskydd**: Om en importerad fil saknar utrustning eller vattenkemi skrivs inte användarens befintliga inställningar över.

---

## 6. Bryggdagsläge & Ljud/Vibrationsarkitektur (`src/ui/brewday.js`)

Bryggdagsläget är utformat som en interaktiv steg-för-steg-guide (Wizard) med:

1. **Screen Wake Lock API (`src/core/wakelock.js`)**:
   - Begär automatiskt skärmlås via `navigator.wakeLock.request('screen')` när bryggläget öppnas eller en timer startas.
   - Återansluter automatiskt vid appväxling via `visibilitychange`.
2. **Monoton Timestamp-timer**:
   - Beräknar återstående tid mot en absolut måltid: `Math.max(0, Math.ceil((timerTargetTimestampMs - Date.now()) / 1000))`.
   - Motverkar tidsavdrift och fördröjningar när mobilen vilar eller webbläsaren körs i bakgrunden.
3. **Tröskelstyrda Humlelarm & Systemnotiser**:
   - Kontrollerar under nedräkning om återstående sekunder passerat humlegivans tidpunkt (`<= targetSecs`).
   - Aviserar med Web Audio-larmsignal ($880\,\text{Hz} \to 1760\,\text{Hz}$), haptisk vibration (`navigator.vibrate`), visuell markering (`.hop-alert-active`) samt **systemnotiser** (`Notification API`).
4. **Automatisk Stegkvittering**:
   - När mäsk- eller koktimers når `00:00` bockas momentets checkbox automatiskt och knappen `Nästa steg ➡️` pulserar (`.btn-pulse-next`).
5. **Bryggloggning & Effektivitetsåterkoppling**:
   - Låter bryggaren logga uppmätt förkoksgravitet, faktiskt OG, volym i jäskärl och mäsk-pH, och uppdatera profilens effektivitet med ett klick.

---

## 7. PWA, Offline & Byggarkitektur

Projektet använder **Vite** med **vite-plugin-pwa** (Workbox):

```javascript
// vite.config.js
VitePWA({
  registerType: 'autoUpdate',
  injectRegister: false,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
    cleanupOutdatedCaches: true,
    navigateFallback: 'index.html',
  },
})
```

- **Garanterad Källar-Offline**: Alla genererade JavaScript- och CSS-chunks precachas med Workbox hashes.
- **Stale-While-Revalidate & Network-First**: Navigationsanrop routas till den cachade `index.html` vid nätverksbortfall.

---

## 8. Serverlös QR-synk & URL-hash (Sprint 3)

För att flytta recept från en dator i kontoret till en mobil i brygghörnan utan krav på inloggning, användarkonton eller externa servrar implementerar Brygglabbet en helt serverlös URL- och QR-synk:

```
[Dator / Receptredigerare]
       │
       ▼
serializeRecipePayload(state)  ──>  Kompakterar schemat (r, f, h, y, m, w, e)
       │
       ▼
LZString.compressToEncodedURIComponent()  ──>  URL-säker sträng (~350–1000 tecken)
       │
       ▼
qrcode.toString(url, { type: 'svg' })  ──>  Lokal, skarp vektor-SVG (100% offline)
       │
       ▼
[Mobilkameraskanning av QR-koden]
       │
       ▼
https://brygglabbet.se/#brew=<payload> (eller #recipe=)
       │
       ▼
handleIncomingShareHash() på mobilen
       ├─ Avkodar & dekomprimerar med LZString
       ├─ Validerar & normaliserar med normalizeState()
       ├─ Återställer State och anropar syncUIFromState() + recalculate()
       ├─ Vid #brew=: Växlar automatiskt till Bryggdagsläget
       └─ history.replaceState(): Rensar URL-hashen så sidomladdning ej skriver över data
```

- **Säkerhet & Integritet**: Allt sker på klientsidan. Inga receptdata skickas någonsin till någon tredje part.
- **Robust felhantering**: Korrupta eller ofullständiga QR-koder fångas upp i `try/catch` och varnar användaren utan att krascha appen eller korrumpera befintligt recept i minnet.

---

## 9. Mobiloptimering & Touch-ergonomi

Mobilgränssnittet är arkitektoniskt frikopplat och specialanpassat för smidig enhandsanvändning vid bryggverket:

1. **Horisontell Swipe-navigering**:
   - Touch-gester på `#mobile-screen-container` känner av horisontella svep (`deltaX > 45px`, horisontellt dominant) och växlar mellan de 5 skärmarna (`Profil` ⇄ `Malt & Mäsk` ⇄ `Humle` ⇄ `Jäst & Vatten` ⇄ `Bryggdag`).
   - Mjuka glidande riktningsanimationer (`slide-in-right` / `slide-in-left`) och haptisk återkoppling via `navigator.vibrate(6)`.
2. **In-place DOM-uppdateringar (Zero DOM Thrashing)**:
   - `renderMobileFermentablesCards`, `renderMobileHopsCards` och `renderMobileMashSteps` identifierar om kortens ID-struktur är oförändrad och uppdaterar värden, beräknade bidrag och taggar direkt i befintliga DOM-noder.
   - Eliminerar onödig DOM-destruktion, bevarar inputfokus och ger stabil 60 FPS-prestanda på mobila enheter.
3. **Kontinuerlig Auto-repeat Stepprar (`mobileStepper.js`)**:
   - Alla `+` / `–` knappar på mobilen stöder att hållas nedtryckta: efter 320 ms inleds automatisk repetering i 95 ms-intervall som accelererar ned till 40 ms vid längre tryck.
   - Synkroniserad händelsehantering som stödjer både enstaka snabba klick, tangentbord, och långtryck utan dubbeltriggning.
4. **Safe-Area Insets & Kant-till-Kant PWA**:
   - `viewport-fit=cover` i `index.html` tillsammans med `env(safe-area-inset-top)` på headern och `env(safe-area-inset-bottom)` på bottenmenyn och modalerna eliminerar överlappning med iPhone-notch och Android-hemindikatorer.
   - Minsta touch-target på 44×44 px och `touch-action: manipulation` eliminerar 300 ms klickfördröjning.

---

## 10. IoT & Digitala Hydrometrar (Tilt Web Bluetooth & Simulator)

Brygglabbet inkluderar en helt serverlös klientintegration mot **Tilt Hydrometer** via Web Bluetooth API (`src/core/tiltBluetooth.js` och `src/ui/tiltController.js`):

### 10.1 iBeacon BLE-protokoll & Dataavkodning
Tilt sänder telemetri via Apples tillverkarspecifika iBeacon-paket (Company ID `0x004c`):
- **Byte 0–1**: iBeacon header (`0x02`, `0x15`).
- **Byte 2–17**: 16-byte UUID som identifierar Tilt-färgen:
  - `a495bb10c5b14b44b5121370f02d74de`: Röd
  - `a495bb20c5b14b44b5121370f02d74de`: Grön
  - `a495bb30c5b14b44b5121370f02d74de`: Svart
  - `a495bb40c5b14b44b5121370f02d74de`: Lila
  - `a495bb50c5b14b44b5121370f02d74de`: Orange
  - `a495bb60c5b14b44b5121370f02d74de`: Blå
  - `a495bb70c5b14b44b5121370f02d74de`: Gul
  - `a495bb80c5b14b44b5121370f02d74de`: Rosa
- **Byte 18–19**: Temperatur i Fahrenheit (big-endian `uint16`). Konverteras till Celsius med 1 decimals precision.
- **Byte 20–21**: Specifik gravitet multiplicerad med 1000 (big-endian `uint16`, t.ex. $1050 \rightarrow 1.050\text{ SG}$).
- **Byte 22**: Kalibrerad sändeffekt (TX Power vid 1 m) kombinerat med mätt RSSI i dBm för signalstyrkeklassificering (*Utmärkt*, *Bra*, *Godkänd*, *Svag*).

### 10.2 Inbyggd Fysiksimulator (`startTiltSimulation`)
Eftersom `navigator.bluetooth.requestLEScan` kräver Chromium-webbläsare med experimentell flagga (`chrome://flags/#enable-experimental-web-platform-features`), innehåller modulen en deterministisk och fysikalisk simulator. Den tillåter alla användare på valfri enhet (Safari, Firefox, Linux, iPhone) att testa live-telemetri med realistiskt brus och automatisk loggning.

### 10.3 UI Controller & Sessionsbevarande (`tiltController.js`)
- **Sömlös Batchintegration**: Integrerad i *Mina bryggningar* under Gravitetsmätningar samt som separat verktygsflik i *Bryggverktyg*.
- **Sessionsbevarande**: Aktiva skanningar eller simuleringar överlever fullständiga återrenderingar av batch-detaljvyn utan avbrott eller blinkningar (`activeSessions`-karta indexerad på panelprefix).
- **Auto-loggning**: Inbyggt stöd för schemalagd 15-minutersintervall-loggning till batchens gravitetshistorik med automatisk FG- och ABV-omräkning.

---

## 11. Testsvit & Kvalitetssäkring

Tester körs med **Vitest**:
```bash
npm test
```

### Testmoduler (181 tester i 16 testfiler):
1. `tests/calculations.test.js` – 28 tester för OG, FG, ABV, IBU (Tinseth & Malowicki), EBC (Morey), vattenkalkyler och kemi.
2. `tests/brewtools.test.js` – 45 tester för kolsyra (flaskor & fat), refraktometer (Terrill), hydrometer 20°C, pitch rate, strike-temp, infusion och syradosering.
3. `tests/batches.test.js` – 11 tester för batch-CRUD, jässcheman, tidslinjer, mätningar, flaskning, påminnelser och RFC 5545 .ics kalenderexport.
4. `tests/tilt-bluetooth.test.js` – 17 tester för Tilt iBeacon-avkodning, färg-UUID, temperatur- och SG-tolkning, RSSI-kvalitet, fysiksimulator, panelcontroller och sessionsbevarande.
5. `tests/data.test.js` – 10 tester för databasens integritet, unika ID:n och giltiga numeriska intervall.
6. `tests/beerxml.test.js` – 4 tester för import/export av BeerXML-recept med kolsyra och givmetadata.
7. `tests/mash.test.js` – 3 tester för mäskscheman och infusionsberäkningar.
8. `tests/recipes.test.js` – 2 tester för receptmallar och validering.
9. `tests/state.test.js` – 3 tester för state mutation, prenumerationer och historik.
10. `tests/integration.test.js` – 2 end-to-end integrationstester för kompletta receptflöden.
11. `tests/storage-resilience.test.js` – 13 tester för persistensresiliens, kvotskydd och PWA-filer.
12. `tests/rescue-fixes.test.js` – 4 tester för vatten/saltskalning, BeerXML-skydd, Wake Lock och full backup.
13. `tests/architecture-modularization.test.js` – 13 tester för index.html modularisering, dynamisk montering, selector-synk och event delegation.
14. `tests/recipe-sharing.test.js` – 8 tester för serverlös receptdelning, URL-hash, lz-string komprimering, offline QR-kod & startup-ingest.
15. `tests/mobile-optimization.test.js` – 9 tester för touch-gestik, swipe-navigering, in-place rendering, auto-repeat stepprar & safe-area.
16. `tests/ui-smoke.test.js` – 9 rök- och integrationsfälttester (desktop + mobil).

---

## 12. Bygg- & Produktionsprocess

```bash
# Installera beroenden
npm install

# Starta lokal utveckling med hot-module-reload
npm run dev

# Bygg produktionspaket till dist/ (inkl. PWA precaching)
npm run build

# Kör linter och formatering
npm run lint
```
