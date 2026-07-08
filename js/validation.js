/* =========================================================
   Validaciones de negocio — centralizadas y reutilizables.
   La regla anti-duplicados vive acá y es la ÚNICA puerta de
   entrada para guardar reservas (alta y edición).
   ========================================================= */

const Validation = {

  /**
   * Busca una reserva activa (no cancelada) que ocupe la misma
   * combinación fecha + hora + cancha.
   * @param {string} fecha   - YYYY-MM-DD
   * @param {string} hora    - HH:MM
   * @param {number} cancha  - número de cancha
   * @param {string} [excluirId] - id a ignorar (al editar, la reserva
   *                               no debe detectarse a sí misma)
   * @returns {object|null} la reserva en conflicto, o null si está libre
   */
  buscarConflicto(fecha, hora, cancha, excluirId = null) {
    return Store.getAll().find(r =>
      r.id !== excluirId &&
      r.fecha === fecha &&
      r.hora === hora &&
      Number(r.cancha) === Number(cancha) &&
      r.estado !== 'cancelada'
    ) || null;
  },

  /**
   * Valida los datos de una reserva antes de guardar.
   * @returns {{ok: boolean, errores: string[]}}
   */
  validarReserva(datos, excluirId = null) {
    const errores = [];

    if (!datos.cliente || !datos.cliente.trim()) errores.push('El nombre del cliente es obligatorio.');
    if (!datos.telefono || !datos.telefono.trim()) {
      errores.push('El teléfono es obligatorio.');
    } else if (!WhatsApp.esTelefonoValido(datos.telefono)) {
      errores.push(MSG_TEL_INVALIDO);
    }
    if (!datos.fecha) errores.push('La fecha es obligatoria.');
    if (!datos.hora) errores.push('La hora es obligatoria.');
    if (!datos.cancha) errores.push('La cancha es obligatoria.');
    if (datos.monto !== '' && datos.monto != null && Number(datos.monto) < 0) {
      errores.push('El monto no puede ser negativo.');
    }

    // Regla crítica anti-duplicados
    if (datos.fecha && datos.hora && datos.cancha && datos.estado !== 'cancelada') {
      const conflicto = Validation.buscarConflicto(datos.fecha, datos.hora, datos.cancha, excluirId);
      if (conflicto) errores.push(MSG_DUPLICADO);
    }

    return { ok: errores.length === 0, errores };
  },

  /**
   * Devuelve el conjunto de teléfonos (normalizados) con 2 o más
   * reservas en estado "No asistió" → alerta de reincidencia.
   * @returns {Map<string, {cliente: string, faltas: number}>}
   */
  clientesReincidentes() {
    const faltasPorTel = new Map();
    for (const r of Store.getAll()) {
      if (r.estado !== 'no_asistio') continue;
      const tel = WhatsApp.limpiarTelefono(r.telefono);
      if (!tel) continue;
      const info = faltasPorTel.get(tel) || { cliente: r.cliente, faltas: 0 };
      info.faltas += 1;
      faltasPorTel.set(tel, info);
    }
    for (const [tel, info] of faltasPorTel) {
      if (info.faltas < 2) faltasPorTel.delete(tel);
    }
    return faltasPorTel;
  },

  esReincidente(telefono, reincidentes) {
    return reincidentes.has(WhatsApp.limpiarTelefono(telefono));
  },
};
