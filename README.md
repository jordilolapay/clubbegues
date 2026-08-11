# Olimpíades 2026 — Club de Begues

Web dels quadres i la classificació de les Olimpíades. **No cal saber programar per mantenir-la.**

Durant el torneig els resultats i els horaris s'apunten en un **full de càlcul de Google**. La web
el llegeix cada vegada que algú l'obre: apuntes un resultat, l'altra persona recarrega la pàgina i
ja el veu. No cal tocar el repositori ni esperar res.

Els fitxers de `datos/` continuen existint com a **xarxa de seguretat**: si un dia el full de càlcul
no es pot llegir, la web tira d'ells i ho avisa a dalt (apartat 9).

---

## 0. Les dues competicions

Hi ha dues competicions independents, amb la seva pròpia classificació general. A la web es canvia
d'una a l'altra amb els botons **MASCULÍ / FEMENÍ** de dalt.

| | Masculí | Femení |
|---|---|---|
| Equips | 10 (`E1`…`E10`) | 5 (`F1`…`F5`) |
| Com es juguen els 17 esports | Quadre eliminatori amb prèvies i consolació | **Lliga**: totes contra totes a una sola volta |
| Ciclisme, atletisme i natació | Ordre d'arribada (10 llocs) | Ordre d'arribada (5 llocs) |
| Punts del 1r lloc (esports d'equip) | 70 | 70 |
| On s'apunten els resultats | Pestanya **Masculí** del full de càlcul | Pestanya **Femení** del full de càlcul |

Les dues classificacions **no es barregen**: són equips diferents i cadascuna té la seva taula.

---

## 1. Preparar el full de càlcul (una sola vegada)

**1. Crea el full de càlcul.** Ves a [sheets.new](https://sheets.new) i posa-li un nom, per exemple
*Olimpíades 2026 — resultats*.

**2. Fes quatre pestanyes** i anomena-les **exactament** així (amb accents i majúscules):

```
Equips     Masculí     Femení     Calendari
```

**3. Omple-les amb les plantilles.** A la carpeta `datos/plantilla-full/` d'aquest repositori hi ha
quatre fitxers ja preparats, amb tots els esports i tots els partits en el seu ordre:

| Fitxer | Pestanya | Files |
|---|---|---|
| `equips.csv` | Equips | 15 equips (10 masculins + 5 femenins) |
| `masculi.csv` | Masculí | 295 (17 esports × 15 partits + 4 esports × 10 llocs) |
| `femeni.csv` | Femení | 190 (17 esports × 10 partits + 4 esports × 5 llocs) |
| `calendari.csv` | Calendari | 128 franges (dia, hora, lloc i què s'hi juga) |

Per a cada un: descarrega'l de GitHub (obre el fitxer i clica **Download raw file**) i, al full de
càlcul, situa't a la pestanya que toqui i fes **Fitxer › Importa › Penja**. A la finestra que surt
tria **Substitueix el full actual** i, com a separador, **Coma**.

**4. Comparteix-lo.** Clica **Comparteix** i, a *Accés general*, posa **Qualsevol amb l'enllaç** amb
el permís **Lector**. Sense això el navegador de la gent no el pot llegir.

> Compartir-lo com a *lector* vol dir que qualsevol pot **veure'l**. Per **editar-lo** només podran
> les persones que hi afegeixis una per una a *Comparteix*. Dona permís d'edició només a qui hagi
> d'apuntar resultats.

**5. Digues-li a la web quin full és.** Copia l'adreça del full de càlcul del navegador:

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0
                                       └──────────── això és l'identificador ────────────┘
```

Obre `js/config.js`, enganxa'l entre les cometes de `id:` i guarda (apartat 7 per publicar-ho):

```js
export const FULL = {
  id: '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890',
```

Pots enganxar-hi l'adreça sencera si vols; la web ja en treu l'identificador.

Això és l'únic pas que es fa al repositori. A partir d'aquí, tot el dia a dia és al full de càlcul.

---

## 2. Els noms dels equips — pestanya **Equips**

| Competició | Id | Nom | Color |
|---|---|---|---|
| Masculí | E1 | Els Senglars | |
| Masculí | E2 | Equip 2 | `#C0392B` |
| … | | | |
| Femení | F1 | Les Àligues | |

Escriu el nom de veritat de cada equip a la columna **Nom**. Es veurà a tota la web de seguida.

- **La columna `Id` no es toca mai** (`E1`…`E10` en masculí, `F1`…`F5` en femení). És el codi que
  fan servir la resta de pestanyes; si el canvies, la web deixa de trobar l'equip.
- La columna **Color** és opcional: posa-hi un color en format `#RRGGBB` si en vols un de concret.
  Si la deixes buida, la web ja n'assigna un.

---

## 3. Apuntar un resultat masculí — pestanya **Masculí**

Quatre columnes: **Esport · Partit · Guanyador · Marcador**. Les dues primeres ja venen omplertes i
no s'han de tocar. Tu només escrius a **Guanyador** (i a **Marcador**, si vols).

| Esport | Partit | Guanyador | Marcador |
|---|---|---|---|
| Petanca | Prèvia 1 | `E5` | 13-8 |
| Petanca | Prèvia 2 | | |

**No cal escriure qui juga el partit següent**: la web ho calcula sola. En apuntar el guanyador de
la Prèvia 1, aquest equip apareix automàticament als quarts, i el que perd apareix al partit pel 9è
i 10è lloc.

A **Guanyador** hi pots posar el codi (`E5`) o el nom de l'equip tal com l'has escrit a la pestanya
Equips (`Els Senglars`). Tant li fa majúscules, accents o espais de més.

El **Marcador** és text lliure: `13-8`, `3-1`, `2-0 (pròrroga)` o buit. Només es mostra.

> 💡 Per no equivocar-se escrivint noms: selecciona la columna Guanyador i fes
> **Dades › Validació de dades › Llista d'un interval**, amb l'interval `Equips!C2:C11`. Així surt
> un desplegable amb els equips.

**Els 15 partits de cada esport** (és el que ja diu la columna Partit):

| Partit | Què és |
|---|---|
| Prèvia 1, Prèvia 2 | Les dues eliminatòries prèvies |
| Quarts 1 … Quarts 4 | Quarts de final |
| Semifinal 1, Semifinal 2 | Semifinals |
| Final | Decideix 1r i 2n |
| 3r i 4t lloc | Decideix 3r i 4t |
| Semifinal consolació 1 i 2 | Els que perden a quarts |
| Final consolació · 5è i 6è lloc | Decideix 5è i 6è |
| 7è i 8è lloc | Decideix 7è i 8è |
| 9è i 10è lloc | Els que perden les prèvies |

### Ciclisme, atletisme, natació i minigolf

Aquests no tenen eliminatòries: la columna Partit diu **Lloc 1**, **Lloc 2**… fins a **Lloc 10**, i
a Guanyador hi poses qui ha quedat en aquell lloc. Deixa buits els llocs que encara no se sàpiguen.

| Esport | Partit | Guanyador | Marcador |
|---|---|---|---|
| Natació | Lloc 1 | `E3` | 2:41 |
| Natació | Lloc 2 | `E7` | 2:48 |
| Natació | Lloc 3 | | |

Aquí el **Marcador** també és opcional, i serveix per apuntar la marca de cada equip (el temps, els
cops…). Si n'hi ha alguna d'escrita, a la web surt una columna més al costat de cada equip.

El **minigolf** funciona igual: guanya qui fa **menys cops** en tot el circuit i la resta s'ordenen
de menys a més cops. La web no ordena res tota sola: apunta els equips ja ordenats de *Lloc 1* cap
avall, i posa els cops a Marcador si vols que es vegin.

| Esport | Partit | Guanyador | Marcador |
|---|---|---|---|
| Minigolf | Lloc 1 | `E4` | 38 |
| Minigolf | Lloc 2 | `E1` | 41 |

---

## 4. Apuntar un resultat femení — pestanya **Femení**

Igual que la masculina, però com que en femení els 17 esports es juguen com una **lliga de totes
contra totes**, els partits no es diuen *Semifinal 1* sinó **pels dos equips que hi juguen**:

| Esport | Jornada | Partit | Qui juga | Guanyador | Marcador |
|---|---|---|---|---|---|
| Petanca | J1 | `F1-F2` | Les Àligues - Equip femení 2 | `F1` | 13-9 |
| Petanca | J1 | `F4-F5` | … | | |

La columna **Qui juga** és només perquè es llegeixi bé: la web no la mira (i no s'actualitza sola si
canvies un nom a la pestanya Equips). La que compta és **Partit**.

Cada esport té **10 partits** (cada equip en juga 4), en l'ordre del calendari:

| Jornada | Partits | Descansa |
|---|---|---|
| 1 | `F1-F2`, `F4-F5` | F3 |
| 2 | `F2-F5`, `F3-F4` | F1 |
| 3 | `F1-F5`, `F2-F3` | F4 |
| 4 | `F1-F4`, `F5-F3` | F2 |
| 5 | `F1-F3`, `F4-F2` | F5 |

Ciclisme, atletisme, natació i minigolf femenins van per llocs, igual que en masculí però amb
**5 llocs** (de *Lloc 1* a *Lloc 5*).

### Com s'ordena la taula

No hi ha empats als partits: o guanya una o guanya l'altra. La taula s'ordena així:

1. Per **victòries**.
2. Si dos equips empaten a victòries, mana el **partit que han jugat entre elles**.
3. Si encara estan empatades, comparteixen lloc (a la web surt `3r=`) i **es reparteixen a parts
   iguals** els punts dels llocs que ocupen.

Si voleu desfer un empat a mà (per sorteig, per exemple), afegiu una fila més a aquell esport amb la
paraula **Desempat** a la columna Partit i els equips en l'ordre que decidiu, separats per comes:

| Esport | Partit | Guanyador |
|---|---|---|
| Petanca | Desempat | `F3, F1` |

### Els punts de la general només compten al final

Una lliga **no reparteix punts a la classificació general fins que s'han jugat els 10 partits**,
perquè fins a l'últim partit qualsevol posició pot canviar. Mentrestant la web mostra en gris els
punts que es repartirien si la lliga acabés ara.

(En masculí és diferent: un lloc decidit ja no es mou, o sigui que puntua de seguida.)

---

## 5. Els horaris — pestanya **Calendari**

És la pestanya que fa que la web sàpiga **quan i on** es juga cada cosa. Amb ella, cada partit
surt amb el dia i l'hora a sota, hi ha una pàgina d'**Horaris** amb el calendari sencer i a la
portada surt què s'està jugant ara mateix.

Una fila és **una franja**: una estona, en un lloc, amb una cosa que s'hi juga.

| Data | Hora | Tipus | Lloc | Competició | Esport | Partit | Nota |
|---|---|---|---|---|---|---|---|
| 17/08/2026 | 21-22h | | Poliesportiu | Masculí | Handbol | Quarts 1 | |
| 22/08/2026 | 15:00-16:00 | | Poliesportiu | Femení | Voleibol pista | F1-F2, F4-F5 | |
| 15/08/2026 | 9-14h | | Club de Begues | | Natació | Tot | Inauguració |
| 21/08/2026 | | Límit | | Masculí | Petanca, Dòmino | Quarts 1, Quarts 2 | |
| 29/08/2026 | 21-23h | Acte | Club de Begues | | | | Sopar de cloenda |

- **Data**: `22/08/2026`, `22/08` o `2026-08-22`; tant li fa.
- **Hora**: `21-22h`, `21:00-22:00` o només `21h`. Les hores de matinada (de 0 a 6) s'apunten al
  **dia d'abans**, com a la graella: el partit de les `0-1h` de la nit de dissabte va a dissabte.
- **Tipus**: buit vol dir que és un partit. `Límit` és una data màxima sense hora (§ més avall) i
  `Acte` és una cosa que no és cap esport (la reunió, el sopar).
- **Lloc**: text lliure, el que vulguis que es llegeixi: `Poliesportiu`, `Camp de futbol`…
- **Competició**: `Masculí` o `Femení`. **Deixa-la buida si és de totes dues** (natació, minigolf,
  escacs…): llavors surt a les dues bandes de la web.
- **Esport**: com a les altres pestanyes. Se'n pot posar més d'un separats per comes.
- **Partit**: aquí va **el mateix nom que a la pestanya de resultats** — `Prèvia 1`, `Quarts 1`,
  `Final`, `9è i 10è lloc` en masculí; `F1-F2` en femení. Si en aquella estona se'n juga més d'un,
  posa'ls separats per comes. Si es juga **tot l'esport de cop** (natació, escacs, minigolf),
  escriu-hi **`Tot`**.
- **Nota**: text lliure que surt a la web sota el partit. És on va «Inauguració», «Cross», etc.

**No cal omplir-ho tot.** Un esport sense cap franja simplement no ensenya horaris; la resta de
la web funciona igual.

### Els esports que es juguen quan es vol

Petanca, dòmino, tennis, frontó, pàdel i billar no tenen hora: cada partit es juga quan les dues
parts es posen d'acord, però abans d'una **data límit** per ronda. Això s'apunta amb `Límit` a la
columna Tipus, l'hora en blanc, i a Partit els partits que han d'estar jugats aquell dia. A la
fitxa d'aquests esports, en lloc de les hores hi surt un bloc de dates límit.

### Si canvieu la graella dels horaris

La pestanya **Horaris** (la graella de colors, hores × instal·lacions) **la web no la mira**: és
per mirar-la la gent. Qui mana és **Calendari**. Si canvieu la graella i voleu tornar a generar el
Calendari a partir d'ella:

```bash
node eines/generar-horaris.mjs
```

Això escriu `datos/plantilla-full/calendari.csv` llegint la graella del full de càlcul: els colors
de les caselles (blau = masculí, taronja = femení, verd = totes dues) i les caselles combinades,
que és el que diu quanta estona dura cada cosa. El que no pugui endevinar ho deixa marcat amb
**⚠ REPASSAR** a la columna Nota — repassa aquestes files abans d'importar-lo. (Aquesta marca no
surt mai a la web: és només per a qui manté el full.)

Per refer la còpia de seguretat `datos/horarios.json` amb el que hi hagi ara a la pestanya
Calendari:

```bash
node eines/generar-horaris.mjs --json
```

---

## 6. Canviar el nom d'un esport a la web

Els noms dels esports **no** surten del full de càlcul: són a `js/textos.js`, a la llista
`NOMS_ESPORTS`.

```js
'futbol-siete': 'Futbol 7',
```

Canvia només el text de la dreta. El de l'esquerra és el codi intern i no es toca.

Si canvies un nom aquí, canvia'l també a la columna **Esport** del full de càlcul (o deixa-la com
estava: la web reconeix tant el nom nou com el codi intern).

---

## 7. Quan es veuen els canvis

**El que escrius al full de càlcul** es veu de seguida: guarda (Google guarda sol) i recarrega la
pàgina. Si sembla que no ha canviat, recarrega forçant: **Ctrl+F5** (o **Cmd+Shift+R** al Mac).

**El que canvies al repositori** (`js/config.js`, `js/textos.js`, els fitxers de `datos/`) triga un
minut, perquè GitHub Pages ha de tornar a publicar la web. Des de github.com:

1. Obre el fitxer al repositori i clica la icona del llapis (✏️).
2. Fes el canvi.
3. Baixa fins al final, escriu una descripció curta i clica **Commit changes**.

Des de l'ordinador, si tens el repositori baixat:

```bash
git add js/config.js
git commit -m "Connectar el full de càlcul"
git push
```

---

## 8. Si surt un avís vermell a la web

La web comprova les dades cada vegada que es carrega i, si troba res estrany, ho diu en un requadre
vermell a dalt. **La resta de la web continua funcionant.** Els avisos diuen la pestanya i el número
de fila del full de càlcul, o sigui que es troba de seguida.

| Què diu | Què vol dir | Com s'arregla |
|---|---|---|
| *No s'ha pogut llegir la pestanya "Masculí" del full de càlcul* | O el full no està compartit, o la pestanya no es diu així | Repassa els passos 2 i 4 de l'apartat 1 |
| *A la pestanya "Calendari" hi falta la columna "data"* | Aquella pestanya no existeix, o es diu d'una altra manera | Comprova el nom exacte (apartat 5). Mentrestant els horaris surten de `datos/horarios.json` |
| *Full de càlcul · Calendari, fila 30: "Vuitens 1" no és cap partit* | A la columna Partit hi ha un nom que no existeix | Fes servir el mateix nom que a la pestanya de resultats |
| *Full de càlcul · Masculí, fila 12: "Vuitens 3" no és cap partit de petanca* | S'ha tocat la columna Partit | Torna a posar-hi el text que hi havia |
| *… el guanyador "Els Tigres" no és cap equip d'aquesta competició* | Nom mal escrit, o un equip masculí a la pestanya femenina | Mira els noms a la pestanya Equips |
| *El guanyador "E5" … no és cap dels dos participants* | S'ha apuntat com a guanyador un equip que no juga aquell partit | Mira el quadre a la web i posa l'equip correcte |
| *Hi ha guanyador però encara no se sap qui hi juga* | S'ha apuntat un partit del quadre abans que l'anterior | Apunta primer el partit que hi porta |
| *L'equip … surt més d'un cop a la classificació* | Un equip repetit a ciclisme/atletisme/natació | Treu-lo del lloc sobrant |
| *No s'han pogut carregar les dades* | Un fitxer de `datos/` té un error de format | Desfés l'últim canvi al repositori i torna-hi amb calma |

Tot el que la web no entén, **ho ignora i ho diu**: mai es queda en blanc ni es penja per una fila
mal escrita.

El full de càlcul també té historial: **Fitxer › Historial de versions** per veure qui ha canviat
què i tornar enrere.

---

## 9. Els fitxers de `datos/` (la xarxa de seguretat)

| Fitxer | Per a què serveix | El toques? |
|---|---|---|
| `datos/torneo.json` | Equips masculins, punts de cada categoria, llista dels 21 esports | Rarament |
| `datos/femenino.json` | Equips femenins, els seus punts i el calendari de la lliga | Rarament |
| `datos/cuadros.json` | Qui juga contra qui a les prèvies i als quarts (masculí) | **Mai** |
| `datos/resultados.json` | Resultats masculins de reserva | Només si no hi ha full de càlcul |
| `datos/resultados-femenino.json` | Resultats femenins de reserva | Només si no hi ha full de càlcul |
| `datos/horarios.json` | Els horaris de reserva | Només si no hi ha full de càlcul |
| `datos/plantilla-full/*.csv` | Les plantilles per crear el full de càlcul | Un cop, al principi |
| `eines/generar-plantilla.mjs` | Torna a generar aquestes plantilles si canvia la llista d'esports | Gairebé mai |
| `eines/generar-horaris.mjs` | Passa la graella d'horaris a la pestanya Calendari (apartat 5) | Si canvia la graella |
| `js/config.js` | Quin full de càlcul es llegeix i com es diuen les pestanyes | Un cop, al principi |
| `js/textos.js` | Els noms en català que es veuen a la web | Rarament |
| La resta (`index.html`, `deporte.html`, `horaris.html`, `css/`, `js/`) | La web en si | No |

Mentre `js/config.js` tingui un identificador de full de càlcul, **els fitxers de resultats i
d'horaris no es fan servir**. Serveixen per a dues coses:

- Si el full de càlcul es cau (o s'ha deixat de compartir), la web segueix funcionant amb el que hi
  hagi escrit i avisa del problema.
- Si algun dia voleu deixar de fer servir Google, buideu `id: ''` a `js/config.js` i la web torna a
  llegir aquests fitxers. El format és el mateix que el del full: una entrada per partit amb
  `"ganador"` (el codi de l'equip, entre cometes, o `null`) i `"marcador"`.

`datos/cuadros.json` és el resultat d'un repartiment estudiat perquè tots els equips juguin en
condicions equivalents. Si el canvies, es trenca l'equilibri del torneig. El calendari de la lliga
femenina (`jornadas`, dins de `datos/femenino.json`) tampoc s'ha de tocar: ja està fet perquè totes
juguin contra totes i cada jornada en descansi una.

---

## 10. Provar-ho a l'ordinador abans de publicar (opcional)

La web llegeix les dades amb `fetch`, i això no funciona obrint el fitxer amb doble clic. Cal servir
la carpeta per HTTP. Amb Python:

```bash
python3 -m http.server 8000
```

I obre `http://localhost:8000` al navegador.

---

## Com funciona el torneig (per si algú ho pregunta)

### Masculí: quadre de 8 amb 10 equips

1. **Dues prèvies**: 4 equips juguen, 6 queden exempts.
2. **Quarts**: els dos guanyadors de prèvia entren a QF1 i QF3, en meitats oposades del quadre.
3. **Semifinals i final** (1r/2n) i partit pel 3r i 4t lloc.
4. **Consolació**: els quatre que perden a quarts es juguen del 5è al 8è lloc.
5. **9è i 10è**: els dos que perden les prèvies.

Sempre se saben les 10 posicions, o sigui que tots els equips puntuen a tots els esports.

### Femení: lliga de 5 equips

Totes contra totes a una sola volta: 10 partits per esport, repartits en 5 jornades en què cada
equip en descansa una. Guanyar val 1 punt de lliga i perdre 0; no hi ha empats.

En tots dos casos els punts de les Olimpíades depenen de la categoria de l'esport (esports d'equip,
individuals o de resistència) i es poden consultar a la capçalera de cada esport. Cada competició
té la seva classificació general, i cadascuna suma els punts dels seus 21 esports.
