// config.js — l'ÚNIC fitxer que cal tocar per connectar el full de càlcul de Google.
//
// Com trobar l'identificador: obre el full de càlcul i mira l'adreça del navegador.
//
//   https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0
//                                          └────────── això és l'identificador ──────────┘
//
// Enganxa'l entre les cometes de sota. Si el deixes buit, la web torna a llegir
// els fitxers de datos/ i tot funciona igual (és la xarxa de seguretat).
//
// IMPORTANT: el full de càlcul ha d'estar compartit amb "Qualsevol amb l'enllaç: lector".
// Si no, el navegador de la gent no el pot llegir.

export const FULL = {
  id: '',

  // Els noms de les tres pestanyes del full de càlcul. Si les reanomenes, canvia-ho aquí.
  pestanyes: {
    equips: 'Equips',
    masculi: 'Masculí',
    femeni: 'Femení',
  },
};
