/* =========================================================
   Store: fachada de datos con caché en memoria.
   - Modo "nube": persiste en Supabase (tabla reservations).
   - Modo "local": persiste en localStorage (fallback académico
     cuando Supabase no está configurado).
   Las LECTURAS son síncronas sobre la caché (los renders y la
   validación anti-duplicados no cambian); las ESCRITURAS son
   async: primero la base, después la caché.
   ========================================================= */

const Store = {

  _cache: [],
  modo: 'local', // 'local' | 'nube'

  async inicializar() {
    if (DB.configurado) {
      Store.modo = 'nube';
      Store._cache = await DB.listar();
    } else {
      Store.modo = 'local';
      try {
        const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
        Store._cache = raw ? JSON.parse(raw) : [];
      } catch {
        Store._cache = [];
      }
    }
  },

  _guardarLocal() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(Store._cache));
  },

  // ---- Lecturas (síncronas, sobre caché) ----

  getAll() {
    return Store._cache;
  },

  getById(id) {
    return Store._cache.find(r => r.id === id) || null;
  },

  getPorFecha(fecha) {
    return Store._cache
      .filter(r => r.fecha === fecha)
      .sort((a, b) => a.hora.localeCompare(b.hora) || a.cancha - b.cancha);
  },

  getPorRango(desdeISO, hastaISO) {
    return Store._cache.filter(r => r.fecha >= desdeISO && r.fecha <= hastaISO);
  },

  // ---- Escrituras (async: primero la base, después la caché) ----

  async crear(datos) {
    const ahora = new Date().toISOString();
    const usuario = Auth.usuario()?.username || 'local';
    const reserva = { ...datos, creadoPor: usuario, actualizadoPor: usuario, createdAt: ahora, updatedAt: ahora };

    let guardada;
    if (Store.modo === 'nube') {
      guardada = await DB.insertar(reserva);
    } else {
      guardada = { ...reserva, id: Utils.uid() };
    }
    Store._cache.push(guardada);
    if (Store.modo === 'local') Store._guardarLocal();
    return guardada;
  },

  async actualizar(id, cambios) {
    const idx = Store._cache.findIndex(r => r.id === id);
    if (idx === -1) return null;

    const actualizada = {
      ...Store._cache[idx],
      ...cambios,
      id,
      actualizadoPor: Auth.usuario()?.username || 'local',
      updatedAt: new Date().toISOString(),
    };

    if (Store.modo === 'nube') {
      Store._cache[idx] = await DB.actualizar(id, actualizada);
    } else {
      Store._cache[idx] = actualizada;
      Store._guardarLocal();
    }
    return Store._cache[idx];
  },

  async cambiarEstado(id, estado) {
    return Store.actualizar(id, { estado });
  },

  async reemplazarTodo(lista) {
    if (Store.modo === 'nube') {
      await DB.eliminarTodo();
      Store._cache = lista.length ? await DB.insertarLote(lista) : [];
    } else {
      Store._cache = lista;
      Store._guardarLocal();
    }
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
      ['creada_por', r => r.creadoPor || ''],
      ['actualizada_por', r => r.actualizadoPor || ''],
    ];
    const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const filas = [cols.map(c => esc(c[0])).join(';')];
    const lista = [...Store._cache].sort((a, b) =>
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
