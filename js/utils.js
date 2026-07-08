/* =========================================================
   Utilidades: fechas, formato, DOM y notificaciones
   ========================================================= */

const Utils = {

  // ---- Fechas (siempre en formato local YYYY-MM-DD, sin UTC) ----

  hoyISO() {
    return Utils.dateToISO(new Date());
  },

  dateToISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  isoToDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  sumarDias(iso, dias) {
    const d = Utils.isoToDate(iso);
    d.setDate(d.getDate() + dias);
    return Utils.dateToISO(d);
  },

  // Lunes de la semana a la que pertenece la fecha
  lunesDeSemana(iso) {
    const d = Utils.isoToDate(iso);
    const dia = d.getDay(); // 0 = domingo
    const offset = dia === 0 ? -6 : 1 - dia;
    d.setDate(d.getDate() + offset);
    return Utils.dateToISO(d);
  },

  // Los 7 días (ISO) de la semana de la fecha dada
  diasDeSemana(iso) {
    const lunes = Utils.lunesDeSemana(iso);
    return Array.from({ length: 7 }, (_, i) => Utils.sumarDias(lunes, i));
  },

  fechaLegible(iso) {
    const txt = Utils.isoToDate(iso).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  },

  fechaCorta(iso) {
    return Utils.isoToDate(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  },

  diaSemanaCorto(iso) {
    const txt = Utils.isoToDate(iso).toLocaleDateString('es-AR', { weekday: 'short' });
    return txt.charAt(0).toUpperCase() + txt.slice(1).replace('.', '');
  },

  // ---- Formato ----

  moneda(n) {
    return '$ ' + (Number(n) || 0).toLocaleString('es-AR');
  },

  porcentaje(n) {
    return (n * 100).toFixed(0) + '%';
  },

  escapeHTML(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  },

  normalizarBusqueda(str) {
    return String(str ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  uid() {
    return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  },

  // ---- Notificaciones (toasts) ----

  toast(mensaje, tipo = 'ok') {
    const cont = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.textContent = mensaje;
    cont.appendChild(el);
    setTimeout(() => el.classList.add('visible'), 10);
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 300);
    }, 3200);
  },
};
