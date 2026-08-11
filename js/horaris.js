// horaris.js — pinta horaris.html: el calendari dia a dia, amb filtres.

import {
  COMPETICIONS, acaba, adreca, buida, carregarTorneig, competicioDeLaAdreca, el, franja, inicia,
  mostrarErrorGreu, mostrarErrors, nomDia, selectorCompeticio, textIncognita,
} from './comu.js';
import { NOMS_PARTITS, nomEsport } from './textos.js';

const zonaSelector = document.querySelector('#selector');
const zonaErrors = document.querySelector('#errors');
const zonaFiltres = document.querySelector('#filtres-horaris');
const zonaCalendari = document.querySelector('#calendari');
const zonaSubtitol = document.querySelector('#subtitol');
const enllacTornar = document.querySelector('#tornar');

const competicio = competicioDeLaAdreca();
const params = new URLSearchParams(location.search);

let dades = null;
let filtres = { esport: params.get('esport') ?? '', equip: params.get('equip') ?? '' };

/** Els filtres que estan posats, per portar-los a l'adreça. */
const netejar = (valors) => Object.fromEntries(Object.entries(valors).filter(([, v]) => v));

init();

async function init() {
  zonaSelector.append(selectorCompeticio(competicio, 'horaris.html', netejar(filtres)));
  enllacTornar.href = adreca('index.html', competicio);
  const { adjectiu } = COMPETICIONS[competicio];
  zonaSubtitol.textContent = `Competició ${adjectiu}`;
  document.title = `Horaris ${adjectiu} · Olimpíades 2026 - Club de Begues`;

  try {
    dades = await carregarTorneig(competicio);
  } catch (e) {
    mostrarErrorGreu(zonaErrors, e);
    buida(zonaCalendari);
    return;
  }

  mostrarErrors(zonaErrors, dades.errors);
  pintarFiltres();
  pintarCalendari();
}

/** Canvia un filtre i ho deixa reflectit a l'adreça, perquè es pugui compartir l'enllaç. */
function canviarFiltre(quin, valor) {
  filtres = { ...filtres, [quin]: valor };
  const nova = adreca('horaris.html', competicio, netejar(filtres));
  history.replaceState(null, '', nova);
  pintarCalendari();
}

/* ---------- Filtres ---------- */

function pintarFiltres() {
  const equips = [...dades.equips.values()];
  const ambHoraris = dades.esports.filter((estat) => dades.horaris.esport(estat.id).length);

  buida(zonaFiltres).append(
    tria('Esport', 'Tots els esports', filtres.esport,
      ambHoraris.map((estat) => [estat.id, nomEsport(estat.esport)]),
      (valor) => canviarFiltre('esport', valor)),
    tria('Equip', 'Tots els equips', filtres.equip,
      equips.map((equip) => [equip.id, equip.nombre]),
      (valor) => canviarFiltre('equip', valor)),
  );
}

function tria(etiqueta, buit, valor, opcions, quanCanvia) {
  const select = el('select', { id: `filtre-${etiqueta.toLowerCase()}` }, [
    el('option', { value: '', text: buit }),
    ...opcions.map(([id, text]) => el('option', { value: id, text, selected: id === valor ? 'selected' : null })),
  ]);
  select.value = valor;
  select.addEventListener('change', () => quanCanvia(select.value));
  return el('label', { class: 'filtre-camp' }, [el('span', { text: etiqueta }), select]);
}

/* ---------- Qui juga ---------- */

/**
 * Els partits d'una franja que són d'aquesta competició. Una franja sense competició (perquè
 * s'hi juga el masculí i el femení alhora) porta els partits de totes dues, i cadascuna només
 * ha de veure els seus.
 */
const partitsDe = (estat, slot) => slot.partits.filter((id) => estat?.partits?.[id]);

/** Els dos equips d'un partit, o d'on sortiran si encara no se sap. */
function participants(estat, idPartit) {
  const partit = estat?.partits?.[idPartit];
  if (!partit) return [];
  return partit.participants.map((id, i) => ({
    id,
    nom: id ? dades.equips.get(id)?.nombre ?? id : textIncognita(idPartit, i),
    guanya: Boolean(partit.guanyador) && id === partit.guanyador,
    perd: Boolean(partit.guanyador) && Boolean(id) && id !== partit.guanyador,
  }));
}

/** Un horari afecta un equip si hi juga, o si és una prova on hi són tots. */
function hiJuga(slot, idEquip) {
  if (!idEquip) return true;
  if (slot.tipus === 'acte') return false;
  if (slot.tot || !slot.partits.length) return true;
  return slot.esports.some((esport) => {
    const estat = dades.perId.get(esport);
    return partitsDe(estat, slot).some((idPartit) =>
      participants(estat, idPartit).some((p) => p.id === idEquip));
  });
}

/* ---------- Calendari ---------- */

function pintarCalendari() {
  const ara = new Date();
  const visibles = dades.horaris.llista.filter((slot) =>
    (!filtres.esport || slot.esports.includes(filtres.esport)) && hiJuga(slot, filtres.equip)
  );

  buida(zonaCalendari);
  if (!visibles.length) {
    zonaCalendari.append(el('div', { class: 'buit' }, [
      el('p', { text: dades.horaris.llista.length ? 'Cap partit amb aquests filtres.' : "Encara no hi ha horaris apuntats al full de càlcul." }),
    ]));
    return;
  }

  // Un bloc per dia, en ordre.
  const dies = new Map();
  for (const slot of visibles) {
    if (!dies.has(slot.data)) dies.set(slot.data, []);
    dies.get(slot.data).push(slot);
  }

  const avui = new Date().toISOString().slice(0, 10);
  let primerDiaViu = null;

  for (const [data, slots] of dies) {
    const passat = slots.every((slot) => acaba(slot) < ara);
    const bloc = el('section', { class: `dia${passat ? ' dia--passat' : ''}`, id: `dia-${data}` }, [
      el('h2', {}, [
        el('span', { text: nomDia(data) }),
        data === avui && el('span', { class: 'etiqueta etiqueta--avui', text: 'Avui' }),
      ]),
      el('div', { class: 'franges' }, slots.map((slot) => targetaHorari(slot, ara))),
    ]);
    if (!passat && !primerDiaViu) primerDiaViu = bloc;
    zonaCalendari.append(bloc);
  }

  // Es va directament al primer dia que encara no ha passat, que és el que interessa.
  if (primerDiaViu && !filtres.esport && !filtres.equip) {
    primerDiaViu.scrollIntoView({ block: 'start' });
  }
}

function targetaHorari(slot, ara) {
  const enJoc = inicia(slot) <= ara && ara < acaba(slot);
  const passat = acaba(slot) < ara;
  const classes = ['franja', slot.tipus === 'limit' && 'franja--limit', slot.tipus === 'acte' && 'franja--acte',
    enJoc && 'franja--ara', passat && 'franja--passat'].filter(Boolean);

  return el('article', { class: classes.join(' ') }, [
    el('div', { class: 'franja-quan' }, [
      el('span', { class: 'hora', text: slot.tipus === 'limit' ? 'Data límit' : franja(slot) }),
      slot.lloc && el('span', { class: 'lloc', text: slot.lloc }),
      enJoc && el('span', { class: 'ara', text: 'Ara' }),
    ]),
    el('div', { class: 'franja-que' }, contingut(slot)),
  ]);
}

function contingut(slot) {
  if (slot.tipus === 'acte') {
    return [el('p', { class: 'acte', text: slot.nota || 'Acte de les Olimpíades' })];
  }

  return slot.esports.map((id) => {
    const estat = dades.perId.get(id);
    const titol = el('a', {
      class: 'franja-esport',
      href: adreca('deporte.html', competicio, { id }),
      text: estat ? nomEsport(estat.esport) : id,
    });

    if (slot.tipus === 'limit') {
      return el('div', {}, [
        titol,
        el('p', { class: 'nota', text: `S'ha d'haver jugat: ${llistaPartits(slot)}.` }),
      ]);
    }

    if (slot.tot || !slot.partits.length) {
      return el('div', {}, [titol, el('p', { class: 'nota', text: slot.nota || "Es juga tot l'esport." })]);
    }

    const meus = partitsDe(estat, slot);
    if (!meus.length) return null; // la franja és de l'altra competició

    return el('div', {}, [
      titol,
      ...meus.map((idPartit) => partitEnLlista(estat, idPartit)),
      slot.nota && el('p', { class: 'nota', text: slot.nota }),
    ]);
  }).filter(Boolean);
}

/** Els noms dels partits d'una data límit: "Quarts 1, Quarts 2…". */
const llistaPartits = (slot) =>
  slot.partits.map((id) => NOMS_PARTITS[id]?.llarg ?? id).join(', ');

function partitEnLlista(estat, idPartit) {
  const noms = NOMS_PARTITS[idPartit];
  const jugadors = participants(estat, idPartit);

  return el('div', { class: 'franja-partit' }, [
    noms && el('span', { class: 'sigla', text: noms.sigla }),
    jugadors.length
      ? el('span', { class: 'contra' }, jugadors.flatMap((jugador, i) => [
          i > 0 && el('span', { class: 'vs', text: ' – ' }),
          el('span', {
            class: ['equip', jugador.guanya && 'equip--guanya', jugador.perd && 'equip--perd', !jugador.id && 'equip--incognita'].filter(Boolean).join(' '),
            text: jugador.nom,
          }),
        ]).filter(Boolean))
      : el('span', { class: 'contra', text: noms?.llarg ?? idPartit }),
  ]);
}
