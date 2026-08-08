// comu.js — utilitats compartides per index.html i deporte.html.

import { carregarDades } from './datos.js';
import { calcularEsport } from './motor.js';
import { colorEquip } from './textos.js';

/** Crea un element. Tot el text va per textContent, mai per innerHTML. */
export function el(etiqueta, propietats = {}, fills = []) {
  const node = document.createElement(etiqueta);
  for (const [clau, valor] of Object.entries(propietats)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clau === 'class') node.className = valor;
    else if (clau === 'text') node.textContent = valor;
    // Object.assign no serveix per a les variables CSS (--accent): calen setProperty.
    else if (clau === 'style') {
      for (const [prop, val] of Object.entries(valor)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else node.setAttribute(clau, valor);
  }
  for (const fill of [].concat(fills)) {
    if (fill === null || fill === undefined || fill === false) continue;
    node.append(fill);
  }
  return node;
}

export const buida = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

/**
 * Carrega els JSON i calcula l'estat de tots els esports.
 * Un esport amb problemes no atura la resta: els errors es recullen a `errors`.
 */
export async function carregarTorneig() {
  const { torneig, quadres, resultats } = await carregarDades();

  const equips = new Map(
    torneig.equipos.map((equip, i) => [equip.id, { ...equip, color: colorEquip(equip, i), ordre: i }])
  );

  const errors = [];
  const esports = torneig.deportes.map((esport) => {
    try {
      const estat = calcularEsport(esport, torneig, quadres[esport.id], resultats[esport.id]);
      errors.push(...estat.errors);
      return estat;
    } catch (e) {
      errors.push(`No s'ha pogut calcular "${esport.id}": ${e.message}`);
      return {
        id: esport.id, esport, categoria: esport.categoria, taulaPunts: [], errors: [], punts: {},
        format: esport.formato, partits: {}, posicions: new Array(10).fill(null),
        progres: { jugats: 0, total: 0 },
      };
    }
  });

  // Esports que surten a cuadros.json o resultados.json però no a torneo.json.
  for (const id of new Set([...Object.keys(quadres), ...Object.keys(resultats)])) {
    if (!torneig.deportes.some((d) => d.id === id)) {
      errors.push(`L'esport "${id}" surt als fitxers de dades però no a datos/torneo.json.`);
    }
  }

  return { torneig, esports, equips, errors, perId: new Map(esports.map((e) => [e.id, e])) };
}

export const nomEquip = (equips, id) => equips.get(id)?.nombre ?? id ?? '';

/** Pastilla de color + nom de l'equip. */
export function celaEquip(equips, id) {
  const equip = equips.get(id);
  return el('span', { class: 'equip-cel' }, [
    el('span', { class: 'punt-color', style: { background: equip?.color ?? '#999' } }),
    el('span', { class: 'nom-equip', text: equip?.nombre ?? id }),
  ]);
}

/** Bàner discret amb els problemes trobats a les dades (§6.4 del brief). */
export function mostrarErrors(contenidor, errors) {
  buida(contenidor);
  if (!errors.length) { contenidor.hidden = true; return; }
  contenidor.hidden = false;
  console.warn('Problemes a les dades del torneig:', errors);

  const llista = el('ul');
  for (const error of errors.slice(0, 12)) llista.append(el('li', { text: error }));
  if (errors.length > 12) llista.append(el('li', { text: `… i ${errors.length - 12} problemes més (mira la consola).` }));

  contenidor.append(
    el('div', { class: 'avis' }, [
      el('h3', { text: errors.length === 1 ? 'Hi ha un problema a les dades' : `Hi ha ${errors.length} problemes a les dades` }),
      llista,
      el('p', { class: 'ajuda', text: 'La resta de la web funciona igualment. Revisa el fitxer indicat a datos/ (mira l\'apartat final del README).' }),
    ])
  );
}

/** Error greu: no s'han pogut ni carregar els fitxers. */
export function mostrarErrorGreu(contenidor, e) {
  console.error(e);
  buida(contenidor).hidden = false;
  contenidor.append(
    el('div', { class: 'avis' }, [
      el('h3', { text: 'No s\'han pogut carregar les dades' }),
      el('p', { text: e.message }),
    ])
  );
}
