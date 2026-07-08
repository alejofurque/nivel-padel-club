/* =========================================================
   App: estado global, navegación, formularios y eventos.
   ========================================================= */

const App = {

  state: {
    vista: 'grilla',
    fecha: Utils.hoyISO(),
    dashFecha: Utils.hoyISO(),
    filtroCancha: '',
    filtroEstado: '',
    filtroPago: '',
    filtroBusqueda: '',
    grupoCanchas: '1-6',      // vista compacta por defecto: 1-6 | 7-12 | todas
    alertasAbiertas: false,   // la caja de alertas arranca colapsada
    copilotoReservaId: null,
    copilotoTipo: null,
    copilotoPeticion: 0,   // token para descartar respuestas de IA obsoletas
    confirmacionResolver: null,
  },

  async init() {
    App.aplicarTemaGuardado();
    App.poblarSelects();
    App.bindEventos();

    await DB.inicializar();
    App.actualizarIndicadorModo();

    const sesion = await Auth.restaurar();
    if (sesion) await App.entrar();
    else App.mostrarLogin();
  },

  // ---- Sesión: login / logout / control por rol ----

  mostrarLogin() {
    document.getElementById('login-screen').hidden = false;
    document.querySelector('header').hidden = true;
    document.querySelector('main').hidden = true;
    document.getElementById('login-modo').textContent = DB.configurado
      ? '☁ Conectado a Supabase: las credenciales se validan con Supabase Auth.'
      : '⚠ Supabase no configurado: login simulado y datos locales (modo demo sin nube).';
    document.getElementById('login-usuario').focus();
  },

  async entrar() {
    document.getElementById('login-screen').hidden = true;
    document.querySelector('header').hidden = false;
    document.querySelector('main').hidden = false;

    try {
      await Store.inicializar();
      await Demo.cargarSiVacio();
    } catch (e) {
      Utils.toast('No se pudieron cargar las reservas: ' + e.message, 'aviso');
    }

    App.aplicarRolUI();
    document.getElementById('filtro-fecha').value = App.state.fecha;
    document.getElementById('dash-fecha').value = App.state.dashFecha;
    App.render();
  },

  async manejarLogin(e) {
    e.preventDefault();
    const errBox = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');
    errBox.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Ingresando…';
    try {
      const sesion = await Auth.iniciarSesion(
        document.getElementById('login-usuario').value,
        document.getElementById('login-clave').value,
      );
      await App.entrar();
      Utils.toast(`Hola ${sesion.username} — sesión iniciada como ${Auth.rolLegible()}.`);
    } catch (err) {
      errBox.textContent = err.message || 'No se pudo iniciar sesión.';
      errBox.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  },

  async cerrarSesion() {
    await Auth.cerrarSesion();
    location.reload();
  },

  // La UI se adapta al rol. Esto es control VISUAL: el dashboard además
  // valida el rol al renderizar, y en Supabase las políticas RLS limitan
  // lo que cada usuario puede hacer contra la base.
  aplicarRolUI() {
    const esAdmin = Auth.esAdmin();
    const sesion = Auth.usuario();

    const chip = document.getElementById('user-chip');
    chip.hidden = false;
    document.getElementById('user-nombre').textContent = sesion?.username || '';
    document.getElementById('user-rol').textContent = Auth.rolLegible();

    // Recepcionista: sin dashboard financiero, sin export, sin reset global
    document.querySelector('.tab[data-view="dashboard"]').hidden = !esAdmin;
    document.getElementById('btn-exportar').hidden = !esAdmin;
    document.getElementById('btn-reset-demo').hidden = !esAdmin;

    if (!esAdmin && !document.getElementById('view-dashboard').hidden) {
      document.querySelector('.tab[data-view="agenda"]').click();
    }
  },

  actualizarIndicadorModo() {
    const el = document.getElementById('save-status');
    if (DB.configurado) {
      el.textContent = '☁ Supabase';
      el.title = 'Las reservas se guardan en la nube (Supabase) y se comparten entre usuarios';
    } else {
      el.textContent = 'Guardado local';
      el.title = 'Supabase no configurado: las reservas se guardan solo en este navegador';
    }
  },

  render() {
    Agenda.render(App.state);
    if (!document.getElementById('view-dashboard').hidden) Dashboard.render(App.state);
  },

  // ---- Poblar selects fijos ----

  poblarSelects() {
    const opts = (pares) => pares.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    const canchasOpts = opts(CANCHAS.map(c => [c, `Cancha ${c}`]));
    const horasOpts = opts(BLOQUES.map(h => [h, h]));
    const estadosOpts = opts(Object.entries(ESTADOS).map(([k, e]) => [k, e.label]));
    const pagosOpts = opts(Object.entries(PAGOS).map(([k, p]) => [k, p.label]));
    const mediosOpts = opts(MEDIOS_PAGO.map(m => [m, m]));

    document.getElementById('filtro-cancha').insertAdjacentHTML('beforeend', canchasOpts);
    document.getElementById('filtro-estado').insertAdjacentHTML('beforeend', estadosOpts);
    document.getElementById('filtro-pago').insertAdjacentHTML('beforeend', pagosOpts);
    document.getElementById('f-cancha').innerHTML = canchasOpts;
    document.getElementById('f-hora').innerHTML = horasOpts;
    document.getElementById('f-estado').innerHTML = estadosOpts;
    document.getElementById('f-pago').innerHTML = pagosOpts;
    document.getElementById('f-medio').innerHTML = mediosOpts;
    document.getElementById('p-pago').innerHTML = pagosOpts;
    document.getElementById('p-medio').innerHTML = mediosOpts;
  },

  // ---- Eventos ----

  bindEventos() {
    // Navegación entre vistas
    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      const esAgenda = tab.dataset.view === 'agenda';
      document.getElementById('view-agenda').hidden = !esAgenda;
      document.getElementById('view-dashboard').hidden = esAgenda;
      App.actualizarSeccionActual(tab.dataset.view);
      App.render();
    }));

    // Fecha y filtros de agenda
    const setFecha = f => { App.state.fecha = f; document.getElementById('filtro-fecha').value = f; App.render(); };
    document.getElementById('filtro-fecha').addEventListener('change', e => setFecha(e.target.value || Utils.hoyISO()));
    document.getElementById('btn-dia-prev').addEventListener('click', () => setFecha(Utils.sumarDias(App.state.fecha, -1)));
    document.getElementById('btn-dia-next').addEventListener('click', () => setFecha(Utils.sumarDias(App.state.fecha, 1)));
    document.getElementById('btn-hoy').addEventListener('click', () => setFecha(Utils.hoyISO()));

    for (const [id, clave] of [['filtro-cancha', 'filtroCancha'], ['filtro-estado', 'filtroEstado'], ['filtro-pago', 'filtroPago']]) {
      document.getElementById(id).addEventListener('change', e => {
        App.state[clave] = e.target.value;
        if (id === 'filtro-cancha') App.actualizarSegCanchas();
        App.render();
      });
    }

    document.getElementById('filtro-busqueda').addEventListener('input', e => {
      App.state.filtroBusqueda = e.target.value;
      App.render();
    });

    document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
      App.state.filtroCancha = App.state.filtroEstado = App.state.filtroPago = App.state.filtroBusqueda = '';
      for (const id of ['filtro-cancha', 'filtro-estado', 'filtro-pago', 'filtro-busqueda']) {
        document.getElementById(id).value = '';
      }
      App.actualizarSegCanchas();
      App.render();
    });

    // Grupos de canchas: vista compacta 1–6 / 7–12 o las 12 completas
    document.querySelectorAll('#seg-canchas .seg').forEach(b => b.addEventListener('click', () => {
      App.state.grupoCanchas = b.dataset.grupo;
      if (App.state.filtroCancha) {
        App.state.filtroCancha = '';
        document.getElementById('filtro-cancha').value = '';
      }
      App.actualizarSegCanchas();
      App.render();
    }));

    document.getElementById('btn-copiar-dia').addEventListener('click', App.copiarResumenDia);
    document.getElementById('btn-tema').addEventListener('click', App.alternarTema);

    document.getElementById('btn-vista-grilla').addEventListener('click', () => App.setVista('grilla'));
    document.getElementById('btn-vista-lista').addEventListener('click', () => App.setVista('lista'));

    // Fecha del dashboard
    document.getElementById('dash-fecha').addEventListener('change', e => {
      App.state.dashFecha = e.target.value || Utils.hoyISO();
      Dashboard.render(App.state);
    });

    // Acciones de cabecera
    document.getElementById('btn-nueva-reserva').addEventListener('click', () => App.abrirFormReserva());
    document.getElementById('btn-exportar').addEventListener('click', () => {
      const n = Store.exportarCSV();
      Utils.toast(`Se exportaron ${n} reservas a CSV.`);
    });
    document.getElementById('btn-reset-demo').addEventListener('click', async () => {
      const alcance = Store.modo === 'nube'
        ? 'Esto borra TODAS las reservas de la base compartida (Supabase) y carga las de demostración.'
        : 'Esto borra los datos locales y vuelve a cargar las reservas de demostración.';
      const confirmado = await App.confirmar({
        titulo: 'Reiniciar datos demo',
        mensaje: `${alcance} Esta acción no se puede deshacer.`,
        accion: 'Reiniciar demo',
      });
      if (!confirmado) return;
      try {
        const n = await Demo.cargar();
        App.state.fecha = Utils.hoyISO();
        document.getElementById('filtro-fecha').value = App.state.fecha;
        App.render();
        Utils.toast(`Datos demo reiniciados: ${n} reservas cargadas.`);
      } catch (e) {
        Utils.toast('No se pudieron reiniciar los datos: ' + e.message, 'aviso');
      }
    });

    // Sesión
    document.getElementById('form-login').addEventListener('submit', App.manejarLogin);
    document.getElementById('btn-logout').addEventListener('click', App.cerrarSesion);
    document.getElementById('btn-confirmacion-aceptar').addEventListener('click', () => App.resolverConfirmacion(true));
    document.getElementById('btn-confirmacion-cancelar').addEventListener('click', () => App.resolverConfirmacion(false));
    document.getElementById('btn-confirmacion-cerrar').addEventListener('click', () => App.resolverConfirmacion(false));

    // Cierre de modales (botones ✕ / Cancelar y click en el fondo)
    document.querySelectorAll('[data-cerrar-modal]').forEach(b =>
      b.addEventListener('click', () => App.cerrarModal(b.dataset.cerrarModal)));
    document.querySelectorAll('.modal-backdrop').forEach(m =>
      m.addEventListener('mousedown', e => {
        if (e.target !== m) return;
        if (m.id === 'modal-confirmacion') App.resolverConfirmacion(false);
        else App.cerrarModal(m.id);
      }));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(m => {
        if (m.id === 'modal-confirmacion') App.resolverConfirmacion(false);
        else App.cerrarModal(m.id);
      });
    });

    // Delegación: acciones sobre reservas (lista y grilla)
    document.querySelector('main').addEventListener('click', e => {
      const card = e.target.closest('[data-card-accion]');
      if (card) { App.accionCard(card.dataset.cardAccion); return; }

      const resumenAlertas = e.target.closest('.alertas-box summary');
      if (resumenAlertas) {
        // El <details> se abre/cierra solo; recordamos el estado para no
        // perderlo cuando la vista se vuelve a renderizar.
        const detalle = resumenAlertas.closest('details');
        setTimeout(() => { App.state.alertasAbiertas = detalle.open; }, 0);
        return;
      }

      const slotLibre = e.target.closest('[data-slot-libre]');
      if (slotLibre) {
        App.abrirFormReserva(null, {
          fecha: App.state.fecha, hora: slotLibre.dataset.hora, cancha: slotLibre.dataset.cancha,
        });
        return;
      }
      const slotReserva = e.target.closest('[data-slot-reserva]');
      if (slotReserva) { App.abrirFormReserva(slotReserva.dataset.slotReserva); return; }

      const btn = e.target.closest('[data-accion]');
      if (btn) App.ejecutarAccion(btn.dataset.accion, btn.dataset.id);
    });

    // Formularios
    document.getElementById('form-reserva').addEventListener('submit', App.guardarReserva);
    document.getElementById('form-reserva').addEventListener('input', App.actualizarResumenReserva);
    document.getElementById('form-pago').addEventListener('submit', App.guardarPago);

    // Copiloto
    document.getElementById('btn-copiar-mensaje').addEventListener('click', App.copiarMensaje);
    document.getElementById('btn-abrir-whatsapp').addEventListener('click', App.abrirWhatsApp);
    document.getElementById('copiloto-instruccion').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); App.seleccionarTipoMensaje('personalizado'); }
    });
  },

  setVista(vista) {
    App.state.vista = vista;
    document.getElementById('btn-vista-grilla').classList.toggle('active', vista === 'grilla');
    document.getElementById('btn-vista-lista').classList.toggle('active', vista === 'lista');
    App.render();
  },

  actualizarSeccionActual(view) {
    const label = view === 'dashboard' ? 'Dashboard' : 'Agenda';
    const el = document.getElementById('seccion-actual');
    if (el) el.textContent = label;
  },

  // El segmentado de canchas se apaga cuando hay una cancha puntual filtrada
  actualizarSegCanchas() {
    document.querySelectorAll('#seg-canchas .seg').forEach(b =>
      b.classList.toggle('active', !App.state.filtroCancha && b.dataset.grupo === App.state.grupoCanchas));
  },

  // ---- Acciones de los KPIs operativos ----

  accionCard(accion) {
    if (accion === 'ver-pendientes') {
      App.state.filtroEstado = 'pendiente';
      document.getElementById('filtro-estado').value = 'pendiente';
      App.setVista('lista');
    } else if (accion === 'ver-alertas') {
      App.state.alertasAbiertas = true;
      Agenda.render(App.state);
      document.getElementById('alertas-dia').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  // ---- Tema claro / oscuro ----

  aplicarTemaGuardado() {
    const tema = localStorage.getItem('nivelpadel_tema');
    if (tema) document.documentElement.dataset.theme = tema;
  },

  alternarTema() {
    const root = document.documentElement;
    const actual = root.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nuevo = actual === 'dark' ? 'light' : 'dark';
    root.dataset.theme = nuevo;
    localStorage.setItem('nivelpadel_tema', nuevo);
  },

  // ---- Copiar el resumen del día (para pasarlo por WhatsApp interno) ----

  async copiarResumenDia() {
    const delDia = Store.getPorFecha(App.state.fecha).filter(r => r.estado !== 'cancelada');
    const lineas = [
      `Agenda ${CONFIG.NOMBRE_CLUB} — ${Utils.fechaLegible(App.state.fecha)}`,
      ...(delDia.length
        ? delDia.map(r => `${r.hora} · Cancha ${r.cancha} · ${r.cliente} · ${ESTADOS[r.estado].label} · ${PAGOS[r.pago].label}`)
        : ['Sin reservas activas.']),
    ];
    try {
      await navigator.clipboard.writeText(lineas.join('\n'));
      Utils.toast(`Resumen del día copiado (${delDia.length} reservas).`);
    } catch {
      Utils.toast('No se pudo copiar el resumen.', 'aviso');
    }
  },

  // ---- Acciones rápidas sobre una reserva ----

  async ejecutarAccion(accion, id) {
    const r = Store.getById(id);
    if (!r) return;

    try {
      switch (accion) {
        case 'confirmar':
          await Store.cambiarEstado(id, 'confirmada');
          Utils.toast(`Turno de ${r.cliente} confirmado.`);
          break;
        case 'finalizar':
          await Store.cambiarEstado(id, 'finalizada');
          Utils.toast(`Turno de ${r.cliente} marcado como finalizado.`);
          break;
        case 'no_asistio':
          await Store.cambiarEstado(id, 'no_asistio');
          Utils.toast(`Se registró que ${r.cliente} no asistió.`, 'aviso');
          break;
        case 'cancelar':
          if (!await App.confirmar({
            titulo: 'Cancelar reserva',
            mensaje: `¿Cancelar la reserva de ${r.cliente} (${Utils.fechaCorta(r.fecha)} ${r.hora}, Cancha ${r.cancha})? El horario quedará libre para una nueva reserva.`,
            accion: 'Cancelar reserva',
          })) return;
          await Store.cambiarEstado(id, 'cancelada');
          Utils.toast(`Reserva de ${r.cliente} cancelada. El horario quedó libre.`, 'aviso');
          break;
        case 'pago':
          App.abrirModalPago(r);
          return;
        case 'mensajes':
          App.abrirCopiloto(r);
          return;
        case 'editar':
          App.abrirFormReserva(id);
          return;
      }
    } catch (e) {
      Utils.toast('No se pudo guardar el cambio: ' + e.message, 'aviso');
    }
    App.render();
  },

  // ---- Modal de reserva (alta y edición) ----

  abrirFormReserva(id = null, prellenado = {}) {
    const form = document.getElementById('form-reserva');
    form.reset();
    document.getElementById('form-reserva-error').hidden = true;
    document.getElementById('f-id').value = id || '';
    document.getElementById('modal-reserva-titulo').textContent = id ? 'Editar reserva' : 'Nueva reserva';
    document.getElementById('btn-guardar-reserva').textContent = id ? 'Guardar cambios' : 'Guardar reserva';

    const r = id ? Store.getById(id) : null;
    document.getElementById('f-cliente').value = r?.cliente || '';
    document.getElementById('f-telefono').value = r?.telefono || '';
    document.getElementById('f-fecha').value = r?.fecha || prellenado.fecha || App.state.fecha;
    document.getElementById('f-hora').value = r?.hora || prellenado.hora || BLOQUES[0];
    document.getElementById('f-cancha').value = r?.cancha || prellenado.cancha || 1;
    document.getElementById('f-duracion').value = r?.duracion || CONFIG.DURACION_TURNO_MIN;
    document.getElementById('f-estado').value = r?.estado || 'pendiente';
    document.getElementById('f-pago').value = r?.pago || 'sin_sena';
    document.getElementById('f-medio').value = r?.medioPago || 'No definido';
    document.getElementById('f-monto').value = r?.monto ?? '';
    document.getElementById('f-obs').value = r?.obs || '';

    App.abrirModal('modal-reserva');
    App.actualizarResumenReserva();
    document.getElementById('f-cliente').focus();
  },

  // Resumen en vivo del turno que se está cargando + aviso temprano de choque
  actualizarResumenReserva() {
    const box = document.getElementById('reserva-resumen');
    const fecha = document.getElementById('f-fecha').value;
    const hora = document.getElementById('f-hora').value;
    const cancha = document.getElementById('f-cancha').value;
    if (!fecha || !hora || !cancha) { box.innerHTML = ''; return; }

    const monto = document.getElementById('f-monto').value;
    const id = document.getElementById('f-id').value || null;
    const conflicto = document.getElementById('f-estado').value !== 'cancelada'
      ? Validation.buscarConflicto(fecha, hora, Number(cancha), id)
      : null;

    box.innerHTML = `
      <span>📋 ${Utils.fechaLegible(fecha)} · ${hora} · Cancha ${cancha}${monto ? ' · ' + Utils.moneda(monto) : ''}</span>
      ${conflicto ? `<span class="resumen-conflicto">⚠ Ese horario ya está ocupado por ${Utils.escapeHTML(conflicto.cliente)}.</span>` : ''}`;
  },

  async guardarReserva(e) {
    e.preventDefault();
    const id = document.getElementById('f-id').value || null;
    const datos = {
      cliente: document.getElementById('f-cliente').value.trim(),
      telefono: document.getElementById('f-telefono').value.trim(),
      fecha: document.getElementById('f-fecha').value,
      hora: document.getElementById('f-hora').value,
      cancha: Number(document.getElementById('f-cancha').value),
      duracion: Number(document.getElementById('f-duracion').value) || CONFIG.DURACION_TURNO_MIN,
      estado: document.getElementById('f-estado').value,
      pago: document.getElementById('f-pago').value,
      medioPago: document.getElementById('f-medio').value,
      monto: document.getElementById('f-monto').value === '' ? 0 : Number(document.getElementById('f-monto').value),
      obs: document.getElementById('f-obs').value.trim(),
    };

    const { ok, errores } = Validation.validarReserva(datos, id);
    if (!ok) {
      const errBox = document.getElementById('form-reserva-error');
      errBox.innerHTML = errores.map(er => `<p>${Utils.escapeHTML(er)}</p>`).join('');
      errBox.hidden = false;
      errBox.scrollIntoView({ block: 'nearest' });
      return;
    }

    const btnGuardar = document.getElementById('btn-guardar-reserva');
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando…';
    try {
      if (id) {
        await Store.actualizar(id, datos);
        Utils.toast('Reserva actualizada correctamente.');
      } else {
        await Store.crear(datos);
        Utils.toast(`Reserva creada: ${datos.cliente}, ${Utils.fechaCorta(datos.fecha)} ${datos.hora}, Cancha ${datos.cancha}.`);
      }
    } catch (err) {
      // Cubre también el índice único anti-duplicados de la base (23505)
      const errBox = document.getElementById('form-reserva-error');
      errBox.innerHTML = `<p>${Utils.escapeHTML(err.message)}</p>`;
      errBox.hidden = false;
      return;
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.textContent = id ? 'Guardar cambios' : 'Guardar reserva';
    }

    // Llevar la agenda a la fecha de la reserva guardada
    App.state.fecha = datos.fecha;
    document.getElementById('filtro-fecha').value = datos.fecha;
    App.cerrarModal('modal-reserva');
    App.render();
  },

  // ---- Modal de pago ----

  abrirModalPago(r) {
    document.getElementById('p-id').value = r.id;
    document.getElementById('pago-detalle').textContent =
      `${r.cliente} · ${Utils.fechaCorta(r.fecha)} ${r.hora} · Cancha ${r.cancha}`;
    document.getElementById('p-pago').value = r.pago;
    document.getElementById('p-medio').value = r.medioPago || 'No definido';
    document.getElementById('p-monto').value = r.monto ?? '';
    App.abrirModal('modal-pago');
  },

  async guardarPago(e) {
    e.preventDefault();
    const id = document.getElementById('p-id').value;
    try {
      await Store.actualizar(id, {
        pago: document.getElementById('p-pago').value,
        medioPago: document.getElementById('p-medio').value,
        monto: Number(document.getElementById('p-monto').value) || 0,
      });
      App.cerrarModal('modal-pago');
      App.render();
      Utils.toast('Pago registrado correctamente.');
    } catch (err) {
      Utils.toast('No se pudo registrar el pago: ' + err.message, 'aviso');
    }
  },

  // ---- Copiloto de mensajes ----

  abrirCopiloto(r) {
    App.state.copilotoReservaId = r.id;
    document.getElementById('copiloto-detalle').textContent =
      `${r.cliente} · ${Utils.fechaLegible(r.fecha)} ${r.hora} · Cancha ${r.cancha} · ${ESTADOS[r.estado].label}`;
    document.getElementById('copiloto-telefono').innerHTML = WhatsApp.esTelefonoValido(r.telefono)
      ? `Se enviará a <strong>${WhatsApp.telefonoVisible(r.telefono)}</strong>`
      : `⚠ ${MSG_TEL_INVALIDO}`;
    document.getElementById('copiloto-error').hidden = true;
    document.getElementById('copiloto-instruccion').value = '';
    document.getElementById('copiloto-estado').hidden = true;

    const sugerido = WhatsApp.tipoSugerido(r);
    document.getElementById('copiloto-tipos').innerHTML = WhatsApp.TIPOS.map(t => `
      <button class="tipo-msg ${t.id === sugerido ? 'active' : ''}" data-tipo="${t.id}" title="${t.desc}">
        ${t.label}${t.id === sugerido ? ' <span class="sugerido">sugerido</span>' : ''}
        <small>${t.desc}</small>
      </button>`).join('');

    document.getElementById('copiloto-tipos').querySelectorAll('[data-tipo]').forEach(b =>
      b.addEventListener('click', () => App.seleccionarTipoMensaje(b.dataset.tipo)));

    App.seleccionarTipoMensaje(sugerido);
    App.abrirModal('modal-copiloto');
  },

  /**
   * Genera el mensaje del tipo elegido.
   * 1) Intenta con IA real (OpenAI, vía backend — la API key nunca está acá).
   * 2) Si la IA no está configurada o falla, muestra el estado de carga
   *    durante al menos 1.5s y devuelve la plantilla local con los datos
   *    reales de la reserva (fallback de costo cero: la app nunca se rompe).
   * Volver a tocar el tipo activo regenera el mensaje.
   */
  async seleccionarTipoMensaje(tipo) {
    App.state.copilotoTipo = tipo;
    const token = ++App.state.copilotoPeticion;
    const r = Store.getById(App.state.copilotoReservaId);
    if (!r) return;

    document.querySelectorAll('#copiloto-tipos .tipo-msg').forEach(b =>
      b.classList.toggle('active', b.dataset.tipo === tipo));

    const campoInstruccion = document.getElementById('copiloto-instruccion-campo');
    campoInstruccion.hidden = tipo !== 'personalizado';
    const instruccion = tipo === 'personalizado'
      ? document.getElementById('copiloto-instruccion').value.trim()
      : '';

    const ta = document.getElementById('copiloto-mensaje');
    const estado = document.getElementById('copiloto-estado');
    ta.value = '';
    ta.disabled = true;
    estado.hidden = false;
    estado.className = 'copiloto-estado copiloto-estado-cargando';
    estado.textContent = 'IA procesando mensaje...';

    const inicio = Date.now();
    let mensaje;
    let fuente = 'ia';
    try {
      mensaje = await WhatsApp.generarConIA(tipo, r, instruccion);
    } catch {
      // Fallback local: mantener el estado de carga al menos 1.5s
      const restante = 1500 - (Date.now() - inicio);
      if (restante > 0) await new Promise(res => setTimeout(res, restante));
      mensaje = WhatsApp.generarMensaje(tipo, r, instruccion);
      fuente = 'fallback';
    }

    // Si mientras tanto el usuario eligió otro tipo, descartamos esta respuesta
    if (token !== App.state.copilotoPeticion) return;

    ta.disabled = false;
    ta.value = mensaje;
    estado.className = 'copiloto-estado ' + (fuente === 'ia' ? 'copiloto-estado-ia' : 'copiloto-estado-fallback');
    estado.textContent = fuente === 'ia'
      ? 'Generado con IA real (OpenAI)'
      : '📋 Plantilla local — IA no configurada o sin conexión (modo sin costo)';
  },

  async copiarMensaje() {
    const texto = document.getElementById('copiloto-mensaje').value;
    try {
      await navigator.clipboard.writeText(texto);
      Utils.toast('Mensaje copiado al portapapeles.');
    } catch {
      // Fallback para contextos sin permiso de clipboard
      const ta = document.getElementById('copiloto-mensaje');
      ta.select();
      document.execCommand('copy');
      Utils.toast('Mensaje copiado al portapapeles.');
    }
  },

  abrirWhatsApp() {
    const r = Store.getById(App.state.copilotoReservaId);
    if (!r) return;
    const errBox = document.getElementById('copiloto-error');
    if (!WhatsApp.esTelefonoValido(r.telefono)) {
      errBox.textContent = MSG_TEL_INVALIDO + ` (teléfono cargado: "${r.telefono || 'vacío'}")`;
      errBox.hidden = false;
      return;
    }
    errBox.hidden = true;
    const mensaje = document.getElementById('copiloto-mensaje').value;
    window.open(WhatsApp.linkWhatsApp(r.telefono, mensaje), '_blank', 'noopener');
  },

  // ---- Modales ----

  abrirModal(id) { document.getElementById(id).hidden = false; },
  cerrarModal(id) { document.getElementById(id).hidden = true; },

  confirmar({ titulo = 'Confirmar acción', mensaje, accion = 'Confirmar' }) {
    document.getElementById('confirmacion-titulo').textContent = titulo;
    document.getElementById('confirmacion-mensaje').textContent = mensaje;
    document.getElementById('btn-confirmacion-aceptar').textContent = accion;
    App.abrirModal('modal-confirmacion');
    document.getElementById('btn-confirmacion-aceptar').focus();
    return new Promise(resolve => { App.state.confirmacionResolver = resolve; });
  },

  resolverConfirmacion(valor) {
    if (App.state.confirmacionResolver) {
      App.state.confirmacionResolver(valor);
      App.state.confirmacionResolver = null;
    }
    App.cerrarModal('modal-confirmacion');
  },
};

document.addEventListener('DOMContentLoaded', App.init);
