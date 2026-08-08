// datos.js — carrega i guarda en memòria els tres JSON de datos/.

const CARPETA = new URL('../datos/', import.meta.url);

let promesa = null;

async function llegir(nom) {
  let resposta;
  try {
    // no-cache: si un organitzador acaba d'editar resultados.json, volem veure'l ja.
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

/** Carrega els tres fitxers un sol cop per pàgina. */
export function carregarDades() {
  if (!promesa) {
    promesa = (async () => {
      const [torneig, quadres, resultats] = await Promise.all([
        llegir('torneo.json'),
        llegir('cuadros.json'),
        llegir('resultados.json'),
      ]);
      return { torneig, quadres, resultats };
    })();
  }
  return promesa;
}
