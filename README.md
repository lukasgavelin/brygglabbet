# 🍺 Bryggkalkylator

En förenklad webbapplikation för att skapa ölrecept och göra bryggkalkyler, anpassad för svenska och europeiska standarder.

**[Öppna direkt](https://lukasgavelin.github.io/brew/)**

## Funktioner

- 🌾 **Malter** – Välj ur databas med 40+ sorter, live-uppdaterad gravitet och färgbidrag
- 🌿 **Humle** – IBU-beräkning via Tinseth-formeln, stöd för pellets/kottar, kok/whirlpool/torrhumle
- 🧫 **Jäst** – Databas med 26 stammar, attenuation och temperaturintervall
- 🔥 **Mäsk** – 4 förinställda program + visuell tidslinje, anpassningsbara steg
- 💧 **Vatten** – 6 salttyper, 11 vattenprofiler, residualalkalinitet, pH-uppskattning, Cl:SO₄-kvot
- 📊 **Live-kalkyl** – OG/FG/ABV/IBU/EBC uppdateras i realtid med visuell färgplatta
- 🎯 **Stilmatchning** – Jämför receptet mot 32 BJCP-stilar med grafiska indikatorer
- 💾 **Spara/Ladda** – LocalStorage + JSON-export och import

## Europeisk/svensk standard

| Enhet          | Beskrivning                              |
| -------------- | ---------------------------------------- |
| **°Plato**     | Stammvört och slutgravitet               |
| **EBC**        | Ölens färg (European Brewery Convention) |
| **IBU**        | Bitterhet (Tinseth-formeln, metrisk)     |
| **ABV**        | Alkohol – `(OG − FG) × 131.25`           |
| **L / kg / g** | Alla volymer och vikter                  |

## Användning

Inga beroenden eller byggsystem. Öppna bara `index.html` i en webbläsare.

```
brew/
├── index.html       # Applikationens HTML-struktur
├── style.css        # Design system (ljust amber-tema)
├── app.js           # Applikationslogik och state-hantering
├── calculations.js  # Alla bryggberäkningar
└── data.js          # Maltdatabas, humledatabas, stilguide, vattenprofiler
```

## Beräkningsformler

- **OG**: `GU = Σ(vikt_kg × utbyte × 384 × effektivitet) / volym_L`
- **IBU**: Tinseth – `U = 1.65 × 0.000125^(SG−1) × (1−e^(−0.04×tid)) / 4.15`
- **EBC**: Morey – `SRM = 1.4922 × MCU^0.6859`, `EBC = SRM × 1.97`
- **RA**: `Alkalinitet − Ca/3.5 − Mg/7` (som CaCO₃)
