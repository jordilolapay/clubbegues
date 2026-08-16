// comu.js — utilitats compartides per index.html i deporte.html.

import { carregarDades } from './datos.js';
import { calcularEsport } from './motor.js';
import { colorEquip, NOMS_PARTITS } from './textos.js';

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

// On es recorda l'última competició triada. El navegador d'algú pot tenir
// l'emmagatzematge bloquejat, i llavors simplement no es recorda res.
const CLAU_RECORD = 'clubbegues.competicio';

function recordar(competicio) {
  try { localStorage.setItem(CLAU_RECORD, competicio); } catch { /* sense memòria, tant se val */ }
  return competicio;
}

function recordada() {
  try { return localStorage.getItem(CLAU_RECORD) === 'femenina' ? 'femenina' : 'masculina'; }
  catch { return 'masculina'; }
}

/**
 * Llegeix la competició de l'adreça (?comp=femenina). Si l'adreça no en diu res
 * —el menú, la portada, un enllaç compartit sense paràmetre— es fa servir l'última
 * que va triar aquesta persona; de bon principi, la masculina.
 */
export function competicioDeLaAdreca(cerca = location.search) {
  const valor = new URLSearchParams(cerca).get('comp');
  if (valor === 'femenina' || valor === 'masculina') return recordar(valor);
  return recordada();
}

/**
 * Adreça d'una pàgina mantenint la competició actual. Sempre hi posa el paràmetre,
 * també en masculí: si no, un enllaç a la masculina des de la femenina no diria res
 * i la pàgina de destí recuperaria la femenina que hi ha recordada.
 */
export function adreca(pagina, competicio, extra = {}) {
  const params = new URLSearchParams(extra);
  params.set('comp', competicio === 'femenina' ? 'femenina' : 'masculina');
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

  // Els problemes de lectura del full de càlcul es veuen al mateix bàner que els de les dades.
  const errors = [...(dades.avisos ?? [])];
  const esports = torneig.deportes.map((esport) => {
    // En femení els 17 esports de quadre es juguen com a lliga; els quatre que van per
    // ordre (resistència i minigolf) es queden igual.
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
    horaris: indexarHoraris(dades.horaris, competicio),
    perId: new Map(esports.map((e) => [e.id, e])),
  };
}

export const nomEquip = (equips, id) => equips.get(id)?.nombre ?? id ?? '';

/* ---------- Qui juga un partit ---------- */

/** Quan un participant encara no se sap, d'on sortirà: [guanyador|perdedor, partit]. */
export const PROCEDENCIA = {
  qf1: [['guanyador', 'previa1'], null],
  qf3: [['guanyador', 'previa2'], null],
  sf1: [['guanyador', 'qf1'], ['guanyador', 'qf2']],
  sf2: [['guanyador', 'qf3'], ['guanyador', 'qf4']],
  final: [['guanyador', 'sf1'], ['guanyador', 'sf2']],
  tercerPuesto: [['perdedor', 'sf1'], ['perdedor', 'sf2']],
  consSf1: [['perdedor', 'qf1'], ['perdedor', 'qf2']],
  consSf2: [['perdedor', 'qf3'], ['perdedor', 'qf4']],
  consFinal: [['guanyador', 'consSf1'], ['guanyador', 'consSf2']],
  consTercero: [['perdedor', 'consSf1'], ['perdedor', 'consSf2']],
  puesto9: [['perdedor', 'previa1'], ['perdedor', 'previa2']],
};

/** «Guanyador QF1», «Perdedor SF2»… per als partits que encara no tenen participants. */
export function textIncognita(idPartit, index) {
  const origen = PROCEDENCIA[idPartit]?.[index];
  if (!origen) return '—';
  const [quin, partit] = origen;
  return `${quin === 'guanyador' ? 'Guanyador' : 'Perdedor'} ${NOMS_PARTITS[partit]?.sigla ?? partit}`;
}

/* ---------- Horaris ---------- */

const DIES_SETMANA = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
// Tots els dies comencen per "di", o sigui que les abreviatures no es poden retallar soles.
const DIES_CURTS = ['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.'];
const MESOS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost',
  'setembre', 'octubre', 'novembre', 'desembre'];

/**
 * Quan comença de veritat una franja. Les hores de matinada (de 0 a 6) s'apunten al dia
 * abans, perquè per a qui hi juga són la mateixa nit: "dissabte a les 0-1h".
 */
export function inicia(slot) {
  if (!slot.inici) return new Date(`${slot.data}T23:59:00`); // les dates límit, al final del dia
  const quan = new Date(`${slot.data}T${slot.inici}:00`);
  if (Number(slot.inici.slice(0, 2)) < 6) quan.setDate(quan.getDate() + 1);
  return quan;
}

export function acaba(slot) {
  const inici = inicia(slot);
  if (!slot.fi) return inici;
  const quan = new Date(`${slot.data}T${slot.fi}:00`);
  if (quan <= inici) quan.setDate(quan.getDate() + 1);
  return quan;
}

/**
 * La data d'avui tal com s'escriuen les del calendari (2026-08-22). Va per l'hora del
 * rellotge de qui mira la web: `toISOString()` faria servir l'hora de Londres i aquí, de
 * matinada, encara diria ahir.
 */
export function avuiLocal(ara = new Date()) {
  const dosDigits = (n) => String(n).padStart(2, '0');
  return `${ara.getFullYear()}-${dosDigits(ara.getMonth() + 1)}-${dosDigits(ara.getDate())}`;
}

/** "Dissabte 22 d'agost" */
export function nomDia(data) {
  const quan = new Date(`${data}T12:00:00`);
  const mes = MESOS[quan.getMonth()];
  return `${DIES_SETMANA[quan.getDay()]} ${quan.getDate()} ${/^[aeiou]/.test(mes) ? "d'" : 'de '}${mes}`;
}

/** "18:00 – 20:00", o només l'hora d'inici si no se sap quan s'acaba. */
export const franja = (slot) => (slot.fi && slot.fi !== slot.inici ? `${slot.inici} – ${slot.fi}` : slot.inici ?? '');

/** "ds. 22": per a les targetes de partit i la portada, on l'espai és just. */
export const diaCurt = (data) => {
  const quan = new Date(`${data}T12:00:00`);
  return `${DIES_CURTS[quan.getDay()]} ${quan.getDate()}`;
};

/**
 * Les franges que afecten una competició, ordenades, amb un índex per trobar de seguida
 * la d'un partit concret. Un horari sense competició (natació, minigolf…) val per a totes dues.
 */
export function indexarHoraris(horaris, competicio) {
  const meus = (horaris ?? [])
    .filter((slot) => !slot.competicio || slot.competicio === competicio)
    .sort((a, b) => inicia(a) - inicia(b));

  const perEsport = new Map();
  const perPartit = new Map();
  for (const slot of meus) {
    for (const esport of slot.esports) {
      if (!perEsport.has(esport)) perEsport.set(esport, []);
      perEsport.get(esport).push(slot);
      for (const partit of slot.partits) {
        const clau = `${esport}|${partit}`;
        if (!perPartit.has(clau)) perPartit.set(clau, []);
        perPartit.get(clau).push(slot);
      }
    }
  }

  return {
    llista: meus,
    perEsport,
    /** Les franges d'un esport que no són cap partit concret: les dates límit a part. */
    esport: (id) => perEsport.get(id) ?? [],
    limits: (id) => (perEsport.get(id) ?? []).filter((slot) => slot.tipus === 'limit'),
    /**
     * Quan es juga un partit concret. Els esports que es despatxen d'una tirada (natació,
     * escacs…) no en tenen: la seva franja es mostra un sol cop, a dalt de la fitxa.
     */
    partit: (esport, id) => perPartit.get(`${esport}|${id}`)?.[0] ?? null,
  };
}

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
      el('p', { class: 'ajuda', text: "La resta de la web funciona igualment. Revisa la fila del full de càlcul o el fitxer de datos/ que diu l'avís (mira l'apartat final del README)." }),
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
