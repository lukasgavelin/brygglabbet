/**
 * SVG Icons registry and renderer helper.
 */

export const ICONS = {
  logo: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M10 6h4M12 6v4l-4.5 7.5A1.2 1.2 0 0 0 8.5 19.3h7a1.2 1.2 0 0 0 1-1.8L12 10V6"/><path d="M9.5 16c1.5-.7 3.5 1 5 0"/></svg>`,
  beer: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M5 8a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 8"/><path d="M5 8c0-1.1.9-2 2-2 1.1 0 2 .9 2 2s.9 2 2 2 2-.9 2-2 .9-2 2-2 2 .9 2 2"/></svg>`,
  recipe: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>`,
  wheat: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M2 22s8-4 12-10"/><path d="M10 14c-1-3 0-6 4-9 0 0 1 3-1 6"/><path d="M14 10c-1-3 0-6 4-9 0 0 1 3-1 6"/><path d="M7 17c-2-2-1-5 2-7 0 0 2 2 0 5"/><path d="M11 13c-2-2-1-5 2-7 0 0 2 2 0 5"/></svg>`,
  hop: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2v3"/><path d="M12 5c-3 1-5 3.5-5 7 0 4.5 3.5 8 5 10 1.5-2 5-5.5 5-10 0-3.5-2-6-5-7z"/><path d="M12 7c-2 2-2 5 0 7"/><path d="M12 7c2 2 2 5 0 7"/><path d="M8.5 10c1 1.5 3 2 3.5 2"/><path d="M15.5 10c-1 1.5-3 2-3.5 2"/></svg>`,
  yeast: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M10 2v7.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2"/><line x1="8" y1="2" x2="16" y2="2"/><circle cx="9" cy="15" r="1"/><circle cx="14" cy="16" r="1"/><circle cx="11" cy="18" r="1.5"/></svg>`,
  mash: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2c1.5 3 2.5 5 2.5 7.5A4.5 4.5 0 0 1 10 14a4.5 4.5 0 0 1-4.5-4.5C5.5 7 6.5 5 8 2z"/><path d="M12 22a8.5 8.5 0 0 0 8.5-8.5c0-3.5-2.5-6.5-5.5-9.5-1 3-2.5 5-4.5 6.5-1.5-1.5-2.5-3.5-2.5-5.5C5 8.5 3.5 11 3.5 13.5A8.5 8.5 0 0 0 12 22z"/></svg>`,
  water: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  lightbulb: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
  preset: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 3v3m0 12v3M3 12h3m12 0h3m-3.5-6.5l-2 2m-7 7l-2 2m0-11l2 2m7 7l2 2"/></svg>`,
  scale: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M16 16l3-8 3 8a3 3 0 0 1-6 0zM2 16l3-8 3 8a3 3 0 0 1-6 0zM12 3v18M3 7h18"/></svg>`,
  plus: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  folder: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  save: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  chart: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
  target: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  wrench: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  export: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  import: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  trash: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
};

/**
 * Returns the SVG string for a named icon.
 * @param {keyof typeof ICONS} name
 * @param {string} [extraClass]
 * @returns {string} SVG HTML string
 */
export function getIcon(name, extraClass = '') {
  const svg = ICONS[name] || '';
  if (extraClass && svg) {
    return svg.replace('class="svg-icon"', `class="svg-icon ${extraClass}"`);
  }
  return svg;
}
