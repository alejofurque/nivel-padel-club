/* =========================================================
   Datos demo: ~28 reservas realistas distribuidas en la
   semana actual (lunes a domingo). Los estados se adaptan a
   la fecha real de hoy para que la demo siempre sea creíble:
   días pasados → turnos finalizados / no asistidos,
   días futuros → pendientes / confirmados.
   ========================================================= */

const Demo = (() => {

  // Clientes ficticios de Córdoba. El índice 9 (Marcos Gigena) es el
  // cliente reincidente: acumula dos "No asistió" para probar la alerta.
  const CLIENTES = [
    { nombre: 'Juan Pérez',          tel: '351 555 0101' },
    { nombre: 'Valentina Sosa',      tel: '351 555 0102' },
    { nombre: 'Lucas Moyano',        tel: '3512 555 103' },
    { nombre: 'Camila Heredia',      tel: '351-555-0104' },
    { nombre: 'Facundo Quiroga',     tel: '+54 9 351 555 0105' },
    { nombre: 'Agustina Ludueña',    tel: '351 555 0106' },
    { nombre: 'Nicolás Oviedo',      tel: '351 555 0107' },
    { nombre: 'Sofía Bustos',        tel: '351 555 0108' },
    { nombre: 'Matías Ferreyra',     tel: '351 555 0109' },
    { nombre: 'Marcos Gigena',       tel: '351 555 0117' },
    { nombre: 'Julieta Villalba',    tel: '351 555 0110' },
    { nombre: 'Ramiro Altamirano',   tel: '351 555 0111' },
    { nombre: 'Pilar Cabrera',       tel: '351 555 0112' },
    { nombre: 'Gonzalo Juárez',      tel: '351 555 0113' },
    { nombre: 'Carolina Peralta',    tel: '351 555 0114' },
    { nombre: 'Emiliano Roldán',     tel: '351 555 0115' },
    { nombre: 'Renata Figueroa',     tel: '351 555 0116' },
  ];

  // dia: 0=lunes … 6=domingo de la semana actual.
  // forzar: estado fijo independiente de la fecha (para garantizar variedad).
  const PLANTILLA = [
    // Lunes
    { dia: 0, hora: '09:30', cancha: 1,  c: 0,  monto: 24000, obs: 'Cliente fijo de los lunes' },
    { dia: 0, hora: '18:30', cancha: 3,  c: 1,  monto: 28000 },
    { dia: 0, hora: '20:00', cancha: 5,  c: 2,  monto: 28000 },
    { dia: 0, hora: '20:00', cancha: 6,  c: 9,  monto: 28000, forzar: 'no_asistio', obs: 'No avisó, no respondió mensajes' },
    // Martes
    { dia: 1, hora: '08:00', cancha: 2,  c: 3,  monto: 22000, obs: 'Pide paletas prestadas' },
    { dia: 1, hora: '11:00', cancha: 7,  c: 4,  monto: 24000 },
    { dia: 1, hora: '18:30', cancha: 1,  c: 5,  monto: 28000 },
    { dia: 1, hora: '21:30', cancha: 4,  c: 6,  monto: 30000, forzar: 'cancelada', obs: 'Canceló por lluvia' },
    // Miércoles
    { dia: 2, hora: '09:30', cancha: 8,  c: 7,  monto: 24000 },
    { dia: 2, hora: '14:00', cancha: 2,  c: 8,  monto: 24000, obs: 'Clase con profe Martín' },
    { dia: 2, hora: '18:30', cancha: 6,  c: 9,  monto: 28000, forzar: 'no_asistio', obs: 'Segunda vez que falta' },
    { dia: 2, hora: '20:00', cancha: 10, c: 10, monto: 28000 },
    { dia: 2, hora: '21:30', cancha: 11, c: 11, monto: 30000 },
    // Jueves
    { dia: 3, hora: '08:00', cancha: 1,  c: 12, monto: 22000 },
    { dia: 3, hora: '12:30', cancha: 5,  c: 13, monto: 24000 },
    { dia: 3, hora: '17:00', cancha: 9,  c: 14, monto: 26000 },
    { dia: 3, hora: '20:00', cancha: 3,  c: 15, monto: 28000, obs: 'Torneo interno, grupo A' },
    { dia: 3, hora: '20:00', cancha: 4,  c: 16, monto: 28000, obs: 'Torneo interno, grupo B' },
    // Viernes
    { dia: 4, hora: '11:00', cancha: 12, c: 0,  monto: 24000 },
    { dia: 4, hora: '17:00', cancha: 2,  c: 2,  monto: 26000, forzar: 'cancelada', obs: 'Reprogramó para la semana próxima' },
    { dia: 4, hora: '18:30', cancha: 7,  c: 4,  monto: 28000 },
    { dia: 4, hora: '20:00', cancha: 8,  c: 6,  monto: 30000, obs: 'Piden cancha techada' },
    { dia: 4, hora: '21:30', cancha: 1,  c: 8,  monto: 30000 },
    // Sábado
    { dia: 5, hora: '09:30', cancha: 4,  c: 10, monto: 26000 },
    { dia: 5, hora: '11:00', cancha: 5,  c: 12, monto: 26000, forzar: 'no_asistio', obs: 'Avisó tarde que no llegaba' },
    { dia: 5, hora: '17:00', cancha: 6,  c: 14, monto: 28000 },
    { dia: 5, hora: '18:30', cancha: 9,  c: 16, monto: 30000, obs: 'Cumpleaños, piden parrilla' },
    // Domingo
    { dia: 6, hora: '11:00', cancha: 3,  c: 1,  monto: 24000 },
    { dia: 6, hora: '18:30', cancha: 2,  c: 5,  monto: 28000 },
    { dia: 6, hora: '20:00', cancha: 12, c: 13, monto: 28000 },
  ];

  function generarReservas() {
    const hoy = Utils.hoyISO();
    const dias = Utils.diasDeSemana(hoy);
    const base = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return PLANTILLA.map((p, i) => {
      const fecha = dias[p.dia];
      const cliente = CLIENTES[p.c];
      let estado, pago, medio;

      if (p.forzar) {
        estado = p.forzar;
        pago = p.forzar === 'cancelada' ? 'sin_sena' : (i % 2 ? 'sena' : 'pendiente');
        medio = pago === 'sena' ? 'Transferencia' : 'No definido';
      } else if (fecha < hoy) {
        // Turnos pasados: mayormente finalizados y cobrados
        estado = 'finalizada';
        pago = i % 4 === 0 ? 'pendiente' : 'pagado';
        medio = ['Efectivo', 'Mercado Pago', 'Transferencia', 'Tarjeta'][i % 4];
      } else if (fecha === hoy) {
        // Turnos de hoy: mezcla para que la agenda del día tenga de todo
        estado = i % 3 === 0 ? 'pendiente' : 'confirmada';
        pago = estado === 'pendiente' ? 'sin_sena' : (i % 2 ? 'sena' : 'pagado');
        medio = pago === 'sin_sena' ? 'No definido' : ['Mercado Pago', 'Transferencia'][i % 2];
      } else {
        // Turnos futuros: pendientes o confirmados con seña
        estado = i % 3 === 0 ? 'pendiente' : 'confirmada';
        pago = estado === 'confirmada' ? 'sena' : (i % 2 ? 'sin_sena' : 'pendiente');
        medio = pago === 'sena' ? ['Mercado Pago', 'Transferencia'][i % 2] : 'No definido';
      }

      const creada = new Date(base + i * 3.7e6).toISOString();
      return {
        id: 'demo_' + String(i + 1).padStart(2, '0'),
        cliente: cliente.nombre,
        telefono: cliente.tel,
        fecha,
        hora: p.hora,
        duracion: CONFIG.DURACION_TURNO_MIN,
        cancha: p.cancha,
        estado,
        pago,
        medioPago: medio,
        monto: p.monto,
        obs: p.obs || '',
        createdAt: creada,
        updatedAt: creada,
      };
    });
  }

  async function cargar() {
    const reservas = generarReservas();
    await Store.reemplazarTodo(reservas);
    return reservas.length;
  }

  async function cargarSiVacio() {
    // Solo se auto-siembra en modo local. En la nube los datos son
    // compartidos: el seed lo dispara el admin con el botón "↺ Demo".
    if (Store.modo === 'local' && Store.getAll().length === 0) await cargar();
  }

  return { cargar, cargarSiVacio };
})();
