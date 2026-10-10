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
│   │   ├── calculations.js      # computeRecipeMetrics & rena beräkningsmotorer (OG, FG, ABV, IBU, EBC, pH, Vatten)
│   │   ├── brewtools.js         # Verktygsberäkningar (kolsyra, refraktometer, hydrometer, jäst, strike, syra)
│   │   ├── batches.js           # Batch-CRUD, jässchema, tidslinje & .ics-export
│   │   ├── beerxml.js           # BeerXML 1.0 parser och serializer med kolsyra & givmetadata
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
│       ├── brewday.js           # Interaktivt bryggdagsläge, aktiva humlelarm & timers
│       ├── tools.js             # Bryggverktygspanel (kolsyra, refraktometer, hydrometer, jäst, strike)
│       ├── equipment.js         # Utrustningsprofilsvy & förlustparametrar
│       ├── fermentables.js      # Maltlista, tillsätt/ta bort, färgbidrag
│       ├── hops.js              # Humleschema, whirlpool-temp & torrhumling
│       ├── yeast.js             # Jästval, dämpningsintervall & jässchemaprofil
│       ├── mash.js              # Mäskstegsredigerare & mäskschemaväljare
│       ├── water.js             # Vattenprofilsjustering, salttillsatser, mäsk-pH & syra
│       ├── recipes.js           # Receptsparning, import/export, receptskalning
│       ├── sidebar.js           # Desktop-sidopanel med live-beräkningar och EBC-platta
│       ├── styleMatch.js        # BJCP stilmatchningsgrafer och toleransindikatorer
│       ├── print.js             # Utskriftsgenerator för bryggprotokoll
│       ├── tabs.js              # Flik- & dragspelsnavigation, quick-nav scrollspy & badges
│       ├── modals.js            # Modaldialoghantering med sök- och filtreringsstöd
│       ├── stepper.js           # Touch-vänliga inkrement/dekrement-knappar
│       ├── toast.js             # Animerade toast-notifikationer
│       ├── icons.js             # SVG-ikonsamling
│       └── mobile/              # Parallellt mobiloptimerat gränssnitt med full paritet
│           ├── mobileApp.js     # Mobilvy-initiering & skärmorkestrering
│           ├── mobileNav.js     # Mobil bottenmeny & header-synk
│           └── mobileCards.js   # Mobilanpassade kort och summeringar
└── tests/
    ├── calculations.test.js     # Tester för alla bryggformler och kemiberäkningar
    ├── brewtools.test.js        # Tester för verktygskalkyler och syraformler
    ├── batches.test.js          # Tester för batcher, scheman och .ics-export
    ├── data.test.js             # Integritetstest för unika ID:n och fält i databaserna
    ├── beerxml.test.js          # Tester för BeerXML-import och export
    ├── mash.test.js             # Tester för mäskvatten och tidsberäkningar
    ├── recipes.test.js          # Tester för receptvalidering och skalningsalgoritm
    ├── state.test.js            # Tester för state-uppdateringar och historikstack
    ├── integration.test.js      # Integrationsflödestester för receptberäkning
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
    fermentation: { profile: "auto", coldCrash: false }
  },
  fermentables: [
    { id: "pilsner-malt", name: "Pilsnermalt", amount: 4.5, potential: 1.037, ebc: 3.5, type: "base" }
  ],
  hops: [
    { id: "citra", name: "Citra", amount: 30, alpha: 12.5, time: 15, use: "kok", form: "pellets" }
  ],
  yeast: {
    id: "us-05", name: "SafAle US-05", attMin: 78, attMax: 82, tempMin: 18, tempMax: 28, type: "ale"
  },
  mash: [
    { id: 1, name: "Försockring", temp: 66, time: 60, type: "Infusion" }
  ],
  water: {
    base: { name: "Stockholm", ca: 30, mg: 4, na: 10, cl: 15, so4: 35, hco3: 70 },
    salts: { gypsum: 4.2, calciumChloride: 1.5, epsomSalt: 2.0, tableSalt: 0, bakingSoda: 0, chalk: 0 },
    volume: 25,
    acid: { enabled: false, targetPH: 5.4, type: "lactic", strength: 80, treatSparge: true }
  },
  equipment: {
    name: "Standard 30L",
    batchVolume: 20,
    efficiency: 75,
    boilOffRate: 3.0,      // L/h
    kettleLoss: 2.0,       // L
    grainAbsorption: 0.96, // L/kg krossad malt
    mashRatio: 3.0,        // L/kg malt
    grainTemp: 20          // °C
  }
};
```

### Datamodell för Batcher (`brygglabbet_batches`)
Batcher sparas som en separat samling i `localStorage`:
```javascript
const Batch = {
  id: "batch-1718000000000",
  createdAt: "2026-10-10T12:00:00Z",
  brewDate: "2026-10-10",
  recipeName: "Kust-IPA",
  recipeSnapshot: { ...State },
  measured: {
    preboilSG: 1.048,
    preboilVol: 26,
    og: 1.062,
    fermenterVol: 20,
    mashPH: 5.35
  },
  readings: [
    { id: "rd-1", date: "2026-10-15", sg: 1.018, brix: 8.2, tempC: 20, note: "God doft" }
  ],
  fg: 1.012,
  abv: 6.6,
  attenuation: 80.6,
  efficiency: 76.5,
  bottling: {
    date: "2026-10-24",
    method: "flaska",
    sugarType: "strösocker",
    sugarG: 130,
    vols: 2.5
  },
  fermentationPlan: [
    { name: "Primärjäsning", tempC: 19, days: 12, startDate: "2026-10-10" }
  ],
  status: "jäser", // "jäser" | "konditioneras" | "klar"
  tastingNotes: "Frisk citrusarom och balanserad beska.",
  rating: 5
};
```

### Undo / Redo Historikstack
`src/state.js` sparar djupa kloner (`JSON.parse(JSON.stringify(State))`) i en historikstack med maximalt 30 steg. Tangentbordsgenvägarna `Ctrl+Z` och `Ctrl+Shift+Z` (samt `Cmd+Z` på macOS) återställer tillståndet och synkroniserar om gränssnittet automatiskt via `syncUIFromState(recalculate)`.

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
  $$V_{\text{boil}} = V_{\text{batch}} + (\text{BoilOffRate} \times \frac{\text{BoilTime}}{60}) + \text{KettleLoss}$$
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
- **Syradosering (`acidAddition` & `spargeAcid`)**: Exakt invers beräkning av milliekvivalenter syra som krävs för att nå mål-pH, med stöd för 80%/88% mjölksyra och 10%/75% fosforsyra samt surmaltsekvivalent. Behandling av lakvatten neutraliserar bikarbonat till säkert lak-pH (< 5.8).

### 4.6 Bryggverktyg (`src/core/brewtools.js`)
- **Kolsyra**: Primingsocker i gram (strösocker, druvsocker, DME) baserat på serveringstemperatur och målvolymer $\text{CO}_2$; mottryck i fat baserat på Henrys lag.
- **Refraktometer**: Terrills kubiska korrigeringsformel för jäst vört med SG- och Brix-stöd.
- **Hydrometer**: Temperaturkorrigering för hydrometrar med kalibreringstemperatur $20^\circ\text{C}$.
- **Inmäskning (`strikeTemp`) & Infusion (`infusionVolume`)**: Termodynamiska värmebalansformler för mäskning och temperatursteg.
- **Jästkalkylator (`pitchRate`)**: Beräknar cellbehov per miljoner celler/ml/°P, förkulturvolym och antal torrjästpåsar.

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

### Testmoduler (115 tester i 10 testfiler):
1. `tests/calculations.test.js` – 28 tester för OG, FG, ABV, IBU (Tinseth & Malowicki), EBC (Morey), vattenkalkyler och kemi.
2. `tests/brewtools.test.js` – 45 tester för kolsyra (flaskor & fat), refraktometer (Terrill), hydrometer 20°C, pitch rate, strike-temp, infusion och syradosering.
3. `tests/batches.test.js` – 11 tester för batch-CRUD, jässcheman, tidslinjer, mätningar, flaskning, påminnelser och RFC 5545 .ics kalenderexport.
4. `tests/data.test.js` – 10 tester för databasens integritet, unika ID:n och giltiga numeriska intervall.
5. `tests/beerxml.test.js` – 4 tester för import/export av BeerXML-recept med kolsyra och givmetadata.
6. `tests/mash.test.js` – 3 tester för mäskscheman och infusionsberäkningar.
7. `tests/recipes.test.js` – 2 tester för receptvalidering och skalningsalgoritm.
8. `tests/state.test.js` – 3 tester för state mutation, prenumerationer och historik.
9. `tests/integration.test.js` – 2 end-to-end integrationstester för kompletta receptflöden.
10. `tests/ui-smoke.test.js` – 8 integrations- och fälttester (verktygsmodal, mäsk-pH/syra, bryggdagsläge, utskrift, torrhumling/jässchema, Mina bryggningar och mobilparitet).

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
