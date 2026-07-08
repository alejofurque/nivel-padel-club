/* =========================================================
   Copiloto de mensajes + integración con WhatsApp.
   El copiloto genera mensajes dinámicos según el estado de la
   reserva (plantillas inteligentes, sin costo de API). El
   módulo también normaliza teléfonos argentinos y arma links
   wa.me con el mensaje precargado.
   ========================================================= */

const WhatsApp = {

  /**
   * Limpia espacios, guiones, paréntesis y otros caracteres.
   * Devuelve solo dígitos, o '' si no hay nada rescatable.
   */
  limpiarTelefono(telefono) {
    return String(telefono || '').replace(/\D/g, '');
  },

  /** Un teléfono es utilizable si tiene al menos 10 dígitos. */
  esTelefonoValido(telefono) {
    return WhatsApp.limpiarTelefono(telefono).length >= 10;
  },

  /**
   * Normaliza a formato internacional argentino para wa.me:
   * - "351 555 0101"      → 5493515550101
   * - "+54 9 351 5550101" → 5493515550101
   * - "54 351 5550101"    → 549 + resto
   */
  telefonoInternacional(telefono) {
    let d = WhatsApp.limpiarTelefono(telefono);
    if (!d) return '';
    if (d.startsWith('549')) return d;
    if (d.startsWith('54')) return '549' + d.slice(2);
    if (d.startsWith('0')) d = d.slice(1);
    return '549' + d;
  },

  telefonoVisible(telefono) {
    const num = WhatsApp.telefonoInternacional(telefono);
    if (!num) return 'Sin teléfono cargado';
    return '+' + num;
  },

  linkWhatsApp(telefono, mensaje) {
    const num = WhatsApp.telefonoInternacional(telefono);
    return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
  },

  // ---- Plantillas del copiloto ----

  TIPOS: [
    { id: 'confirmacion', label: '✅ Confirmación', desc: 'Confirmar el turno al cliente' },
    { id: 'sena',         label: '💵 Pedir seña',   desc: 'Solicitar seña o comprobante' },
    { id: 'recordatorio', label: '⏰ Recordatorio', desc: 'Recordar el turno de hoy' },
    { id: 'cancelacion',  label: '🚫 Cancelación',  desc: 'Confirmar cancelación registrada' },
  ],

  /**
   * Sugiere el tipo de mensaje más útil según el estado actual
   * de la reserva — el toque "inteligente" del copiloto.
   */
  tipoSugerido(reserva) {
    if (reserva.estado === 'cancelada') return 'cancelacion';
    if (reserva.estado === 'pendiente' && (reserva.pago === 'sin_sena' || reserva.pago === 'pendiente')) return 'sena';
    if (reserva.fecha === Utils.hoyISO() && reserva.estado === 'confirmada') return 'recordatorio';
    return 'confirmacion';
  },

  generarMensaje(tipo, reserva) {
    const nombre = (reserva.cliente || '').trim().split(/\s+/)[0] || 'cliente';
    const fecha = Utils.fechaLegible(reserva.fecha).toLowerCase();
    const hora = reserva.hora;
    const cancha = reserva.cancha;
    const club = CONFIG.NOMBRE_CLUB;

    switch (tipo) {
      case 'confirmacion':
        return `Hola ${nombre}, te confirmamos tu turno en ${club} para el día ${fecha} a las ${hora}, en Cancha ${cancha}. Te esperamos.`;
      case 'sena':
        return `Hola ${nombre}, dejamos pre-reservado tu turno en ${club} para el día ${fecha} a las ${hora}, en Cancha ${cancha}. Para confirmarlo, te pedimos enviar la seña o el comprobante por este medio. Gracias.`;
      case 'recordatorio':
        return `Hola ${nombre}, te recordamos que hoy tenés turno en ${club} a las ${hora}, en Cancha ${cancha}. Te recomendamos llegar 10 minutos antes. Te esperamos.`;
      case 'cancelacion':
        return `Hola ${nombre}, registramos la cancelación de tu turno en ${club} para el día ${fecha} a las ${hora}. Gracias por avisar.`;
      default:
        return '';
    }
  },
};
