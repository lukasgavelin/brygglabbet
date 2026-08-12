/**
 * BeerXML Import and Export utilities (BeerXML 1.0/2.0 compatible).
 */

import { escHtml } from '../ui/utils.js';

/**
 * Converts application state to a BeerXML formatted string.
 * @param {object} state - Application state
 * @returns {string} XML content
 */
export function exportBeerXML(state) {
  const r = state.recipe || {};
  const batchVol = Number(r.batchVolume) || 20;
  const boilVol = Number(r.boilVolume) || 25;
  const boilTime = Number(r.boilTime) || 60;
  const efficiency = Number(r.efficiency) || 75;

  const fermentablesXml = (state.fermentables || [])
    .map(
      (f) => `
      <FERMENTABLE>
        <NAME>${escHtml(f.name || 'Malt')}</NAME>
        <VERSION>1</VERSION>
        <TYPE>${f.type === 'sugar' ? 'Sugar' : 'Grain'}</TYPE>
        <AMOUNT>${Number(f.amount || 0).toFixed(3)}</AMOUNT>
        <YIELD>${Number(f.yield || 75).toFixed(1)}</YIELD>
        <COLOR>${Number(f.ebc || 5).toFixed(1)}</COLOR>
      </FERMENTABLE>`
    )
    .join('');

  const hopsXml = (state.hops || [])
    .map((h) => {
      const amountKg = (Number(h.amount) || 0) / 1000;
      let use = 'Boil';
      if (h.use === 'torrhumle' || h.use === 'dry-hop') use = 'Dry Hop';
      else if (h.use === 'whirlpool') use = 'Aroma';

      return `
      <HOP>
        <NAME>${escHtml(h.name || 'Humle')}</NAME>
        <VERSION>1</VERSION>
        <ALPHA>${Number(h.alpha || 5).toFixed(1)}</ALPHA>
        <AMOUNT>${amountKg.toFixed(4)}</AMOUNT>
        <USE>${use}</USE>
        <TIME>${Number(h.time || 0).toFixed(0)}</TIME>
        <FORM>${h.form === 'kottar' ? 'Leaf' : 'Pellet'}</FORM>
      </HOP>`;
    })
    .join('');

  const yeastXml = state.yeast?.name
    ? `
      <YEAST>
        <NAME>${escHtml(state.yeast.name)}</NAME>
        <VERSION>1</VERSION>
        <TYPE>${state.yeast.type === 'lager' ? 'Lager' : 'Ale'}</TYPE>
        <FORM>Dry</FORM>
        <LABORATORY>${escHtml(state.yeast.lab || '')}</LABORATORY>
        <ATTENUATION>${((Number(state.yeast.attMin || 72) + Number(state.yeast.attMax || 78)) / 2).toFixed(1)}</ATTENUATION>
      </YEAST>`
    : '';

  const mashStepsXml = (state.mash || [])
    .map(
      (m, idx) => `
        <MASH_STEP>
          <NAME>${escHtml(m.name || `Steg ${idx + 1}`)}</NAME>

          <VERSION>1</VERSION>
          <TYPE>${m.type === 'Steg' ? 'Temperature' : 'Infusion'}</TYPE>
          <STEP_TEMP>${Number(m.temp || 67).toFixed(1)}</STEP_TEMP>
          <STEP_TIME>${Number(m.time || 60).toFixed(0)}</STEP_TIME>
        </MASH_STEP>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>${escHtml(r.name || 'Mitt Recept')}</NAME>
    <VERSION>1</VERSION>
    <TYPE>All Grain</TYPE>
    <BREWER>Brygglabbet</BREWER>
    <BATCH_SIZE>${batchVol.toFixed(1)}</BATCH_SIZE>
    <BOIL_SIZE>${boilVol.toFixed(1)}</BOIL_SIZE>
    <BOIL_TIME>${boilTime.toFixed(0)}</BOIL_TIME>
    <EFFICIENCY>${efficiency.toFixed(1)}</EFFICIENCY>
    <NOTES>${escHtml(r.notes || '')}</NOTES>
    <FERMENTABLES>${fermentablesXml}
    </FERMENTABLES>
    <HOPS>${hopsXml}
    </HOPS>
    <YEASTS>${yeastXml}
    </YEASTS>
    <MASH>
      <NAME>Mäskschema</NAME>
      <VERSION>1</VERSION>
      <MASH_STEPS>${mashStepsXml}
      </MASH_STEPS>
    </MASH>
  </RECIPE>
</RECIPES>`;
}

/**
 * Parses a BeerXML document string into an application state slice.
 * @param {string} xmlString - BeerXML file contents
 * @returns {object} Partial application state
 */
export function importBeerXML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const recipeNode = doc.getElementsByTagName('RECIPE')[0];
  if (!recipeNode) {
    throw new Error('No <RECIPE> tag found in BeerXML document');
  }

  const getText = (parent, tagName, fallback = '') => {
    const el = parent.getElementsByTagName(tagName)[0];
    return el ? el.textContent.trim() : fallback;
  };

  const getNum = (parent, tagName, fallback = 0) => {
    const val = parseFloat(getText(parent, tagName));
    return isNaN(val) ? fallback : val;
  };

  const name = getText(recipeNode, 'NAME', 'Importerat BeerXML-recept');
  const batchVolume = getNum(recipeNode, 'BATCH_SIZE', 20);
  const boilVolume = getNum(recipeNode, 'BOIL_SIZE', 25);
  const boilTime = getNum(recipeNode, 'BOIL_TIME', 60);
  const efficiency = getNum(recipeNode, 'EFFICIENCY', 75);
  const notes = getText(recipeNode, 'NOTES', '');

  const fermentables = Array.from(recipeNode.getElementsByTagName('FERMENTABLE')).map((fNode, i) => {
    const fName = getText(fNode, 'NAME', `Malt ${i + 1}`);
    const amountKg = getNum(fNode, 'AMOUNT', 1.0);
    const yieldPct = getNum(fNode, 'YIELD', 75);
    const ebc = getNum(fNode, 'COLOR', 5);
    const typeStr = getText(fNode, 'TYPE', '').toLowerCase();

    return {
      id: i + 1,
      name: fName,
      amount: Math.round(amountKg * 100) / 100,
      yield: yieldPct,
      ebc: Math.round(ebc),
      type: typeStr.includes('sugar') ? 'sugar' : 'base',
    };
  });

  const hops = Array.from(recipeNode.getElementsByTagName('HOP')).map((hNode, i) => {
    const hName = getText(hNode, 'NAME', `Humle ${i + 1}`);
    const amountKg = getNum(hNode, 'AMOUNT', 0.025);
    const alpha = getNum(hNode, 'ALPHA', 5.0);
    const time = getNum(hNode, 'TIME', 60);
    const useRaw = getText(hNode, 'USE', '').toLowerCase();
    const formRaw = getText(hNode, 'FORM', '').toLowerCase();

    let use = 'kok';
    if (useRaw.includes('dry') || useRaw.includes('torr')) use = 'torrhumle';
    else if (useRaw.includes('aroma') || useRaw.includes('whirlpool')) use = 'whirlpool';

    let form = 'pellets';
    if (formRaw.includes('leaf') || formRaw.includes('kott')) form = 'kottar';

    return {
      id: i + 1,
      name: hName,
      amount: Math.round(amountKg * 1000), // convert kg to grams
      alpha: Math.round(alpha * 10) / 10,
      time: Math.round(time),
      use,
      form,
    };
  });

  const yeastNode = recipeNode.getElementsByTagName('YEAST')[0];
  const yeast = yeastNode
    ? {
        name: getText(yeastNode, 'NAME', 'Importerad Jäst'),
        lab: getText(yeastNode, 'LABORATORY', ''),
        type: getText(yeastNode, 'TYPE', '').toLowerCase().includes('lager') ? 'lager' : 'ale',
        attMin: Math.max(60, Math.round(getNum(yeastNode, 'ATTENUATION', 75) - 3)),
        attMax: Math.min(90, Math.round(getNum(yeastNode, 'ATTENUATION', 75) + 3)),
        tempMin: 18,
        tempMax: 22,
        notes: '',
      }
    : {
        name: 'Standard Jäst',
        lab: '',
        type: 'ale',
        attMin: 72,
        attMax: 78,
        tempMin: 18,
        tempMax: 22,
        notes: '',
      };

  const mashSteps = Array.from(recipeNode.getElementsByTagName('MASH_STEP')).map((mNode, i) => ({
    id: i + 1,
    name: getText(mNode, 'NAME', `Steg ${i + 1}`),
    type: getText(mNode, 'TYPE', '').toLowerCase().includes('temp') ? 'Steg' : 'Infusion',
    temp: getNum(mNode, 'STEP_TEMP', 67),
    time: getNum(mNode, 'STEP_TIME', 60),
  }));

  return {
    recipe: {
      name,
      styleId: '',
      batchVolume,
      boilVolume,
      boilTime,
      efficiency,
      notes,
    },
    fermentables,
    hops,
    yeast,
    mash: mashSteps.length > 0 ? mashSteps : [{ id: 1, name: 'Sackarifikation', type: 'Infusion', temp: 67, time: 60 }],
  };
}
