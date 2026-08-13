/**
 * Mash profile presets database.
 */

export const MASH_PRESETS = {
  single_infusion: {
    name: 'Enkelt infusion',
    steps: [
      { name: 'Sackarifikation', type: 'Infusion', temp: 67, time: 60 },
      { name: 'Avmäskning', type: 'Infusion', temp: 78, time: 10 },
    ],
  },
  single_light: {
    name: 'Enkelsteg Torrt',
    steps: [
      { name: 'Sackarifikation', type: 'Infusion', temp: 65, time: 60 },
      { name: 'Avmäskning', type: 'Infusion', temp: 78, time: 10 },
    ],
  },
  single_medium: {
    name: 'Enkelsteg Medium',
    steps: [
      { name: 'Sackarifikation', type: 'Infusion', temp: 67, time: 60 },
      { name: 'Avmäskning', type: 'Infusion', temp: 78, time: 10 },
    ],
  },
  single_full: {
    name: 'Enkelsteg Fylligt',
    steps: [
      { name: 'Sackarifikation', type: 'Infusion', temp: 69, time: 60 },
      { name: 'Avmäskning', type: 'Infusion', temp: 78, time: 10 },
    ],
  },
  step_dekoktion: {
    name: 'Flersteg / Dekoktion',
    steps: [
      { name: 'Beta-amylasrast', type: 'Steg', temp: 63, time: 30 },
      { name: 'Sackarifikation', type: 'Dekoktion', temp: 68, time: 40 },
      { name: 'Avmäskning', type: 'Steg', temp: 78, time: 10 },
    ],
  },
  step_mash: {
    name: 'Stegmäskning',
    steps: [
      { name: 'Beta-amylasrast', type: 'Steg', temp: 63, time: 30 },
      { name: 'Sackarifikation', type: 'Steg', temp: 72, time: 30 },
      { name: 'Avmäskning', type: 'Steg', temp: 78, time: 10 },
    ],
  },
  full_step: {
    name: 'Full stegmäskning (med proteinrast)',
    steps: [
      { name: 'Inläggning', type: 'Infusion', temp: 52, time: 15 },
      { name: 'Beta-amylasrast', type: 'Steg', temp: 63, time: 30 },
      { name: 'Alfa-amylasrast', type: 'Steg', temp: 72, time: 20 },
      { name: 'Avmäskning', type: 'Steg', temp: 78, time: 10 },
    ],
  },
  decoction: {
    name: 'Dekoktion (enkel)',
    steps: [
      { name: 'Inläggning', type: 'Infusion', temp: 55, time: 20 },
      { name: 'Sackarifikation', type: 'Dekoktion', temp: 68, time: 40 },
      { name: 'Avmäskning', type: 'Steg', temp: 78, time: 10 },
    ],
  },
};
