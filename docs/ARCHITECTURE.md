# 🏛️ Teknisk Dokumentation & Systemarkitektur – Brygglabbet

Denna dokumentation beskriver den tekniska arkitekturen, datamodellerna, beräkningsmotorerna och UI-flödena i **Brygglabbet**.

---

## 1. Systemöversikt & Designprinciper

Brygglabbet är byggt som en modern, snabb Single Page Application (SPA) utan externa tunga ramverk (React/Vue/Angular), vilket ger omedelbar laddningstid, minimal bundle-storlek och noll runtime overhead.

### Kärnprinciper:
- **Zero-Framework Vanilla ES Modules**: Ren JavaScript (ES2022+) strukturerad i moduler med strikt ansvarsfördelning.
- **Single Source of Truth (`State`)**: All applikationsdata lagras och hanteras centralt i `src/state.js`.
- **Rena Beräkningsfunktioner (`src/core/calculations.js`)**: Deterministiska, biverkningsfria funktioner för alla bryggformler, täckta av automatiserade enhetstester.
- **Dubbelriktad standardisering**: Inbyggt stöd för både modern JSON-receptlagring och industristandarden **BeerXML 1.0**.
- **Web APIs & Offline Capabilities**: Web Audio API för larmsignaler, Navigator Vibration API för haptik, Web Storage API (`localStorage`) för lokal persistens, och `@media print` för fysiska bryggprotokoll.

---

## 2. Katalog- och Modulstruktur

```
brygglabbet/
├── index.html                   # Huvud-HTML med desktop- och mobilcontainrar samt modaler
├── style.css                    # Amber/Gold Design System, CSS variabler och responsivitet
├── vite.config.js               # Vite- och Vitest-konfiguration
├── package.json                 # Skript och beroenden (Vite, Vitest, Prettier, ESLint)
├── public/                      # Statiska tillgångar & Cloudflare Pages konfiguration
│   ├── _redirects               # SPA fallback routing
│   └── _headers                 # Caching och säkerhetspolicies
├── src/
│   ├── main.js                  # Applikationens bootstrap, händelselyssnare och genvägar
│   ├── state.js                 # Central state manager, historikstack (Undo/Redo), batch sync
│   ├── types.js                 # JSDoc typdefinitioner för recept, ingredienser och utrustning
│   ├── constants.js             # Formelmultiplikatorer, enhetsomvandlingar och standardvärden
│   ├── core/
│   │   ├── calculations.js      # Rena beräkningsmotorer (OG, FG, ABV, IBU, EBC, Vatten, Kemi)
│   │   ├── beerxml.js           # BeerXML 1.0 parser och serializer
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
│       ├── brewday.js           # Interaktivt bryggdagsläge, aktiva humlelarm & timers
│       ├── equipment.js         # Utrustningsprofilsvy & förlustparametrar
│       ├── fermentables.js      # Maltlista, tillsätt/ta bort, färgbidrag
│       ├── hops.js              # Humleschema, användningsområden (kok, whirlpool, torrhumle)
│       ├── yeast.js             # Jästval, dämpningsintervall & temperaturkontroll
│       ├── mash.js              # Mäskstegsredigerare & mäskschemaväljare
│       ├── water.js             # Vattenprofilsjustering, salttillsatser, pH & RA
│       ├── recipes.js           # Receptsparning, import/export, receptskalning
│       ├── sidebar.js           # Desktop-sidopanel med live-beräkningar och EBC-platta
│       ├── styleMatch.js        # BJCP stilmatchningsgrafer och toleransindikatorer
│       ├── print.js             # Utskriftsgenerator för bryggprotokoll
│       ├── tabs.js              # Flik- & dragspelsnavigation, quick-nav scrollspy & badges
│       ├── modals.js            # Modaldialoghantering med sök- och filtreringsstöd
│       ├── stepper.js           # Touch-vänliga inkrement/dekrement-knappar
│       ├── toast.js             # Animerade toast-notifikationer
│       ├── icons.js             # SVG-ikonsamling
│       └── mobile/              # Parallellt mobiloptimerat gränssnitt
│           ├── mobileApp.js     # Mobilvy-initiering & skärmorkestrering
│           ├── mobileNav.js     # Mobil bottenmeny & header-synk
│           └── mobileCards.js   # Mobilanpassade kort och summeringar
└── tests/
    ├── calculations.test.js     # Tester för alla bryggformler och kemiberäkningar
    ├── data.test.js             # Integritetstest för unika ID:n och fält i databaserna
    ├── beerxml.test.js          # Tester för BeerXML-import och export
    ├── mash.test.js             # Tester för mäskvatten och tidsberäkningar
    ├── recipes.test.js          # Tester för receptvalidering och skalningsalgoritm
    ├── state.test.js            # Tester för state-uppdateringar och historikstack
    └── integration.test.js      # Integrationsflödestester för receptberäkning
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
    notes: ""              // Receptanteckningar och brygglogg
  },
  fermentables: [
    { id: "pilsner-malt", name: "Pilsnermalt", amount: 4.5, potential: 1.037, ebc: 3.5, type: "grain" }
  ],
  hops: [
    { id: "citra", name: "Citra", amount: 30, alpha: 12.5, time: 15, use: "kok", type: "pellet" }
  ],
  yeast: {
    id: "us-05", name: "SafAle US-05", attMin: 78, attMax: 82, tempMin: 18, tempMax: 28
  },
  mash: [
    { name: "Försockring", temp: 66, time: 60, type: "Infusion" }
  ],
  water: {
    base: { id: "stockholm", name: "Stockholm", ca: 30, mg: 4, na: 10, cl: 15, so4: 35, hco3: 70 },
    target: { id: "hoppy", name: "Humlig IPA", ca: 100, mg: 15, na: 15, cl: 50, so4: 200, hco3: 0 },
    salts: { gypsum: 4.2, calciumChloride: 1.5, epsom: 2.0, tableSalt: 0, bakingSoda: 0, chalk: 0 }
  },
  equipment: {
    name: "Standard 30L",
    batchVolume: 20,
    efficiency: 75,
    boilOffRate: 3.0,      // L/h
    kettleLoss: 2.0,       // L
    grainAbsorption: 0.96, // L/kg krossad malt
    mashThickness: 3.0     // L/kg malt
  }
};
```

### Undo / Redo Historikstack
`src/state.js` sparar djupa kloner (`JSON.parse(JSON.stringify(State))`) i en historikstack med maximalt 30 steg. Tangentbordsgenvägarna `Ctrl+Z` och `Ctrl+Shift+Z` (samt `Cmd+Z` på macOS) återställer tillståndet och synkroniserar om gränssnittet automatiskt via `syncUIFromState(recalculate)`.

---

## 4. Beräkningsmodeller & Algoritmer

Samtliga matematiska modeller i `src/core/calculations.js` är standardiserade och testade:

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

### 4.2 Bitterhet (IBU via Glenn Tinseth)
- **Bitytnyttjande ($U$)**:
  $$U(t, \text{SG}_{\text{boil}}) = \left(1.65 \times 0.000125^{(\text{SG}_{\text{boil}} - 1)}\right) \times \left(\frac{1 - e^{-0.04 \times t}}{4.15}\right)$$
  - *Pelletjustering*: $+10\%$ utbyte jämfört med hela kottar.
  - *Whirlpool / Hop Stand*: Utnyttjande baserat på temperatur och kontakttid (typiskt 5–10% vid $85^\circ\text{C}$).
- **IBU per giva**:
  $$\text{IBU} = \frac{\text{Mängd (g)} \times (\text{Alfasyra } \% / 100) \times U \times 1000}{\text{Batchvolym (L)}}$$

### 4.3 Färg (EBC via Dan Morey)
- **Malt Color Units (MCU)**:
  $$\text{MCU} = \frac{\sum (\text{Vikt (kg)} \times 2.20462 \times \text{SRM}_{\text{malt}})}{\text{Batchvolym (Gallons)}}$$
- **SRM & EBC**:
  $$\text{SRM} = 1.4922 \times \text{MCU}^{0.6859}, \quad \text{EBC} = \text{SRM} \times 1.97$$

### 4.4 Vatten- och Volymberäkningar
- **Pre-boil Kokvolym**:
  $$V_{\text{boil}} = V_{\text{batch}} + (\text{BoilOffRate} \times \frac{\text{BoilTime}}{60}) + \text{KettleLoss}$$
- **Mäskvattenvolym**:
  $$V_{\text{mash}} = M_{\text{malt}} \times \text{Mäskkvot}$$
- **Totalt Vattenbehov**:
  $$V_{\text{total}} = V_{\text{boil}} + (M_{\text{malt}} \times \text{GrainAbsorption})$$
- **Lakvattenvolym**:
  $$V_{\text{sparge}} = V_{\text{total}} - V_{\text{mash}}$$

### 4.5 Vattenkemi & Residualalkalinitet (RA)
- **Jonbidrag (ppm / mg/L)**: Beräknas utifrån molekylvikter för $\text{CaSO}_4$, $\text{CaCl}_2$, $\text{MgSO}_4$, $\text{NaCl}$, $\text{NaHCO}_3$ och $\text{CaCO}_3$ fördelat över total vattenvolym.
- **Residualalkalinitet (RA)**:
  $$\text{RA} = \text{Alkalinitet} - \left(\frac{\text{Ca}^{2+}}{3.5}\right) - \left(\frac{\text{Mg}^{2+}}{7}\right)$$
- **Sulfat:Klorid-kvot**: Indikerar humle- vs maltdominerad smakprofil.

---

## 5. BeerXML 1.0 Standardisering (`src/core/beerxml.js`)

Brygglabbet stöder fullständig tvåvägskonvertering till **BeerXML 1.0**:
- **Export**: Serialiserar `State` till ett standardkompatibelt `<RECIPES><RECIPE>...</RECIPE></RECIPES>`-XML-dokument.
- **Import**: Parsar BeerXML via `DOMParser`, konverterar alla imperiala enheter (gal, lb, oz) till metriska standarder (L, kg, g) och läser in malter, humlegivor, jäst, mäskscheman och receptnoteringar.

---

## 6. Bryggdagsläge & Ljud/Vibrationsarkitektur (`src/ui/brewday.js`)

Bryggdagsläget är utformat som en interaktiv steg-för-steg-guide (Wizard) med:

1. **Web Audio API Synthesizer (`playAlarmNotification`)**:
   - Skapar en ren, bärnstensharmonisk larmsignal ($880\,\text{Hz} \to 1760\,\text{Hz}$) utan behov av externa ljudfiler.
2. **Haptisk Vibration**:
   - Anropar `navigator.vibrate([200, 100, 200, 100, 400])` på mobila enheter som stöds.
3. **Aktiv Humlevakt under Koktimern**:
   - Kontrollerar under varje sekunds nedräkning om återstående sekunder matchar någon humlegivas tidpunkt (`h.time * 60`).
   - Larmar automatiskt, visar toast-notis och applicerar pulserande ljus (`.hop-alert-active`) på humleschemat.
4. **Automatisk Stegkvittering**:
   - När mäsk- eller koktimers når `00:00` bockas momentets checkbox automatiskt och knappen `Nästa steg ➡️` pulserar (`.btn-pulse-next`).
5. **Bryggloggning**:
   - Låter bryggaren mata in uppmätt faktiskt OG och mäsk-pH, vilka automatiskt sparas in i receptnoteringarna.

---

## 7. Responsiv Design & CSS Arkitektur (`style.css`)

- **Design System Tokens**:
  - CSS variabler (`--bg-primary`, `--bg-secondary`, `--bg-card`, `--accent`, `--accent-bright`, `--text-primary`, `--border` m.fl.).
- **Smart Tooltip System**:
  - Mörk högkontrastbakgrund (`#221a14`), vit text, automatisk orientering och positionsbegränsning innanför sidopanelen för att förhindra klippning och överlappning.
  - Tillgänglighet via `aria-label` som eliminerar dubbla webbläsartooltips.
- **Mobil-UI (`src/ui/mobile/`)**:
  - Skärmväxlare och dedikerad navigation bar i botten med omedelbar synkning mot desktop-läget.

---

## 8. Testsvit & Kvalitetssäkring

Tester körs med **Vitest**:
```bash
npm test
```

### Testmoduler:
1. `tests/calculations.test.js` – 28 tester för OG, FG, ABV, IBU (Tinseth), EBC (Morey), vattenkalkyler och kemi.
2. `tests/data.test.js` – 10 tester för databasens integritet, unika ID:n och giltiga numeriska intervall.
3. `tests/beerxml.test.js` – 3 tester för import/export av BeerXML-recept.
4. `tests/mash.test.js` – 3 tester för mäskscheman och infusionsberäkningar.
5. `tests/recipes.test.js` – 2 tester för receptvalidering och skalningsalgoritm.
6. `tests/state.test.js` – 3 tester för state mutation, prenumerationer och historik.
7. `tests/integration.test.js` – 2 end-to-end integrationstester för kompletta receptflöden.

---

## 9. Bygg- & Produktionsprocess

```bash
# Installera beroenden
npm install

# Starta lokal utveckling med hot-module-reload
npm run dev

# Bygg produktionspaket till dist/
npm run build

# Kör linter och formatering
npm run lint
```
