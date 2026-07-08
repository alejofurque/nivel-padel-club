/* =========================================================
   Configuración central del club — única fuente de verdad
   ========================================================= */

const CONFIG = {
  NOMBRE_CLUB: 'Nivel Padel Club',
  CANTIDAD_CANCHAS: 12,
  DURACION_TURNO_MIN: 90,
  HORA_APERTURA: '08:00',
  HORA_CIERRE: '23:00',
  STORAGE_KEY: 'nivelpadel_reservas_v1',
};

// Bloques fijos de 90 minutos entre 08:00 y 23:00 → 10 bloques por cancha
const BLOQUES = (() => {
  const bloques = [];
  let min = 8 * 60;
  const cierre = 23 * 60;
  while (min + CONFIG.DURACION_TURNO_MIN <= cierre) {
    const h = String(Math.floor(min / 60)).padStart(2, '0');
    const m = String(min % 60).padStart(2, '0');
    bloques.push(`${h}:${m}`);
    min += CONFIG.DURACION_TURNO_MIN;
  }
  return bloques;
})();

const CANCHAS = Array.from({ length: CONFIG.CANTIDAD_CANCHAS }, (_, i) => i + 1);

// Capacidad total: canchas × bloques disponibles
const CAPACIDAD_DIARIA = CONFIG.CANTIDAD_CANCHAS * BLOQUES.length;
const CAPACIDAD_SEMANAL = CAPACIDAD_DIARIA * 7;

// Estados del turno
const ESTADOS = {
  pendiente:  { label: 'Pendiente',  color: 'amarillo' },
  confirmada: { label: 'Confirmada', color: 'verde' },
  cancelada:  { label: 'Cancelada',  color: 'gris' },
  finalizada: { label: 'Finalizada', color: 'azul' },
  no_asistio: { label: 'No asistió', color: 'naranja' },
};

// Estados del pago
const PAGOS = {
  sin_sena:  { label: 'Sin seña',          color: 'gris' },
  sena:      { label: 'Seña abonada',      color: 'azul' },
  pagado:    { label: 'Pagado',            color: 'verde' },
  pendiente: { label: 'Pendiente de pago', color: 'amarillo' },
};

const MEDIOS_PAGO = ['No definido', 'Efectivo', 'Transferencia', 'Mercado Pago'];

// Mensajes obligatorios del sistema
const MSG_DUPLICADO = 'No se puede registrar esta reserva porque la cancha ya está ocupada en ese día y horario.';
const MSG_TEL_INVALIDO = 'Teléfono inválido o incompleto.';
const MSG_REINCIDENCIA = 'Cliente con reincidencia de no asistencia.';
