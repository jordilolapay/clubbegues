# Web estática — Torneo Multideporte

Brief de implementación. Los datos del torneo **ya están generados** en `datos/`: no hay que
inventarlos ni recalcularlos, solo leerlos y pintarlos.

---

## 1. Objetivo

Página web estática que muestra los cuadros de 20 deportes de un torneo entre 10 equipos, más
una clasificación general. Se actualiza **editando ficheros JSON a mano** y haciendo push: no hay
backend, ni base de datos, ni panel de administración.

Se publica en GitHub Pages, así que **todo debe funcionar abriendo `index.html` sobre HTTP
estático**, sin paso de build.

---

## 2. Stack

- HTML + CSS + JavaScript vanilla (ES modules). **Sin framework, sin bundler, sin dependencias npm.**
- Los datos se cargan con `fetch()` de los JSON de `datos/`.
- Debe funcionar en móvil (mucha gente lo mirará desde el teléfono durante el torneo).

> Si al implementarlo ves razones de peso para usar otra cosa, **pregunta antes de cambiar el
> stack**. La prioridad es que cualquiera pueda editar un JSON y ver el cambio publicado.

---

## 3. Estructura del repositorio

```
/
├── index.html              Clasificación general + rejilla de deportes
├── deporte.html            Cuadro de un deporte  (?id=futbol-sala)
├── css/estilos.css
├── js/
│   ├── datos.js            carga y cachea los 3 JSON
│   ├── motor.js            lógica del torneo (ver §6) — sin tocar el DOM
│   ├── general.js          pinta index.html
│   └── cuadro.js           pinta deporte.html
├── datos/
│   ├── torneo.json         equipos, categorías, tabla de puntos, lista de deportes
│   ├── cuadros.json        emparejamientos fijos de los 17 cuadros
│   └── resultados.json     ← EL ÚNICO QUE SE EDITA DURANTE EL TORNEO
└── README.md               instrucciones de uso para los organizadores
```

`motor.js` debe ser **puro** (entra JSON, sale estado calculado). Así se puede testear y se evita
duplicar lógica entre las dos páginas.

---

## 4. Ficheros de datos

### 4.1 `datos/torneo.json` — configuración

```jsonc
{
  "nombre": "Torneo Multideporte",
  "equipos": [ { "id": "E1", "nombre": "Equipo 1", "color": null }, ... ],   // 10 equipos
  "categorias": {
    "equipo":      { "etiqueta": "...", "puntos": [70,54,48,42,30,25,20,15,10,5] },
    "resistencia": { "etiqueta": "...", "puntos": [50,37,33,29,25,21,17,13,9,5] },
    "individual":  { "etiqueta": "...", "puntos": [40,32,29,26,20,17,14,11,8,5] }
  },
  "gruposAfines": { "voleibol": { "etiqueta": "Voleibol", "color": "#F5A623" }, ... },
  "deportes": [
    { "id": "petanca", "nombre": "Petanca", "categoria": "individual",
      "formato": "cuadro", "grupoAfin": null },
    ...
  ]
}
```

- **`equipos[].nombre` es lo que edita el organizador** para poner los nombres reales. El `id`
  (`E1`…`E10`) no se toca nunca: es la clave que usan los otros dos ficheros.
- `equipos[].color` es opcional (`null` = asigna un color de paleta automáticamente).
- El array `puntos` es posición 1 → índice 0, hasta posición 10 → índice 9.
- `formato` es `"cuadro"` (17 deportes) o `"clasificacion"` (ciclismo, atletismo, natación:
  no hay eliminatoria, se apunta el orden de llegada directamente).
- `grupoAfin` solo sirve para colorear y agrupar visualmente.

### 4.2 `datos/cuadros.json` — emparejamientos

Una entrada por cada deporte con `formato: "cuadro"`. **Esto es fijo, no se edita jamás**: es el
resultado de una optimización de equidad (reparto de previas, no repetición de cruces entre
deportes parecidos, equilibrio entre deportes que puntúan alto y bajo).

```jsonc
"petanca": {
  "previa1":   ["E5", "E9"],       // se enfrentan en la eliminatoria previa 1
  "previa2":   ["E7", "E3"],
  "qf1Rival":  "E1",               // espera en cuartos al ganador de previa1
  "qf2":       ["E4", "E8"],
  "qf3Rival":  "E2",               // espera al ganador de previa2
  "qf4":       ["E10", "E6"],
  "exentos":   ["E1","E4","E8","E2","E10","E6"]   // informativo
}
```

### 4.3 `datos/resultados.json` — lo que se rellena

Deportes con cuadro — 15 partidos, todos presentes desde el principio con `ganador: null`:

```jsonc
"petanca": {
  "previa1":      { "ganador": null, "marcador": "" },
  "previa2":      { "ganador": null, "marcador": "" },
  "qf1": ..., "qf2": ..., "qf3": ..., "qf4": ...,
  "sf1": ..., "sf2": ...,
  "final":        { "ganador": null, "marcador": "" },   // 1º / 2º
  "tercerPuesto": { "ganador": null, "marcador": "" },   // 3º / 4º
  "consSf1": ..., "consSf2": ...,                        // consolación
  "consFinal":    { "ganador": null, "marcador": "" },   // 5º / 6º
  "consTercero":  { "ganador": null, "marcador": "" },   // 7º / 8º
  "puesto9":      { "ganador": null, "marcador": "" }    // 9º / 10º
}
```

- `ganador` = id de equipo (`"E7"`) o `null` si no se ha jugado.
- `marcador` = texto libre (`"21-18"`, `"3-1"`, `""`). Solo se muestra, no se interpreta.

Deportes sin cuadro:

```jsonc
"ciclismo": { "clasificacion": ["E3","E7",null,null,null,null,null,null,null,null] }
```

Array de 10 posiciones en orden 1º→10º. Los `null` finales son posiciones aún sin decidir.

---

## 5. Formato del torneo (contexto)

Con 10 equipos y cuadro de 8, cada deporte funciona así:

1. **Dos eliminatorias previas.** 4 equipos juegan, 6 quedan exentos.
2. **Cuartos.** Los 2 ganadores de previa entran en QF1 y QF3 (mitades opuestas del cuadro).
3. **Cuadro principal.** Semifinales → final (1º/2º) y partido por el 3º/4º.
4. **Cuadro de consolación.** Los 4 perdedores de cuartos juegan semifinales de consolación →
   final de consolación (5º/6º) y partido por el 7º/8º.
5. **Puesto 9.** Los 2 perdedores de las previas se enfrentan (9º/10º).

Se conocen **siempre las 10 posiciones**, así que todos los equipos puntúan en todos los deportes.

---

## 6. Lógica a implementar (`motor.js`)

### 6.1 Propagación del cuadro

Los participantes de cada partido **se derivan**, nunca se escriben a mano:

| Partido | Participantes |
|---|---|
| `previa1` | `cuadros.previa1` |
| `previa2` | `cuadros.previa2` |
| `qf1` | ganador de `previa1` · `cuadros.qf1Rival` |
| `qf2` | `cuadros.qf2` |
| `qf3` | ganador de `previa2` · `cuadros.qf3Rival` |
| `qf4` | `cuadros.qf4` |
| `sf1` | ganadores de `qf1` y `qf2` |
| `sf2` | ganadores de `qf3` y `qf4` |
| `final` | ganadores de `sf1` y `sf2` |
| `tercerPuesto` | perdedores de `sf1` y `sf2` |
| `consSf1` | perdedores de `qf1` y `qf2` |
| `consSf2` | perdedores de `qf3` y `qf4` |
| `consFinal` | ganadores de `consSf1` y `consSf2` |
| `consTercero` | perdedores de `consSf1` y `consSf2` |
| `puesto9` | perdedores de `previa1` y `previa2` |

El **perdedor** de un partido es el participante que no es `ganador`. Si un partido tiene los dos
participantes conocidos pero `ganador: null`, está *pendiente*. Si le falta algún participante,
está *bloqueado*.

### 6.2 Posiciones finales

| Pos | Se obtiene | | Pos | Se obtiene |
|---|---|---|---|---|
| 1º | ganador `final` | | 6º | perdedor `consFinal` |
| 2º | perdedor `final` | | 7º | ganador `consTercero` |
| 3º | ganador `tercerPuesto` | | 8º | perdedor `consTercero` |
| 4º | perdedor `tercerPuesto` | | 9º | ganador `puesto9` |
| 5º | ganador `consFinal` | | 10º | perdedor `puesto9` |

Para `formato: "clasificacion"`, la posición es el índice del equipo en el array + 1.

### 6.3 Puntuación y clasificación general

Para cada deporte y equipo con posición conocida:
`puntos = torneo.categorias[deporte.categoria].puntos[posicion - 1]`

La general suma los puntos de todos los deportes. **Los deportes sin terminar suman lo que ya se
sepa** (si ya hay 1º y 2º decididos pero no el resto, esos dos ya puntúan). Empates en la general:
ordenar por puntos, luego por número de primeros puestos, luego por segundos, y así.

### 6.4 Validación

Al cargar, comprobar y avisar en consola (y con un banner discreto en la página) si:

- un `ganador` no es uno de los dos participantes derivados del partido,
- un id de equipo no existe en `torneo.equipos`,
- un array `clasificacion` tiene duplicados o ids desconocidos,
- falta un deporte en `cuadros.json` o `resultados.json`.

Un error en un deporte **no debe romper el resto de la página**.

---

## 7. Interfaz

### 7.1 `index.html`

- **Clasificación general**: tabla ordenada, posición, nombre, puntos totales, desglose por
  categoría (equipo / resistencia / individual) y medallero (oros / platas / bronces = primeros,
  segundos y terceros puestos). Destacar el líder.
- **De dónde salen los puntos**: bajo la tabla, los deportes agrupados en cerrados (ya han
  repartido todos sus puntos), a medias (los cuadros ya suman los puestos decididos; las ligas
  no reparten nada hasta acabar) y por empezar.
- **Rejilla de deportes**: una tarjeta por deporte con su nombre, color del grupo afín, un
  indicador de progreso (partidos jugados / total) y, si ya hay campeón, quién es. Enlaza a
  `deporte.html?id=...`.
- Filtro o agrupación por categoría.

### 7.2 `deporte.html?id=...`

- Cabecera con el deporte, su categoría y los puntos que reparte.
- **Cuadro visual**: previas → cuartos → semis → final, en columnas de izquierda a derecha, con
  el cuadro de consolación debajo y el partido de 9º/10º aparte. Cada partido muestra los dos
  equipos, el marcador si lo hay, y resalta al ganador. Los partidos pendientes se ven en gris
  y los bloqueados con un placeholder (`Ganador QF1`).
- **Tabla de posiciones finales** del deporte con los puntos que se lleva cada uno.
- En móvil el cuadro debe poder verse con scroll horizontal sin romperse.
- Para `formato: "clasificacion"`, en vez del cuadro, solo la tabla de posiciones.

### 7.3 Estilo

Legible en el móvil a plena luz: contraste alto, tipografía de buen tamaño, nada de gris claro
sobre blanco. Usar los colores de `gruposAfines` como acento, no como fondo de bloques grandes.

---

## 8. `README.md` para los organizadores

Al terminar, escribe un README **para alguien que no programa**, explicando:

1. Cómo cambiar los nombres de los equipos (`datos/torneo.json` → `equipos[].nombre`).
2. Cómo apuntar un resultado: buscar el deporte en `datos/resultados.json`, buscar el partido,
   poner el id del ganador y el marcador. Con un ejemplo antes/después.
3. Que los ids `E1`…`E10` no se tocan.
4. Que `datos/cuadros.json` no se toca nunca.
5. Cómo publicar (commit + push, GitHub Pages tarda un minuto).
6. Qué hacer si sale el banner de error.

---

## 9. Orden sugerido

1. `datos.js` + `motor.js` con la propagación y la puntuación. Verificarlo rellenando a mano un
   deporte entero en `resultados.json` y comprobando que salen las 10 posiciones bien.
2. `deporte.html` con el cuadro.
3. `index.html` con la general.
4. Estilos y responsive.
5. `README.md`.

Empieza por el motor: si la propagación está bien, el resto es pintar.
