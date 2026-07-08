/* =========================================================
   Store: persistencia en localStorage + operaciones CRUD
   Reemplaza al "cuaderno de papel". En una versión futura,
   este módulo se sustituye por llamadas a una API real sin
   tocar el resto de la aplicación.
   ========================================================= */

const Store = {

  _cache: null,

  _leer() {
    if (Store._cache) return Store._cache;
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      Store._cache = raw ? JSON.parse(raw) : [];
    } catch {
      Store._cache = [];
    }
    return Store._cache;
  },

  _guardar(lista) {
    Store._cache = lista;
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(lista));
  },

  getAll() {
    return Store._leer();
  },

  getById(id) {
    return Store._leer().find(r => r.id === id) || null;
  },

  getPorFecha(fecha) {
    return Store._leer()
      .filter(r => r.fecha === fecha)
      .sort((a, b) => a.hora.localeCompare(b.hora) || a.cancha - b.cancha);
  },

  getPorRango(desdeISO, hastaISO) {
    return Store._leer().filter(r => r.fecha >= desdeISO && r.fecha <= hastaISO);
  },

  crear(datos) {
    const ahora = new Date().toISOString();
    const reserva = { ...datos, id: Utils.uid(), createdAt: ahora, updatedAt: ahora };
    const lista = Store._leer();
    lista.push(reserva);
    Store._guardar(lista);
    return reserva;
  },

  actualizar(id, cambios) {
    const lista = Store._leer();
    const idx = lista.findIndex(r => r.id === id);
    if (idx === -1) return null;
    lista[idx] = { ...lista[idx], ...cambios, id, updatedAt: new Date().toISOString() };
    Store._guardar(lista);
    return lista[idx];
  },

  cambiarEstado(id, estado) {
    return Store.actualizar(id, { estado });
  },

  reemplazarTodo(lista) {
    Store._guardar(lista);
  },

  // ---- Exportación a CSV (separador ";" para Excel en español) ----

  exportarCSV() {
    const cols = [
      ['id', r => r.id],
      ['cliente', r => r.cliente],
      ['telefono', r => r.telefono],
      ['fecha', r => r.fecha],
      ['hora', r => r.hora],
      ['duracion_min', r => r.duracion],
      ['cancha', r => r.cancha],
      ['estado_turno', r => ESTADOS[r.estado]?.label || r.estado],
      ['estado_pago', r => PAGOS[r.pago]?.label || r.pago],
      ['medio_pago', r => r.medioPago],
      ['monto', r => r.monto],
      ['observaciones', r => r.obs],
      ['creada', r => r.createdAt],
      ['actualizada', r => r.updatedAt],
    ];
    const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const filas = [cols.map(c => esc(c[0])).join(';')];
    const lista = [...Store._leer()].sort((a, b) =>
      a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora) || a.cancha - b.cancha);
    for (const r of lista) filas.push(cols.map(c => esc(c[1](r))).join(';'));

    const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reservas_nivel_padel_${Utils.hoyISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    return lista.length;
  },
};
