// Torna a generar els CSV de datos/plantilla-full/ a partir de datos/torneo.json i
// datos/femenino.json. Només cal executar-ho si canvia la llista d'esports, els equips
// o el calendari de la lliga femenina:
//
//     node eines/generar-plantilla.mjs
//
// Després, importa els CSV nous a les pestanyes del full de càlcul (apartat 1 del README).
// Ull: importar-los buida el que hi hagi apuntat.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { ESQUEMA_PARTITS } from '../js/motor.js';
import { NOMS_ESPORTS, NOMS_PARTITS } from '../js/textos.js';

const ARREL = new URL('..', import.meta.url).pathname;
const json = (nom) => JSON.parse(readFileSync(`${ARREL}datos/${nom}`, 'utf8'));

const torneig = json('torneo.json');
const femeni = json('femenino.json');

const cela = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
const csv = (files) => `${files.map((f) => f.map(cela).join(',')).join('\n')}\n`;
const nomEsport = (e) => NOMS_ESPORTS[e.id] ?? e.nombre;
const nomPartit = (id) => NOMS_PARTITS[id]?.llarg ?? id;

/* Pestanya Equips */
const equips = [['Competició', 'Id', 'Nom', 'Color']];
for (const e of torneig.equipos) equips.push(['Masculí', e.id, e.nombre, e.color ?? '']);
for (const e of femeni.equipos) equips.push(['Femení', e.id, e.nombre, e.color ?? '']);

/* Pestanya Masculí: 15 partits per esport de quadre, 10 llocs per esport de classificació */
const masculi = [['Esport', 'Partit', 'Guanyador', 'Marcador']];
for (const esport of torneig.deportes) {
  if (esport.formato === 'clasificacion') {
    for (let i = 1; i <= torneig.equipos.length; i++) masculi.push([nomEsport(esport), `Lloc ${i}`, '', '']);
  } else {
    for (const { id } of ESQUEMA_PARTITS) masculi.push([nomEsport(esport), nomPartit(id), '', '']);
  }
}

/* Pestanya Femení: els 10 partits de la lliga per esport, en ordre de calendari */
const nomsFemenins = new Map(femeni.equipos.map((e) => [e.id, e.nombre]));
const fem = [['Esport', 'Jornada', 'Partit', 'Qui juga', 'Guanyador', 'Marcador']];
for (const esport of torneig.deportes) {
  if (esport.formato === 'clasificacion') {
    for (let i = 1; i <= femeni.equipos.length; i++) fem.push([nomEsport(esport), '', `Lloc ${i}`, '', '', '']);
  } else {
    for (const jornada of femeni.jornadas) {
      for (const [local, visitant] of jornada.partidos) {
        fem.push([
          nomEsport(esport), `J${jornada.jornada}`, `${local}-${visitant}`,
          `${nomsFemenins.get(local)} - ${nomsFemenins.get(visitant)}`, '', '',
        ]);
      }
    }
  }
}

const carpeta = `${ARREL}datos/plantilla-full`;
mkdirSync(carpeta, { recursive: true });
writeFileSync(`${carpeta}/equips.csv`, csv(equips));
writeFileSync(`${carpeta}/masculi.csv`, csv(masculi));
writeFileSync(`${carpeta}/femeni.csv`, csv(fem));
console.log(`Fet: equips ${equips.length - 1} files · masculí ${masculi.length - 1} · femení ${fem.length - 1}`);
