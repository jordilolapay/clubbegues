# Olimpíades 2026 — Club de Begues

Web dels quadres i la classificació de les Olimpíades. **No cal saber programar per mantenir-la.**
Durant el torneig només s'edita **un fitxer**: `datos/resultados.json`.

La web es publica sola a GitHub Pages: quan guardes un canvi, al cap d'un minut ja es veu.

---

## 1. Què hi ha a cada fitxer

| Fitxer | Per a què serveix | El toques? |
|---|---|---|
| `datos/resultados.json` | Qui guanya cada partit i amb quin marcador | **Sí, cada dia** |
| `datos/torneo.json` | Noms dels equips, punts de cada categoria, llista d'esports | Només al principi |
| `datos/cuadros.json` | Qui juga contra qui a les prèvies i als quarts | **Mai** |
| `js/textos.js` | Els noms en català que es veuen a la web | Rarament |
| La resta (`index.html`, `deporte.html`, `css/`, `js/`) | La web en si | No |

`datos/cuadros.json` és el resultat d'un repartiment estudiat perquè tots els equips juguin en
condicions equivalents. Si el canvies, es trenca l'equilibri del torneig.

---

## 2. Posar els noms reals dels equips

Obre `datos/torneo.json`. A dalt de tot hi ha la llista d'equips:

```json
{ "id": "E1", "nombre": "Equip 1", "color": null },
```

Canvia **només** el que hi ha entre cometes darrere de `"nombre"`:

```json
{ "id": "E1", "nombre": "Els Senglars", "color": null },
```

> ⚠️ **L'`id` (`E1`, `E2`… `E10`) no es toca mai.** És el codi intern que fan servir els altres
> fitxers. Si el canvies, la web deixa de trobar l'equip.

Si vols un color concret per a un equip, posa'l en comptes de `null`: `"color": "#C0392B"`.
Amb `null` la web ja n'hi assigna un.

---

## 3. Apuntar un resultat (el dia a dia)

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
- Si t'equivoques amb una coma o una cometa, la web avisarà (mira l'apartat 6).

---

## 4. Canviar el nom d'un esport a la web

Els noms que es veuen són a `js/textos.js`, a la llista `NOMS_ESPORTS`:

```js
'futbol-siete': 'Futbol 7',
```

Canvia només el text de la dreta. El de l'esquerra és el codi intern i no es toca.

---

## 5. Publicar els canvis

**Des de github.com (el més fàcil):**

1. Entra al repositori i obre `datos/resultados.json`.
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

## 6. Si surt un avís vermell a la web

La web comprova les dades cada vegada que es carrega i, si troba res estrany, ho diu en un requadre
vermell a dalt. **La resta de la web continua funcionant.** Els avisos més habituals:

| Què diu | Què vol dir | Com s'arregla |
|---|---|---|
| *El guanyador "E5" … no és cap dels dos participants* | Has apuntat com a guanyador un equip que no juga aquell partit | Mira el quadre a la web i posa el codi correcte |
| *… fa servir l'equip desconegut "E11"* | Codi d'equip mal escrit | Només existeixen `E1` … `E10` |
| *Hi ha guanyador però encara no se sap qui hi juga* | Has apuntat un partit abans que l'anterior | Apunta primer el partit que hi porta |
| *L'equip … surt més d'un cop a la classificació* | Un equip repetit a ciclisme/atletisme/natació | Treu-lo de la posició sobrant |
| *No s'han pogut carregar les dades* | El JSON té un error de format (una coma o una cometa) | Desfés l'últim canvi i torna-hi amb calma |

Si t'has equivocat i no en surts, a GitHub pots recuperar la versió anterior del fitxer des de
l'historial (pestanya **History** del fitxer).

---

## 7. Provar-ho a l'ordinador abans de publicar (opcional)

La web llegeix els JSON amb `fetch`, i això no funciona obrint el fitxer amb doble clic. Cal servir
la carpeta per HTTP. Amb Python:

```bash
python3 -m http.server 8000
```

I obre `http://localhost:8000` al navegador.

---

## Com funciona el torneig (per si algú ho pregunta)

Hi ha 10 equips i el quadre és de 8, així que a cada esport:

1. **Dues prèvies**: 4 equips juguen, 6 queden exempts.
2. **Quarts**: els dos guanyadors de prèvia entren a QF1 i QF3, en meitats oposades del quadre.
3. **Semifinals i final** (1r/2n) i partit pel 3r i 4t lloc.
4. **Consolació**: els quatre que perden a quarts es juguen del 5è al 8è lloc.
5. **9è i 10è**: els dos que perden les prèvies.

Sempre se saben les 10 posicions, o sigui que **tots els equips puntuen a tots els esports**.
Els punts depenen de la categoria de l'esport (esports d'equip, individuals o de resistència) i es
poden consultar a la capçalera de cada esport. La classificació general els suma tots.
