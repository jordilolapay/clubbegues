// Menú de tres línies per a mòbil.
(function () {
  var boto = document.getElementById('menu-boto');
  var menu = document.getElementById('menu-principal');
  if (!boto || !menu) return;

  function tancar() {
    menu.classList.remove('obert');
    boto.setAttribute('aria-expanded', 'false');
    boto.setAttribute('aria-label', 'Obrir el menú');
  }

  boto.addEventListener('click', function () {
    var obert = menu.classList.toggle('obert');
    boto.setAttribute('aria-expanded', obert ? 'true' : 'false');
    boto.setAttribute('aria-label', obert ? 'Tancar el menú' : 'Obrir el menú');
  });

  // En triar una opció o en prémer Escape, es tanca.
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) tancar();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') tancar();
  });
})();
