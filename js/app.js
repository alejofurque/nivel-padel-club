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
    copilotoReservaId: null,
    copilotoTipo: null,
  },

  init() {
    Demo.cargarSiVacio();
    App.poblarSelects();
    document.getElementById('filtro-fecha').value = App.state.fecha;
    document.getElementById('dash-fecha').value = App.state.dashFecha;
    App.bindEventos();
    App.render();
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
      App.render();
    }));

    // Fecha y filtros de agenda
    const setFecha = f => { App.state.fecha = f; document.getElementById('filtro-fecha').value = f; App.render(); };
    document.getElementById('filtro-fecha').addEventListener('change', e => setFecha(e.target.value || Utils.hoyISO()));
    document.getElementById('btn-dia-prev').addEventListener('click', () => setFecha(Utils.sumarDias(App.state.fecha, -1)));
    document.getElementById('btn-dia-next').addEventListener('click', () => setFecha(Utils.sumarDias(App.state.fecha, 1)));
    document.getElementById('btn-hoy').addEventListener('click', () => setFecha(Utils.hoyISO()));

    for (const [id, clave] of [['filtro-cancha', 'filtroCancha'], ['filtro-estado', 'filtroEstado'], ['filtro-pago', 'filtroPago']]) {
      document.getElementById(id).addEventListener('change', e => { App.state[clave] = e.target.value; App.render(); });
    }

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
    document.getElementById('btn-reset-demo').addEventListener('click', () => {
      if (!confirm('Esto borra los datos actuales y vuelve a cargar las reservas de demostración. ¿Continuar?')) return;
      const n = Demo.cargar();
      App.state.fecha = Utils.hoyISO();
      document.getElementById('filtro-fecha').value = App.state.fecha;
      App.render();
      Utils.toast(`Datos demo reiniciados: ${n} reservas cargadas.`);
    });

    // Cierre de modales (botones ✕ / Cancelar y click en el fondo)
    document.querySelectorAll('[data-cerrar-modal]').forEach(b =>
      b.addEventListener('click', () => App.cerrarModal(b.dataset.cerrarModal)));
    document.querySelectorAll('.modal-backdrop').forEach(m =>
      m.addEventListener('mousedown', e => { if (e.target === m) App.cerrarModal(m.id); }));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(m => App.cerrarModal(m.id));
    });

    // Delegación: acciones sobre reservas (lista y grilla)
    document.querySelector('main').addEventListener('click', e => {
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
    document.getElementById('form-pago').addEventListener('submit', App.guardarPago);

    // Copiloto
    document.getElementById('btn-copiar-mensaje').addEventListener('click', App.copiarMensaje);
    document.getElementById('btn-abrir-whatsapp').addEventListener('click', App.abrirWhatsApp);
  },

  setVista(vista) {
    App.state.vista = vista;
    document.getElementById('btn-vista-grilla').classList.toggle('active', vista === 'grilla');
    document.getElementById('btn-vista-lista').classList.toggle('active', vista === 'lista');
    App.render();
  },

  // ---- Acciones rápidas sobre una reserva ----

  ejecutarAccion(accion, id) {
    const r = Store.getById(id);
    if (!r) return;

    switch (accion) {
      case 'confirmar':
        Store.cambiarEstado(id, 'confirmada');
        Utils.toast(`Turno de ${r.cliente} confirmado.`);
        break;
      case 'finalizar':
        Store.cambiarEstado(id, 'finalizada');
        Utils.toast(`Turno de ${r.cliente} marcado como finalizado.`);
        break;
      case 'no_asistio':
        Store.cambiarEstado(id, 'no_asistio');
        Utils.toast(`Se registró que ${r.cliente} no asistió.`, 'aviso');
        break;
      case 'cancelar':
        if (!confirm(`¿Cancelar la reserva de ${r.cliente} (${Utils.fechaCorta(r.fecha)} ${r.hora}, Cancha ${r.cancha})?`)) return;
        Store.cambiarEstado(id, 'cancelada');
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
    document.getElementById('f-cliente').focus();
  },

  guardarReserva(e) {
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

    if (id) {
      Store.actualizar(id, datos);
      Utils.toast('Reserva actualizada correctamente.');
    } else {
      Store.crear(datos);
      Utils.toast(`Reserva creada: ${datos.cliente}, ${Utils.fechaCorta(datos.fecha)} ${datos.hora}, Cancha ${datos.cancha}.`);
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

  guardarPago(e) {
    e.preventDefault();
    const id = document.getElementById('p-id').value;
    Store.actualizar(id, {
      pago: document.getElementById('p-pago').value,
      medioPago: document.getElementById('p-medio').value,
      monto: Number(document.getElementById('p-monto').value) || 0,
    });
    App.cerrarModal('modal-pago');
    App.render();
    Utils.toast('Pago registrado correctamente.');
  },

  // ---- Copiloto de mensajes ----

  abrirCopiloto(r) {
    App.state.copilotoReservaId = r.id;
    document.getElementById('copiloto-detalle').textContent =
      `${r.cliente} · ${Utils.fechaLegible(r.fecha)} ${r.hora} · Cancha ${r.cancha} · ${ESTADOS[r.estado].label}`;
    document.getElementById('copiloto-error').hidden = true;

    const sugerido = WhatsApp.tipoSugerido(r);
    document.getElementById('copiloto-tipos').innerHTML = WhatsApp.TIPOS.map(t => `
      <button class="tipo-msg ${t.id === sugerido ? 'active' : ''}" data-tipo="${t.id}" title="${t.desc}">
        ${t.label}${t.id === sugerido ? ' <span class="sugerido">sugerido</span>' : ''}
      </button>`).join('');

    document.getElementById('copiloto-tipos').querySelectorAll('[data-tipo]').forEach(b =>
      b.addEventListener('click', () => App.seleccionarTipoMensaje(b.dataset.tipo)));

    App.seleccionarTipoMensaje(sugerido);
    App.abrirModal('modal-copiloto');
  },

  seleccionarTipoMensaje(tipo) {
    App.state.copilotoTipo = tipo;
    const r = Store.getById(App.state.copilotoReservaId);
    if (!r) return;
    document.querySelectorAll('#copiloto-tipos .tipo-msg').forEach(b =>
      b.classList.toggle('active', b.dataset.tipo === tipo));
    document.getElementById('copiloto-mensaje').value = WhatsApp.generarMensaje(tipo, r);
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
};

document.addEventListener('DOMContentLoaded', App.init);
