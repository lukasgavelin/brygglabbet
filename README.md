# 🍺 Brygglabbet

**Brygglabbet** är en modern, snabb och intuitiv webbapplikation för att skapa ölrecept, beräkna bryggkalkyler och genomföra bryggdagen med interaktiv guidning. Appen är helt anpassad för svenska och europeiska bryggstandarder (EBC, °Plato, IBU, liter, gram/kg).

Appen kombinerar ett **receptbyggarflöde i 7 logiska steg** med ett **interaktivt bryggdagsläge**, inbyggda timers med Web Audio-ljudsignaler, **Screen Wake Lock API** (håller skärmen vaken), **Web Notifications** (systemnotiser vid humlegivor), fullständig **Workbox PWA precaching** (100 % driftsäker offline), stöd för **BeerXML 1.0** samt utskriftsklara bryggprotokoll.

---

## 🌟 Huvudfunktioner

### 1. 📋 Strukturerat Receptflöde (7 Steg)
1. **Grunddata & Utrustningsprofil** – Välj BJCP-ölistil, bryggvolym, koktid, effektivitet, grytparametrar (bortkok/h, grytförlust, maltabsorption) och pedagogiska tooltips.
2. **Malt & Råvaror** – Databas med 40+ malter och sockerarter. Automatisk beräkning av OG, °Plato, potentiellt utbyte och EBC-färgbidrag.
3. **Mäskschema** – Stegmäskning med temperaturer, rasttider, infusionsvolymer och fördefinierade mäskscheman.
4. **Humlegivor** – Databas med 45+ humlesorter. IBU-beräkning via Tinseth-formeln för kok, whirlpool/hop stand och torrhumling.
5. **Jäst & Jäsning** – Databas med 26 jäststammar (Fermentis, White Labs, Wyeast, Lallemand). Förjäsningsgrad (min/max) och jästemperaturintervall.
6. **Vatten & Vattenkemi** – Automatisk beräkning av mäsk- och lakvatten, 6 bryggsalter, 11 källprofiler, residualalkalinitet (RA), beräknat mäsk-pH och $\text{Cl}^-:\text{SO}_4^{2-}$-kvot.
7. **Anteckningar & Slutförande** – Fritextnoteringar, CTA-banner "Redo att brygga?", snabbknappar för mallar, receptskalning och utskrift.

### 2. ⏱️ Interaktivt Bryggdagsläge (Wizard & Timers)
- **Steg-för-steg-guidning**: Från förberedelser, inmäskning, lakning, kok, kylning till jäsning och slutförande.
- **Screen Wake Lock API**: Håller automatiskt telefonens och surfplattans skärm tänd under bryggningen och timern så att du slipper låsa upp med kladdiga vörtfingrar. Återansluter automatiskt vid appväxling via `visibilitychange`.
- **Monoton Timestamp-timer**: Räknar mot reell tidstämpel (`Date.now() + remainingMs`). Förhindrar tidsavdrift och fördröjningar när mobilen vilar eller webbläsarfliken körs i bakgrunden.
- **Tröskelstyrda Humlelarm & Web Notifications**: Koktimern övervakar humleschemat i realtid med tröskelkontroll (`<= targetSecs`). Aviserar med Web Audio-larmsignal, haptisk vibration, visuell puls och **systemnotiser** (`Notification API`) även när skärmen är låst eller minimerad.
- **Exakt strike-temperatur**: Beräknar inmäskningstemperatur baserat på maltens temperatur och mäskkvot.
- **Syra- och saltöversikt**: Visar exakta givor av bryggsalter och syra (ml) i mäsk- och lakvatten.
- **Vörtkontroll före kok**: Logga förkoksgravitet och volym med direkt förslag på åtgärder vid avvikelser (koka längre, späd med vatten eller tillsätt DME/socker).
- **Automatisk Stegkvittering**: Moment bockas i automatiskt när timers når `00:00` med pulserande guidning till nästa steg.
- **Faktisk Effektivitetsberäkning**: Mata in uppmätt OG och volym i jäskärlet och uppdatera utrustningsprofilen med ett klick.
- **Spara som Batch**: Direktknapp för att spara bryggningen till "Mina bryggningar".

### 3. 📒 Mina bryggningar & Jässchema
- **Batchhistorik**: Spara och följ varje bryggning separat från receptmallen ("Bryggd N ggr").
- **Planerat vs Faktiskt**: Jämför OG, FG, ABV och brygghuseffektivitet sida vid sida.
- **Jässchema & Tidslinje**: Standardiserade jässcheman för Ale, Lager (med diacetylvila och kallagring), Kveik och Veteöl.
- **Torrhumlingspåminnelser & Kallkrasch**: Schemalagda humlegivor med startdag och kontakttid, samt export av kalenderfiler (**RFC 5545 `.ics`**) helt serverlöst.
- **Gravitetslogg**: Logga mätningar med hydrometer (automatisk tempkorrigering vid 20°C) eller refraktometer (Terrills kubiska formel för jäst vört).
- **Flaskning & Kolsyra**: Beräkna primingsocker (strösocker, druvsocker, DME) direkt mot batchens volym och temperatur.
- **Betyg & Provsmakning**: 1–5 stjärnbetyg och provsmakningsnoteringar som sparas lokalt.

### 4. 🧰 Bryggverktygspanel
- **Kolsyrekalkylator**: Primingsocker i gram per liter för flaskor samt fatkolsyra i bar vid given serveringstemperatur.
- **Refraktometer**: Korrigering av vört före och under/efter jäsning (Terrills formel).
- **Hydrometer**: Temperaturkorrigering för hydrometrar kalibrerade vid 20°C.
- **Jästkalkylator**: Pitch rate (miljoner celler/ml/°P), cellbehov, flytande jäst/starter och antal torrjästpåsar.
- **Inmäskning & Infusion**: Strike-temperatur och kokande vattenvolym för temperatursteg.

### 5. ⚖️ Receptskalning & Mallar
- **Receptskalare**: Skala om alla malter (kg), humlegivor (g), vattenvolym (L), kokvolym (L) och bryggsalter (g) proportionellt vid byte av batchstorlek eller bryggverkseffektivitet.
- **Färdiga Receptmallar**: Kom igång direkt med recept för *Tjeckisk Pilsner*, *Gyllene Pale Ale*, *West Coast IPA*, *Dry Irish Stout*, *Hefeweizen* och *Belgisk Saison*.

### 6. 🔄 Import, Export & Säkerhetskopiering
- **Fullständig Backup (JSON)**: Exportera hela ditt bryggarkiv – **alla sparade recept**, **alla genomförda batcher** och aktivt recept – i en samlad JSON-fil med ett klick. Återställ lika enkelt via importdialogen.
- **Persistent Autosave**: Autosave sparar löpande i `safeStorage` (localStorage med quota-skydd). Påbörjade recept överlever om fliken stängs, webbläsaren kraschar eller datorn startas om (återställning upp till 24h).
- **BeerXML 1.0**: Fullständig tvåvägsimport och export med stöd för kolsyrenivåer, whirlpool-temperatur och torrhumlingsdagar. Vid import bevaras befintliga utrustnings- och vattenprofiler om BeerXML-filen saknar dessa taggar.
- **Lokal historik (Undo/Redo)**: Fullständig historikstack med tangentbordsgenvägar (`Ctrl+Z`, `Ctrl+Shift+Z` / `Cmd+Z`, `Cmd+Shift+Z`).
- **Utskriftsprotokoll**: Optimerad `@media print`-layout för fysiska bryggprotokoll med mätfält och checklistor.

### 7. 📱 Parallellt Mobil-UI & Skottsäker Offline PWA
- Fullt responsivt gränssnitt med en skräddarsydd mobilvy (`mobileApp.js`), touch-vänliga steppers och bottenmeny.
- Komplett paritet med desktop: mäsk-pH, syrajustering, whirlpool-temperatur, torrhumlingstid, jässcheman och Mina bryggningar.
- **Modulariserad DOM & Sanerad Teknisk Skuld**: `index.html` har bantats med över 600 rader genom utbrytning av modaldialoger (`modalsTemplate.js`) och mobillayout (`mobileTemplate.js`). Unifierad tvåvägssynk (`syncBridge.js`) och händelsedelegation eliminerar duplicerad eventhantering och drift mellan vyerna.
- **Vite PWA & Workbox Precaching**: Automatisk precaching av alla hashade JavaScript- och CSS-bundles vid produktionsbygge. Appen startar 100 % tillförlitligt i källare och garage utan mobiltäckning.

### 8. 📲 Serverlös QR-synk & URL-hash (PC till Mobil)
- **Zero-Backend Överföring**: Skapa receptet i lugn och ro på datorn i köket eller kontoret och överför det till mobilen i brygghörnan på en sekund genom att skanna en QR-kod med mobilkameran. Inga konton, inga inloggningar och ingen server behövs.
- **Kompakt URL-hash**: Receptschemat komprimeras via `lz-string` och bäddas in i URL-hashen (`#brew=` eller `#recipe=`).
- **100 % Offline Vektor-QR**: QR-koden renderas som skarp vektor-SVG lokalt i webbläsaren utan beroende av externa tredjeparts-API:er.
- **Direktstart av Bryggdag**: Skanning med `#brew=` öppnar receptet och startar Bryggdagsläget direkt. Webbläsarens adressfält städas automatiskt med `history.replaceState` för att bevara rena bokmärken och förhindra dataöverskrivning.

---

## 📐 Standarder & Enheter

| Parameter | Enhet | Metod / Formel |
| --------- | ----- | -------------- |
| **Gravitet (OG / FG)** | `SG` & `°Plato` | Potentiellt utbyte $\times$ Mäskeffektivitet |
| **Bitterhet** | `IBU` | Tinseth-formeln (med kokgravitet, pellet- och temperaturberoende whirlpool) |
| **Färg** | `EBC` | Dan Morey-modellen ($\text{EBC} = \text{SRM} \times 1.97$) |
| **Alkohol** | `ABV %` | $(\text{OG} - \text{FG}) \times 131.25$ |
| **Balans** | `BU:GU` | $\text{IBU} / ((\text{OG} - 1.000) \times 1000)$ |
| **Vattenkemi & pH** | `ppm`, `pH` | Residualalkalinitet & laddningsbalans per malttyp med exakt syrainvers |
| **Volymer & Vikter** | `L`, `kg`, `g` | Metrisk standard |

---

## 🏗️ Projektstruktur

```
brygglabbet/
├── index.html                   # Semantisk HTML5-struktur, modaler & desktop/mobilcontainrar
├── style.css                    # Amber/Gold Design System, CSS variabler och responsiv layout
├── vite.config.js               # Vite bundler, VitePWA precaching & Vitest testkonfiguration
├── package.json                 # Skript och projektberoenden
├── .nvmrc                       # Node.js 20 miljödeklaration
├── docs/
│   ├── ARCHITECTURE.md          # Detaljerad teknisk arkitektur- och formeldokumentation
│   └── RADDNINGSPAKET.md        # Detaljerat räddningspaket och premortem-reparationsplan
├── public/                      # Statiska tillgångar för Cloudflare Pages
│   ├── _redirects               # SPA-fallback routing
│   ├── _headers                 # Säkerhets- och cachingheaders
│   ├── favicon.svg              # SVG app-ikon
│   └── manifest.webmanifest     # PWA manifestdeklaration
├── src/
│   ├── main.js                  # App bootstrap, händelseorkestrering & kortkommandon
│   ├── state.js                 # Central state manager, historikstack & profilbevarande normalisering
│   ├── constants.js             # Bryggkonstanter och formelmultiplikatorer
│   ├── types.js                 # JSDoc typdefinitioner
│   ├── core/
│   │   ├── calculations.js      # computeRecipeMetrics & rena beräkningsfunktioner (inkl. vatten/saltskalning)
│   │   ├── brewtools.js         # Verktygsfunktioner (kolsyra, refraktivitet, hydrometer, syra, inmäskning)
│   │   ├── batches.js           # Batchhantering, jässcheman, mätningar & .ics kalenderexport
│   │   ├── beerxml.js           # BeerXML 1.0 parser & serializer med kolsyra och givmetadata
│   │   ├── recipeSharing.js     # Serverlös QR- och URL-hash komprimering (lz-string) & SVG QR-rendering
│   │   ├── wakelock.js          # Screen Wake Lock API manager (håller skärmen vaken vid bryggning)
│   │   ├── storage.js           # safeStorage & safeSessionStorage med kvotskydd
│   │   ├── data.js              # Databasexportör
│   │   └── data/                # Statiska databaser (malter, humle, jäst, stilar, profiler, mäskscheman)
│   └── ui/
│       ├── batches.js           # Mina bryggningar (historik, tidslinje, logg, flaskning & betyg)
│       ├── brewday.js           # Bryggdagsläge, monoton timestamp-timer, humlelarm, Wake Lock & systemnotiser
│       ├── shareQr.js           # QR-delningsdialog, lägesväljare & startup-hashavlyssnare
│       ├── tools.js             # Bryggverktygspanel (kolsyra, refraktometer, hydrometer, jäst, strike)
│       ├── equipment.js         # Utrustningsparametrar & vattenkrav
│       ├── fermentables.js      # Malttabell & färgbidrag
│       ├── hops.js              # Humleschema, whirlpool-temp & torrhumling
│       ├── yeast.js             # Jästval, dämpning & jässchemaprofiler
│       ├── mash.js              # Mäsksteg & infusionsvolymer
│       ├── water.js             # Vattenkemi, salter, mäsk-pH & syrajustering
│       ├── recipes.js           # Receptlagring, full workspace backup, persistent autosave & import/export
│       ├── sidebar.js           # Sidopanel med realtidsnyckeltal & EBC-platta
│       ├── styleMatch.js        # BJCP stilmatchningsgrafer
│       ├── print.js             # Utskriftsprotokollsgenerator
│       ├── tabs.js              # Dragspel, quick-nav & badges
│       ├── modals.js            # Modaldialoger & sökfilter
│       ├── stepper.js           # Touch-steppers
│       ├── toast.js             # Toast-notifikationer
│       ├── icons.js             # SVG-ikoner
│       ├── errorBoundary.js     # Global crash recovery & error boundary
│       ├── templates/           # Modulära HTML-templates (modalsTemplate.js)
│       └── mobile/              # Parallellt Mobil-UI (router, bottenmeny, mobilkort, mobileTemplate.js)
└── tests/
    ├── calculations.test.js     # 28 tester för brygg- och kemiformler
    ├── brewtools.test.js        # 45 tester för verktygs- och syraformler
    ├── batches.test.js          # 11 tester för batcher, scheman och .ics-export
    ├── data.test.js             # 10 tester för databasens integritet
    ├── beerxml.test.js          # 4 tester för BeerXML-konvertering
    ├── mash.test.js             # 3 tester för mäskscheman
    ├── recipes.test.js          # 2 tester för receptmallar och validering
    ├── state.test.js            # 3 tester för state mutation och historik
    ├── integration.test.js      # 2 end-to-end integrationstester
    ├── storage-resilience.test.js # 13 tester för persistens, kvotskydd och PWA-filer
    ├── rescue-fixes.test.js     # 4 tester för vatten/saltskalning, BeerXML-skydd, Wake Lock & full backup
    ├── architecture-modularization.test.js # 13 tester för DOM-modularisering och event delegation
    ├── recipe-sharing.test.js   # 8 tester för serverlös receptdelning, URL-hash & offline QR-kod
    └── ui-smoke.test.js         # 9 rök- och integrationsfälttester (desktop + mobil)
```

---

## 💻 Utveckling & Tester

### 1. Installera beroenden
```bash
npm install
```

### 2. Starta lokal utvecklingsserver
```bash
npm run dev
```

### 3. Kör automatiserade enhetstester (Vitest)
```bash
npm test
```
*Kör samtliga 155 tester över 14 testfiler.*

### 4. Bygg för produktion (inkl. PWA Workbox bundles)
```bash
npm run build
```

### 5. Kör linter
```bash
npm run lint
```

---

## 🚀 Lansering på Cloudflare Pages

Projektet är konfigurerat för automatisk CI/CD-lansering via **Cloudflare Pages**:

| Inställning | Värde |
| ----------- | ----- |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` |
| **Node.js version** | `20` *(hanteras automatiskt via `.nvmrc`)* |

---

## 📖 Ytterligare Dokumentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – Detaljerad teknisk arkitektur, formeldokumentation och datamodeller.
- [docs/RADDNINGSPAKET.md](docs/RADDNINGSPAKET.md) – Detaljerat räddningspaket och premortem-reparationsplan med sprintplan och tekniska åtgärder.
