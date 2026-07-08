/* =========================================================
   DB: acceso a Supabase (PostgreSQL en la nube).
   - Se inicializa con la config pública que expone el servidor
     en /api/config (URL + anon key; la anon key es pública y
     la seguridad real la dan las políticas RLS).
   - Si Supabase no está configurado o no hay conexión, la app
     sigue funcionando en "modo local" (localStorage) — limitación
     académica documentada en el README.
   - Mapea entre el modelo del frontend (español) y las columnas
     de la tabla `reservations`.
   ========================================================= */

const DB = {

  cliente: null,
  configurado: false,
  iaDisponible: false,

  async inicializar() {
    try {
      const resp = await fetch('/api/config');
      if (!resp.ok) throw new Error('sin config');
      const cfg = await resp.json();
      DB.iaDisponible = Boolean(cfg.iaDisponible);

      if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase?.createClient) {
        DB.cliente = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        // No consultamos tablas acá: RLS exige usuario autenticado.
        // La verificación real ocurre después del login, al inicializar Store.
        DB.configurado = true;
      }
    } catch {
      // Servidor sin /api/config (p. ej. abierto como archivo) → modo local
    }
  },

  // ---- Mapeo reserva (frontend) ↔ fila (tabla reservations) ----

  aFila(r) {
    return {
      customer_name: r.cliente,
      phone: r.telefono,
      date: r.fecha,
      time: r.hora,
      duration: r.duracion,
      court: r.cancha,
      reservation_status: r.estado,
      payment_status: r.pago,
      payment_method: r.medioPago || 'No definido',
      amount: Number(r.monto) || 0,
      notes: r.obs || '',
      created_by: r.creadoPor || null,
      updated_by: r.actualizadoPor || null,
    };
  },

  aReserva(fila) {
    return {
      id: fila.id,
      cliente: fila.customer_name,
      telefono: fila.phone,
      fecha: fila.date,
      hora: String(fila.time).slice(0, 5),
      duracion: fila.duration,
      cancha: fila.court,
      estado: fila.reservation_status,
      pago: fila.payment_status,
      medioPago: fila.payment_method,
      monto: Number(fila.amount) || 0,
      obs: fila.notes || '',
      createdAt: fila.created_at,
      updatedAt: fila.updated_at,
      creadoPor: fila.created_by || '',
      actualizadoPor: fila.updated_by || '',
    };
  },

  _traducirError(error) {
    // 23505 = violación del índice único anti-duplicados (server-side)
    if (error?.code === '23505') return new Error(MSG_DUPLICADO);
    return new Error('No se pudo guardar en la base de datos: ' + (error?.message || 'error desconocido'));
  },

  // ---- Operaciones sobre reservations ----

  async listar() {
    const { data, error } = await DB.cliente
      .from('reservations').select('*')
      .order('date').order('time').order('court');
    if (error) throw DB._traducirError(error);
    return data.map(DB.aReserva);
  },

  async insertar(reserva) {
    const { data, error } = await DB.cliente
      .from('reservations').insert(DB.aFila(reserva)).select().single();
    if (error) throw DB._traducirError(error);
    return DB.aReserva(data);
  },

  async insertarLote(reservas) {
    const { data, error } = await DB.cliente
      .from('reservations').insert(reservas.map(DB.aFila)).select();
    if (error) throw DB._traducirError(error);
    return data.map(DB.aReserva);
  },

  async actualizar(id, reservaCompleta) {
    const { data, error } = await DB.cliente
      .from('reservations').update(DB.aFila(reservaCompleta)).eq('id', id).select().single();
    if (error) throw DB._traducirError(error);
    return DB.aReserva(data);
  },

  async eliminarTodo() {
    // Permitido solo para admin por la política RLS "reservas_delete_admin"
    const { error } = await DB.cliente
      .from('reservations').delete().gte('created_at', '1970-01-01');
    if (error) throw DB._traducirError(error);
  },
};
