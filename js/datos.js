// datos.js — carrega les dades del torneig.
//
// Els resultats i els noms dels equips surten del full de càlcul de Google (js/config.js).
// Els fitxers de datos/ són la xarxa de seguretat: sempre es llegeixen, i és el que es fa
// servir si el full de càlcul no està configurat o no es pot llegir.

import { llegirFull } from './full.js';

const CARPETA = new URL('../datos/', import.meta.url);

let promesa = null;

async function llegir(nom) {
  let resposta;
  try {
    // no-cache: si un organitzador acaba d'editar un resultat, volem veure'l ja.
    resposta = await fetch(new URL(nom, CARPETA), { cache: 'no-cache' });
  } catch (e) {
    throw new Error(
      `No s'ha pogut llegir datos/${nom}. Si has obert el fitxer amb doble clic, cal servir la web per HTTP (a GitHub Pages funciona).`
    );
  }
  if (!resposta.ok) throw new Error(`No s'ha pogut llegir datos/${nom} (error ${resposta.status}).`);
  try {
    return await resposta.json();
  } catch (e) {
    throw new Error(`datos/${nom} no és un JSON vàlid: ${e.message}`);
  }
}

/** Posa al full de càlcul l'última paraula sobre els noms (i colors) dels equips. */
function aplicarNoms(config, noms) {
  for (const equip of config.equipos) {
    const nou = noms.get(equip.id);
    if (!nou) continue;
    equip.nombre = nou.nombre;
    if (nou.color) equip.color = nou.color;
  }
}

/** Carrega totes les dades un sol cop per pàgina. */
export function carregarDades() {
  if (!promesa) {
    promesa = (async () => {
      const [torneig, quadres, resultats, femeni, resultatsFemeni, horaris] = await Promise.all([
        llegir('torneo.json'),
        llegir('cuadros.json'),
        llegir('resultados.json'),
        llegir('femenino.json'),
        llegir('resultados-femenino.json'),
        llegir('horarios.json'),
      ]);
      const dades = { torneig, quadres, resultats, femeni, resultatsFemeni, horaris, avisos: [], full: false };

      // Si hi ha full de càlcul configurat, mana ell. El que no se'n pugui llegir es queda
      // amb el que digui datos/ i el motiu surt al bàner d'avisos.
      const delFull = await llegirFull(dades);
      dades.avisos = delFull.avisos;
      if (delFull.noms) {
        aplicarNoms(torneig, delFull.noms);
        aplicarNoms(femeni, delFull.noms);
      }
      if (delFull.resultats) { dades.resultats = delFull.resultats; dades.full = true; }
      if (delFull.resultatsFemeni) { dades.resultatsFemeni = delFull.resultatsFemeni; dades.full = true; }
      if (delFull.horaris) dades.horaris = delFull.horaris;

      return dades;
    })();
  }
  return promesa;
}
