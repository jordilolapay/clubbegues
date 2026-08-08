// comu.js — utilitats compartides per index.html i deporte.html.

import { carregarDades } from './datos.js';
import { calcularEsport } from './motor.js';
import { colorEquip } from './textos.js';

/** Les dues competicions. `masculina` és la que hi ha per defecte a les adreces. */
export const COMPETICIONS = {
  masculina: {
    id: 'masculina', etiqueta: 'Masculí', adjectiu: 'masculina',
    fitxerResultats: 'datos/resultados.json',
  },
  femenina: {
    id: 'femenina', etiqueta: 'Femení', adjectiu: 'femenina',
    fitxerResultats: 'datos/resultados-femenino.json',
  },
};

/** Llegeix la competició de l'adreça (?comp=femenina). */
export function competicioDeLaAdreca(cerca = location.search) {
  const valor = new URLSearchParams(cerca).get('comp');
  return valor === 'femenina' ? 'femenina' : 'masculina';
}

/** Adreça d'una pàgina mantenint la competició actual. */
export function adreca(pagina, competicio, extra = {}) {
  const params = new URLSearchParams(extra);
  if (competicio === 'femenina') params.set('comp', 'femenina');
  const cua = params.toString();
  return cua ? `${pagina}?${cua}` : pagina;
}

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
    } else node.setAttribute(clau, valor);
  }
  for (const fill of [].concat(fills)) {
    if (fill === null || fill === undefined || fill === false) continue;
    node.append(fill);
  }
  return node;
}

export const buida = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

/**
 * Carrega els JSON i calcula l'estat de tots els esports d'una competició.
 * Un esport amb problemes no atura la resta: els errors es recullen a `errors`.
 */
export async function carregarTorneig(competicio = 'masculina') {
  const dades = await carregarDades();
  const { torneig } = dades;
  const femeni = competicio === 'femenina';

  // La configuració de la femenina (equips i taula de punts) viu a femenino.json;
  // la llista d'esports i els grups afins són comuns i surten de torneo.json.
  const config = femeni ? dades.femeni : torneig;
  const resultats = femeni ? dades.resultatsFemeni : dades.resultats;

  const equips = new Map(
    config.equipos.map((equip, i) => [equip.id, { ...equip, color: colorEquip(equip, i), ordre: i }])
  );

  const errors = [];
  const esports = torneig.deportes.map((esport) => {
    // En femení els 17 esports de quadre es juguen com a lliga; els tres de resistència, igual.
    const format = femeni && esport.formato === 'cuadro' ? 'liga' : esport.formato;
    try {
      const estat = calcularEsport(esport, config, {
        format,
        quadre: dades.quadres[esport.id],
        resultat: resultats[esport.id],
        jornades: femeni ? dades.femeni.jornadas : undefined,
        puntsLliga: femeni ? dades.femeni.puntosLiga : undefined,
      });
      errors.push(...estat.errors);
      return estat;
    } catch (e) {
      errors.push(`No s'ha pogut calcular "${esport.id}": ${e.message}`);
      return {
        id: esport.id, esport, categoria: esport.categoria, taulaPunts: [], errors: [], punts: {},
        format, partits: {}, posicions: new Array(config.equipos.length).fill(null),
        progres: { jugats: 0, total: 0 },
      };
    }
  });

  // Esports que surten als fitxers de dades però no a torneo.json.
  const extres = new Set([...Object.keys(femeni ? {} : dades.quadres), ...Object.keys(resultats)]);
  for (const id of extres) {
    if (!torneig.deportes.some((d) => d.id === id)) {
      errors.push(`L'esport "${id}" surt als fitxers de dades però no a datos/torneo.json.`);
    }
  }

  return {
    competicio, config, torneig, esports, equips, errors,
    perId: new Map(esports.map((e) => [e.id, e])),
  };
}

export const nomEquip = (equips, id) => equips.get(id)?.nombre ?? id ?? '';

/**
 * Qui és el campió, si ja se sap. En un quadre n'hi ha prou amb haver jugat la final;
 * a la lliga cal haver acabat tots els partits, perquè fins llavors la taula encara pot canviar.
 */
export function campioDe(estat) {
  if (estat.format === 'liga' && estat.progres.jugats !== estat.progres.total) return null;
  return estat.posicions[0] ?? null;
}

/** Pastilla de color + nom de l'equip. */
export function celaEquip(equips, id) {
  const equip = equips.get(id);
  return el('span', { class: 'equip-cel' }, [
    el('span', { class: 'punt-color', style: { background: equip?.color ?? '#999' } }),
    el('span', { class: 'nom-equip', text: equip?.nombre ?? id }),
  ]);
}

/** Els dos botons Masculí / Femení. */
export function selectorCompeticio(competicio, pagina, extra = {}) {
  return el('div', { class: 'selector', role: 'tablist' },
    Object.values(COMPETICIONS).map((comp) =>
      el('a', {
        class: 'selector__opcio',
        href: adreca(pagina, comp.id, extra),
        'aria-current': comp.id === competicio ? 'true' : null,
        text: comp.etiqueta,
      })
    )
  );
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
      el('p', { class: 'ajuda', text: "La resta de la web funciona igualment. Revisa el fitxer indicat a datos/ (mira l'apartat final del README)." }),
    ])
  );
}

/** Error greu: no s'han pogut ni carregar els fitxers. */
export function mostrarErrorGreu(contenidor, e) {
  console.error(e);
  buida(contenidor).hidden = false;
  contenidor.append(
    el('div', { class: 'avis' }, [
      el('h3', { text: "No s'han pogut carregar les dades" }),
      el('p', { text: e.message }),
    ])
  );
}
