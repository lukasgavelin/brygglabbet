# 🍺 Brygglabbet

**Brygglabbet** är en modern, snabb och intuitiv webbapplikation för att skapa ölrecept, beräkna bryggkalkyler och genomföra bryggdagen med interaktiv guidning. Appen är helt anpassad för svenska och europeiska bryggstandarder (EBC, °Plato, IBU, liter, gram/kg).

Appen kombinerar ett **receptbyggarflöde i 7 logiska steg** med ett **interaktivt bryggdagsläge**, inbyggda timers med Web Audio-ljudsignaler, aktiva humlelarm, stöd för **BeerXML 1.0** samt utskriftsklara bryggprotokoll.

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
- **Steg-för-steg-guidning**: Från förberedelser, inmäskning, lakning, kok, kylning till jäsning och loggning.
- **Aktiva Humlelarm**: Koktimern övervakar humleschemat i realtid och aviserar automatiskt vid varje giva med Web Audio-larmsignal, toast-notis och pulserande visuell markering.
- **Automatisk Stegkvittering**: Moment bockas i automatiskt när timers når `00:00` med pulserande guidning till nästa steg.
- **Brygglogg**: Direkt inmatning av uppmätt OG och mäsk-pH som sparas i receptnoteringarna.

### 3. ⚖️ Receptskalning & Mallar
- **Receptskalare**: Skala om alla malter (kg) och humlegivor (g) automatiskt vid byte av batchstorlek eller bryggverkseffektivitet.
- **Färdiga Receptmallar**: Kom igång direkt med recept för *Tjeckisk Pilsner*, *Gyllene Pale Ale*, *Kust-IPA*, *Dry Irish Stout*, *Hefeweizen* och *Belgisk Saison*.

### 4. 🔄 Import, Export & Utskrift
- **BeerXML 1.0**: Fullständig tvåvägsimport och export kompatibel med BeerSmith, Brewfather m.fl.
- **JSON**: Spara och ladda recept i Brygglabbets eget format.
- **Lokal historik (Undo/Redo)**: Fullständig historikstack med tangentbordsgenvägar (`Ctrl+Z`, `Ctrl+Shift+Z` / `Cmd+Z`, `Cmd+Shift+Z`).
- **Utskriftsprotokoll**: Optimerad `@media print`-layout för fysiska bryggprotokoll med mätfält och checklistor.

### 5. 📱 Parallellt Mobil-UI & Tillgänglighet
- Fullt responsivt gränssnitt med en skräddarsydd mobilvy (`mobileApp.js`), touch-vänliga steppers och bottenmeny.
- Smarta CSS-tooltips med mörk bärnstensbakgrund (`#221a14`), hög kontrast och `aria-label`-stöd.

---

## 📐 Standarder & Enheter

| Parameter | Enhet | Metod / Formel |
| --------- | ----- | -------------- |
| **Gravitet (OG / FG)** | `SG` & `°Plato` | Potentiellt utbyte $\times$ Mäskeffektivitet |
| **Bitterhet** | `IBU` | Tinseth-formeln (med pellet- och whirlpooljustering) |
| **Färg** | `EBC` | Dan Morey-modellen ($\text{EBC} = \text{SRM} \times 1.97$) |
| **Alkohol** | `ABV %` | $(\text{OG} - \text{FG}) \times 131.25$ |
| **Balans** | `BU:GU` | $\text{IBU} / ((\text{OG} - 1.000) \times 1000)$ |
| **Volymer & Vikter** | `L`, `kg`, `g` | Metrisk standard |

---

## 🏗️ Projektstruktur

```
brygglabbet/
├── index.html                   # Semantisk HTML5-struktur, modaler & desktop/mobilcontainrar
├── style.css                    # Amber/Gold Design System, CSS variabler och responsiv layout
├── vite.config.js               # Vite bundler & Vitest testkonfiguration
├── package.json                 # Skript och projektberoenden
├── .nvmrc                       # Node.js 20 miljödeklaration
├── docs/
│   └── ARCHITECTURE.md          # Detaljerad teknisk arkitektur- och formeldokumentation
├── public/                      # Statiska tillgångar för Cloudflare Pages
│   ├── _redirects               # SPA-fallback routing
│   └── _headers                 # Säkerhets- och cachingheaders
├── src/
│   ├── main.js                  # App bootstrap, händelseorkestrering & kortkommandon
│   ├── state.js                 # Central state manager, historikstack & reaktiv synkronisering
│   ├── constants.js             # Bryggkonstanter och formelmultiplikatorer
│   ├── types.js                 # JSDoc typdefinitioner
│   ├── core/
│   │   ├── calculations.js      # Rena beräkningsfunktioner (OG, FG, IBU, EBC, Vatten, Kemi)
│   │   ├── beerxml.js           # BeerXML 1.0 parser & serializer
│   │   ├── data.js              # Databasexportör
│   │   └── data/                # Statiska databaser
│   │       ├── malts.js         # 40+ maltsorter och sockerarter
│   │       ├── hops.js          # 45+ humlesorter
│   │       ├── yeasts.js        # 26 jäststammar
│   │       ├── styles.js        # 32 BJCP 2021 ölstilar
│   │       ├── equipment.js     # Utrustningsprofiler
│   │       ├── water.js         # Vattenkällor & målprofiler
│   │       ├── mash.js          # Mäskscheman
│   │       └── preset-recipes.js# Kompletta exempelrecept
│   └── ui/
│       ├── brewday.js           # Bryggdagsläge, humlelarm, timers & logg
│       ├── equipment.js         # Utrustningsparametrar & vattenkrav
│       ├── fermentables.js      # Malttabell & färgbidrag
│       ├── hops.js              # Humleschema & användningstyper
│       ├── yeast.js             # Jästval & dämpning
│       ├── mash.js              # Mäsksteg & infusionsvolymer
│       ├── water.js             # Vattenkemi, salter & pH
│       ├── recipes.js           # Receptlagring, skalning & JSON
│       ├── sidebar.js           # Sidopanel med realtidsnyckeltal & EBC-platta
│       ├── styleMatch.js        # BJCP stilmatchningsgrafer
│       ├── print.js             # Utskriftsprotokollsgenerator
│       ├── tabs.js              # Dragspel, quick-nav & badges
│       ├── modals.js            # Modaldialoger & sökfilter
│       ├── stepper.js           # Touch-steppers
│       ├── toast.js             # Toast-notifikationer
│       ├── icons.js             # SVG-ikoner
│       └── mobile/              # Parallellt Mobil-UI
│           ├── mobileApp.js     # Mobil router & initiering
│           ├── mobileNav.js     # Mobil bottenmeny
│           └── mobileCards.js   # Mobilanpassade kort
└── tests/
    ├── calculations.test.js     # 28 tester för brygg- och kemiformler
    ├── data.test.js             # 10 tester för databasens integritet
    ├── beerxml.test.js          # 3 tester för BeerXML-konvertering
    ├── mash.test.js             # 3 tester för mäskscheman
    ├── recipes.test.js          # 2 tester för receptskalning och validering
    ├── state.test.js            # 3 tester för state mutation och historik
    └── integration.test.js      # 2 end-to-end integrationstester
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

### 4. Bygg för produktion
```bash
npm run build
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

För djupgående information om matematiska härledningar, BeerXML-specifikationen och tillståndshantering, se [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
