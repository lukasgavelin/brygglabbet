# 🍺 Brygglabbet

**Brygglabbet** är en modern, snabb och intuitiv webbapplikation för att skapa ölrecept och göra bryggkalkyler. Appen är anpassad för svenska och europeiska bryggstandarder (EBC, °Plato, IBU, liter, gram/kg).

Appen innehåller ett **BeerSmith-inspirerat flöde** där du enkelt kan utgå från ett exempelrecept, välja din utrustning, se beräknat mäsk- och lakvatten i realtid samt skala alla ingredienser vid förändring av batchstorlek eller effektivitet.

---

## 🌟 Huvudfunktioner

- 🌾 **Malter & Jäsbarheter** – Välj ur databas med 40+ sorter (basmalter, karamellmalter, rostat, adjunkter, socker). Live-uppdaterad OG, Plato och EBC-färgbidrag.
- 🌿 **Humle** – IBU-beräkning via Tinseth-formeln. Stöd för pellets och kottar, givor i kok, whirlpool och torrhumle.
- 🧫 **Jäst** – Databas med 26 jäststammar (Fermentis, White Labs, Wyeast, Lallemand). Förjäsningsgrad och tempintervall.
- 🛠️ **Utrustningsprofiler** – Förinställningar för populära bryggverk (*Grainfather G30*, *Brewtools B40*, *BrewZilla 35L*, *BIAB*, *Standard Gryta 30L*) och fullständiga anpassningsmöjligheter (bortkok/h, grytförlust, jäskärlsförlust, mäskkvot, maltabsorption).
- 💧 **Vattenkalkylator & Vattenkemi** – Automatisk beräkning av **mäskvatten (L)**, **lakvatten (L)** och **totalt vattenbehov**. 6 salttyper, 11 vattenprofiler (Stockholm, Göteborg, Malmö, Pilsen, München m.fl.), residualalkalinitet (RA), uppskattat mäsk-pH och Cl⁻:SO₄²⁻-kvot.
- ⚖️ **Receptskalning** – Skala om alla malter (kg) och humlegivor (g) automatiskt vid ändrad batchvolym eller bryggverkseffektivitet.
- ✨ **Exempelrecept (Mallar)** – Kom igång snabbt med färdiga mallar för *Tjeckisk Pilsner*, *Gyllene Pale Ale*, *Kust-IPA*, *Dry Irish Stout*, *Hefeweizen* och *Belgisk Saison*.
- 📊 **Realtidsberäkning & EBC-färgvisning** – Omedelbar återkoppling på alla nyckelvärden (OG, FG, ABV, IBU, EBC, BU:GU) vid varje ändring med visuell färgplatta och beskrivande färgskala.
- 🎯 **BJCP Stilmatchning** – Visuell kontroll och grafiska staplar mot 32 officiella BJCP-stilar.
- 💾 **Spara & Exportera** – Spara recept i webbläsaren (LocalStorage) samt exportera och importera receptfiler i JSON-format.

---

## 📐 Europeisk & Svensk Standard

| Enhet | Beskrivning |
| ----- | ----------- |
| **°Plato** | Stammvört och slutgravitet (konverteras till/från SG) |
| **EBC** | Ölens färgskala (European Brewery Convention, beräknas via Morey-ekvationen) |
| **IBU** | Bitterhet (Tinseth-formeln, metrisk) |
| **ABV** | Alkoholhalt – `(OG − FG) × 131.25` |
| **L / kg / g** | Alla volymer, maltvikter och humlegivor |

---

## 🏗️ Projektstruktur (Refaktorerad Arkitektur)

Applikationen är refaktorerad enligt rena moduler (ES Modules) med tydlig ansvarsuppdelning mellan beräkningslogik (`core`), UI-komponenter (`ui`) och enhetstester (`tests`).

```
brew/
├── index.html               # Applikationens HTML5-struktur och modaler
├── style.css                # CSS Design System med variabler, dark/light amber-tema
├── vite.config.js           # Vite- och Vitest-konfiguration
├── package.json             # Projektberoenden och skript
├── .nvmrc                   # Node.js 20 miljödeklaration
├── public/                  # Statiska tillgångar för Cloudflare Pages
│   ├── _redirects           # SPA-routing fallback
│   └── _headers             # Caching och säkerhetsheaders
├── src/
│   ├── main.js              # Huvudentrépunkt och händelseorkestrering
│   ├── state.js             # Centraliserat State Management (Single Source of Truth)
│   ├── constants.js         # Bryggkonstanter och formelmultiplikatorer
│   ├── core/
│   │   ├── calculations.js  # Rena beräkningsfunktioner (OG, FG, IBU, EBC, Vatten, Skalning)
│   │   └── data.js          # Databaser (Malter, Humle, Jäst, BJCP-stilar, Vatten, Utrustning, Mallar)
│   └── ui/
│       ├── equipment.js     # Utrustningsprofiler & vattenvolymsvisning
│       ├── fermentables.js  # Malttabell & interaktioner
│       ├── hops.js           # Humletabell & interaktioner
│       ├── yeast.js          # Jästval & parametrar
│       ├── mash.js           # Mäskschema & tidslinje
│       ├── water.js          # Vattenkemi & saltberäkning
│       ├── recipes.js        # Receptlagring, mall-laddning, skalning & JSON
│       ├── sidebar.js        # Sidopanelsstatistik & recalculate-flöde
│       ├── styleMatch.js     # BJCP stilmatchningsgrafik
│       ├── modals.js         # Modalhantering & sökfiltrering
│       ├── tabs.js           # Fliknavigering
│       └── toast.js          # Toast-notiser
└── tests/
    ├── calculations.test.js  # Enhetstester för alla bryggberäkningar och vattenkalkyler
    └── data.test.js          # Tester för databasintegritet och unika ID:n
```

---

## 💻 Utveckling & Tester

### Starta utvecklingsserver
```bash
npm run dev
```

### Kör enhetstester (Vitest)
```bash
npm test
```

### Bygg för produktion
```bash
npm run build
```

---

## 🚀 Lansering på Cloudflare Pages (GitHub Integration)

Projektet är helt förberett för automatisk CI/CD-lansering på **Cloudflare Pages** direkt från ditt GitHub-repository.

### Cloudflare Pages Inställningar:

| Inställning | Värde |
| ----------- | ----- |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` |
| **Node.js version** | `20` *(hanteras automatiskt via `.nvmrc`)* |

### Steg för lansering:
1. Gå till **Cloudflare Dashboard** -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
2. Välj ditt GitHub-repository `brew`.
3. Välj preset **Vite** (Build command: `npm run build`, Output directory: `dist`).
4. Klicka **Save and Deploy**. Cloudflare bygger och publicerar appen automatiskt vid varje `git push`!

---

## 🧮 Beräkningsformler

- **OG (Original Gravity)**: `GU = Σ(vikt_kg × utbyte × 384 × effektivitet) / volym_L`
- **Pre-boil Gravity**: `Preboil_GU = (OG_GU × batchvolym_L) / kokvolym_L`
- **IBU (Tinseth)**: `U = 1.65 × 0.000125^(SG−1) × (1 − e^(−0.04 × tid)) / 4.15`, med pellet-bonus +10%
- **EBC (Morey)**: `MCU = (vikt_kg × EBC × 1.49) / volym_L`, `SRM = 1.4922 × MCU^0.6859`, `EBC = SRM × 1.97`
- **Vattenvolymer**:
  - `Mäskvatten (L) = total_malt_kg × mäskkvot`
  - `Totalt vatten (L) = kokvolym_L + (total_malt_kg × maltabsorption)`
  - `Lakvatten (L) = totalt_vatten - mäskvatten`
- **Residualalkalinitet (RA)**: `Alkalinitet − (Ca / 3.5) − (Mg / 7)` (som CaCO₃)
