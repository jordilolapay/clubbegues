# Olimpíades 2026 — Club de Begues

Web dels quadres i la classificació de les Olimpíades. **No cal saber programar per mantenir-la.**
Durant el torneig només s'editen **dos fitxers**, un per competició:
`datos/resultados.json` (masculí) i `datos/resultados-femenino.json` (femení).

La web es publica sola a GitHub Pages: quan guardes un canvi, al cap d'un minut ja es veu.

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
| Fitxer que s'edita | `datos/resultados.json` | `datos/resultados-femenino.json` |

Les dues classificacions **no es barregen**: són equips diferents i cadascuna té la seva taula.

---

## 1. Què hi ha a cada fitxer

| Fitxer | Per a què serveix | El toques? |
|---|---|---|
| `datos/resultados.json` | Resultats de la competició **masculina** | **Sí, cada dia** |
| `datos/resultados-femenino.json` | Resultats de la competició **femenina** | **Sí, cada dia** |
| `datos/torneo.json` | Equips masculins, punts de cada categoria, llista d'esports | Només al principi |
| `datos/femenino.json` | Equips femenins, els seus punts i el calendari de la lliga | Només al principi |
| `datos/cuadros.json` | Qui juga contra qui a les prèvies i als quarts (masculí) | **Mai** |
| `js/textos.js` | Els noms en català que es veuen a la web | Rarament |
| La resta (`index.html`, `deporte.html`, `css/`, `js/`) | La web en si | No |

`datos/cuadros.json` és el resultat d'un repartiment estudiat perquè tots els equips juguin en
condicions equivalents. Si el canvies, es trenca l'equilibri del torneig.

El calendari de la lliga femenina (`jornadas`, dins de `datos/femenino.json`) tampoc s'ha de tocar:
ja està fet perquè totes juguin contra totes i cada jornada en descansi una.

---

## 2. Posar els noms reals dels equips

Els equips masculins són a `datos/torneo.json` i els femenins a `datos/femenino.json`, però
funcionen exactament igual. A dalt de tot de cada fitxer hi ha la llista:

```json
{ "id": "E1", "nombre": "Equip 1", "color": null },
```

Canvia **només** el que hi ha entre cometes darrere de `"nombre"`:

```json
{ "id": "E1", "nombre": "Els Senglars", "color": null },
```

> ⚠️ **L'`id` no es toca mai** (`E1`…`E10` en masculí, `F1`…`F5` en femení). És el codi intern que
> fan servir els altres fitxers. Si el canvies, la web deixa de trobar l'equip.

Si vols un color concret per a un equip, posa'l en comptes de `null`: `"color": "#C0392B"`.
Amb `null` la web ja n'hi assigna un.

---

## 3. Apuntar un resultat masculí

### Esports amb quadre (17 esports: petanca, tennis, futbol sala…)

Obre `datos/resultados.json`, busca l'esport i, dins seu, el partit. Posa el **codi de l'equip que
guanya** i el marcador.

**Abans:**

```json
"petanca": {
  "previa1": { "ganador": null, "marcador": "" },
```

**Després** (ha guanyat l'equip E5 per 13 a 8):

```json
"petanca": {
  "previa1": { "ganador": "E5", "marcador": "13-8" },
```

I ja està. **No cal escriure qui juga el partit següent**: la web ho calcula sola. En apuntar el
guanyador de `previa1`, aquest equip apareix automàticament als quarts, i el que perd apareix al
partit pel 9è i 10è lloc.

El `marcador` és text lliure: pots posar `"13-8"`, `"3-1"`, `"2-0 (pròrroga)"` o deixar-ho buit
(`""`). Només es mostra, no es fa servir per a res més.

**Els 15 partits de cada esport:**

| Clau al fitxer | Què és |
|---|---|
| `previa1`, `previa2` | Les dues eliminatòries prèvies |
| `qf1`, `qf2`, `qf3`, `qf4` | Quarts de final |
| `sf1`, `sf2` | Semifinals |
| `final` | Decideix 1r i 2n |
| `tercerPuesto` | Decideix 3r i 4t |
| `consSf1`, `consSf2` | Semifinals de consolació (els que perden a quarts) |
| `consFinal` | Decideix 5è i 6è |
| `consTercero` | Decideix 7è i 8è |
| `puesto9` | Decideix 9è i 10è (els que perden les prèvies) |

### Ciclisme, atletisme i natació

Aquests no tenen eliminatòries: s'apunta l'ordre d'arribada, del primer al desè.

**Abans:**

```json
"ciclismo": { "clasificacion": [null, null, null, null, null, null, null, null, null, null] }
```

**Després** (ha guanyat E3, segon E7, tercer E1, la resta encara no se sap):

```json
"ciclismo": { "clasificacion": ["E3", "E7", "E1", null, null, null, null, null, null, null] }
```

Deixa `null` a les posicions que encara no estiguin decidides.

### Regles del format JSON (importants)

- Els codis d'equip van **entre cometes**: `"E5"`. El `null` va **sense** cometes.
- Cada línia acaba amb una coma, **menys l'última** de cada bloc.
- Si t'equivoques amb una coma o una cometa, la web avisarà (mira l'apartat 7).

---

## 4. Apuntar un resultat femení

S'edita `datos/resultados-femenino.json`. Funciona igual, però com que en femení els 17 esports es
juguen com una **lliga de totes contra totes**, els partits no es diuen `previa1` o `sf2` sinó
**pels dos equips que hi juguen**: `"F1-F2"`, `"F4-F5"`…

**Abans:**

```json
"petanca": {
  "F1-F2": { "ganador": null, "marcador": "" },
```

**Després** (ha guanyat F1 per 13 a 9):

```json
"petanca": {
  "F1-F2": { "ganador": "F1", "marcador": "13-9" },
```

Cada esport té **10 partits** (cada equip en juga 4) i estan escrits en l'ordre del calendari, o
sigui que els trobaràs agrupats per jornada, igual que a la web:

| Jornada | Partits | Descansa |
|---|---|---|
| 1 | `F1-F2`, `F4-F5` | F3 |
| 2 | `F2-F5`, `F3-F4` | F1 |
| 3 | `F1-F5`, `F2-F3` | F4 |
| 4 | `F1-F4`, `F5-F3` | F2 |
| 5 | `F1-F3`, `F4-F2` | F5 |

⚠️ La clau del partit s'ha d'escriure **tal com ja surt al fitxer**. Si el partit és `"F1-F2"`, no
val escriure `"F2-F1"`: la web avisarà que aquest partit no és al calendari.

### Com s'ordena la taula

No hi ha empats als partits: o guanya una o guanya l'altra. La taula s'ordena així:

1. Per **victòries**.
2. Si dues equips empaten a victòries, mana el **partit que han jugat entre elles**.
3. Si encara estan empatades, comparteixen lloc (a la web surt `3r=`) i **es reparteixen a parts
   iguals** els punts dels llocs que ocupen.

Si voleu desfer un empat a mà (per sorteig, per exemple), afegiu una línia `desempate` a l'esport
amb els equips en l'ordre que decidiu:

```json
"petanca": {
  "desempate": ["F3", "F1"],
  "F1-F2": { "ganador": "F1", "marcador": "13-9" },
```

### Els punts de la general només compten al final

Una lliga **no reparteix punts a la classificació general fins que s'han jugat els 10 partits**,
perquè fins a l'últim partit qualsevol posició pot canviar. Mentrestant la web mostra en gris els
punts que es repartirien si la lliga acabés ara.

(En masculí és diferent: un lloc decidit ja no es mou, o sigui que puntua de seguida.)

### Ciclisme, atletisme i natació femenins

Igual que en masculí però amb **5 llocs** en comptes de 10:

```json
"ciclismo": { "clasificacion": ["F3", "F2", null, null, null] }
```

---

## 5. Canviar el nom d'un esport a la web

Els noms que es veuen són a `js/textos.js`, a la llista `NOMS_ESPORTS`:

```js
'futbol-siete': 'Futbol 7',
```

Canvia només el text de la dreta. El de l'esquerra és el codi intern i no es toca.

---

## 6. Publicar els canvis

**Des de github.com (el més fàcil):**

1. Entra al repositori i obre el fitxer de resultats que toqui (`datos/resultados.json` per al
   masculí, `datos/resultados-femenino.json` per al femení).
2. Clica la icona del llapis (✏️) per editar.
3. Fes el canvi.
4. Baixa fins al final, escriu una descripció curta (per exemple `Resultats petanca dissabte`) i
   clica **Commit changes**.
5. Espera un minut i recarrega la web.

**Des de l'ordinador**, si tens el repositori baixat:

```bash
git add datos/resultados.json
git commit -m "Resultats petanca dissabte"
git push
```

Si has recarregat i no veus el canvi, prova de recarregar forçant (Ctrl+F5, o Cmd+Shift+R al Mac).

---

## 7. Si surt un avís vermell a la web

La web comprova les dades cada vegada que es carrega i, si troba res estrany, ho diu en un requadre
vermell a dalt. **La resta de la web continua funcionant.** Els avisos més habituals:

| Què diu | Què vol dir | Com s'arregla |
|---|---|---|
| *El guanyador "E5" … no és cap dels dos participants* | Has apuntat com a guanyador un equip que no juga aquell partit | Mira el quadre a la web i posa el codi correcte |
| *… fa servir l'equip desconegut "E11"* | Codi d'equip mal escrit | En masculí només existeixen `E1`…`E10`; en femení, `F1`…`F5` |
| *Hi ha guanyador però encara no se sap qui hi juga* | Has apuntat un partit del quadre abans que l'anterior | Apunta primer el partit que hi porta |
| *El partit "F2-F1" … no és al calendari* | Has canviat l'ordre dels equips a la clau del partit | Escriu la clau tal com ja surt al fitxer (`"F1-F2"`) |
| *L'equip … surt més d'un cop a la classificació* | Un equip repetit a ciclisme/atletisme/natació | Treu-lo de la posició sobrant |
| *La classificació … té 10 posicions i n'hi hauria d'haver 5* | Has copiat una llista del fitxer masculí al femení | El femení té 5 llocs, no 10 |
| *No s'han pogut carregar les dades* | El JSON té un error de format (una coma o una cometa) | Desfés l'últim canvi i torna-hi amb calma |

Si t'has equivocat i no en surts, a GitHub pots recuperar la versió anterior del fitxer des de
l'historial (pestanya **History** del fitxer).

---

## 8. Provar-ho a l'ordinador abans de publicar (opcional)

La web llegeix els JSON amb `fetch`, i això no funciona obrint el fitxer amb doble clic. Cal servir
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
té la seva classificació general, i cadascuna suma els punts dels seus 20 esports.
