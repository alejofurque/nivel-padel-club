/* =========================================================
   Vista Agenda: pensada para leerse en 30 segundos.
   - 3 KPIs operativos (libres / por confirmar / alertas)
   - Alertas compactas y colapsables
   - Grilla dividida (1–6 / 7–12 / todas) sin scroll horizontal
   Las métricas financieras viven en el Dashboard.
   ========================================================= */

const Agenda = {

  render(state) {
    document.getElementById('fecha-legible').textContent = Utils.fechaLegible(state.fecha);
    const delDia = Store.getPorFecha(state.fecha);
    const reincidentes = Validation.clientesReincidentes();
    const alertas = Agenda.alertasDelDia(delDia, reincidentes);

    Agenda.renderCards(state, delDia, alertas);
    Agenda.renderAlertas(state, alertas);

    const grilla = document.getElementById('agenda-grilla');
    const lista = document.getElementById('agenda-lista');
    grilla.hidden = state.vista !== 'grilla';
    lista.hidden = state.vista !== 'lista';
    if (state.vista === 'grilla') Agenda.renderGrilla(state, delDia);
    else Agenda.renderLista(state, delDia, reincidentes);
  },

  pasaFiltros(r, state) {
    if (state.filtroCancha && Number(r.cancha) !== Number(state.filtroCancha)) return false;
    if (state.filtroEstado && r.estado !== state.filtroEstado) return false;
    if (state.filtroPago && r.pago !== state.filtroPago) return false;
    if (state.filtroBusqueda) {
      const q = Utils.normalizarBusqueda(state.filtroBusqueda);
      const texto = Utils.normalizarBusqueda(`${r.cliente} ${r.telefono}`);
      if (!texto.includes(q)) return false;
    }
    return true;
  },

  // ---- KPIs operativos: solo lo que el operador necesita ya ----

  renderCards(state, delDia, alertas) {
    const activas = delDia.filter(r => r.estado !== 'cancelada');
    const libres = CAPACIDAD_DIARIA - activas.length;
    const porConfirmar = delDia.filter(r => r.estado === 'pendiente').length;

    const cards = [
      {
        label: 'Slots libres del día', valor: libres, tono: 'verde',
        sub: `de ${CAPACIDAD_DIARIA} turnos vendibles`,
      },
      {
        label: 'Turnos por confirmar', valor: porConfirmar,
        tono: porConfirmar ? 'amarillo' : 'gris',
        sub: porConfirmar ? 'click para verlos en la lista' : 'todo confirmado',
        accion: porConfirmar ? 'ver-pendientes' : null,
      },
      {
        label: 'Alertas activas', valor: alertas.length,
        tono: alertas.some(a => a.tipo === 'critica') ? 'naranja' : (alertas.length ? 'amarillo' : 'gris'),
        sub: alertas.length ? 'click para ver el detalle' : 'operación al día',
        accion: alertas.length ? 'ver-alertas' : null,
      },
    ];

    document.getElementById('cards-dia').innerHTML = cards.map(c => `
      <div class="card card-kpi ${c.tono ? 'card-' + c.tono : ''} ${c.accion ? 'card-click' : ''}"
           ${c.accion ? `data-card-accion="${c.accion}" role="button" tabindex="0"` : ''}>
        <span class="card-label">${c.label}</span>
        <span class="card-valor">${c.valor}</span>
        <span class="card-sub">${c.sub}</span>
      </div>`).join('');
  },

  // ---- Alertas del día: un solo componente colapsable ----

  alertasDelDia(delDia, reincidentes) {
    const alertas = [];

    for (const r of delDia) {
      if (r.estado === 'cancelada') continue;
      if (!Validation.esReincidente(r.telefono, reincidentes)) continue;
      alertas.push({
        tipo: 'critica',
        texto: `${MSG_REINCIDENCIA} <strong>${Utils.escapeHTML(r.cliente)}</strong> (${Utils.escapeHTML(r.telefono)}) · ${r.hora} · Cancha ${r.cancha}. Sugerencia: pedir seña.`,
      });
    }

    const sinConfirmar = delDia.filter(r => r.estado === 'pendiente').length;
    if (sinConfirmar > 0) {
      alertas.push({
        tipo: 'aviso',
        texto: `${sinConfirmar} turno${sinConfirmar > 1 ? 's' : ''} sin confirmar. Podés pedir la seña desde el copiloto 💬.`,
      });
    }

    const sinPago = delDia.filter(r =>
      r.estado !== 'cancelada' && r.estado !== 'finalizada' &&
      (r.pago === 'sin_sena' || r.pago === 'pendiente')).length;
    if (sinPago > 0) {
      alertas.push({
        tipo: 'aviso',
        texto: `${sinPago} turno${sinPago > 1 ? 's' : ''} del día sin seña ni pago registrado.`,
      });
    }

    return alertas;
  },

  renderAlertas(state, alertas) {
    const cont = document.getElementById('alertas-dia');
    if (alertas.length === 0) { cont.innerHTML = ''; return; }

    const hayCritica = alertas.some(a => a.tipo === 'critica');
    cont.innerHTML = `
      <details class="alertas-box ${hayCritica ? 'alertas-box-critica' : ''}" ${state.alertasAbiertas ? 'open' : ''}>
        <summary>
          <span class="alertas-badge">${alertas.length}</span>
          Alerta${alertas.length > 1 ? 's' : ''} del día
          <span class="alertas-hint">${hayCritica ? '· incluye reincidencia' : ''}</span>
          <span class="alertas-chevron">▾</span>
        </summary>
        <div class="alertas-lista">
          ${alertas.map(a => `<div class="alerta alerta-${a.tipo}">${a.texto}</div>`).join('')}
        </div>
      </details>`;
  },

  // ---- Grilla de disponibilidad: bloques × canchas visibles ----

  canchasVisibles(state) {
    if (state.filtroCancha) return [Number(state.filtroCancha)];
    if (state.grupoCanchas === '7-12') return CANCHAS.filter(c => c >= 7);
    if (state.grupoCanchas === 'todas') return CANCHAS;
    return CANCHAS.filter(c => c <= 6);
  },

  renderGrilla(state, delDia) {
    const canchas = Agenda.canchasVisibles(state);
    const compacta = canchas.length <= 6;
    const activasPorSlot = new Map();
    for (const r of delDia) {
      if (r.estado === 'cancelada') continue;
      activasPorSlot.set(`${r.hora}|${r.cancha}`, r);
    }

    let html = `<table class="grilla ${compacta ? 'grilla-compacta' : 'grilla-full'}">
      <thead><tr><th class="col-hora">Hora</th>`;
    html += canchas.map(c => `<th>Cancha ${c}</th>`).join('') + '</tr></thead><tbody>';

    for (const hora of BLOQUES) {
      html += `<tr><th class="col-hora">${hora}</th>`;
      for (const c of canchas) {
        const r = activasPorSlot.get(`${hora}|${c}`);
        if (!r) {
          html += `<td><button class="slot slot-libre" data-slot-libre data-hora="${hora}" data-cancha="${c}"
            title="Libre — crear reserva ${hora} · Cancha ${c}" aria-label="Libre, crear reserva ${hora} Cancha ${c}">
            <span class="slot-mas">+</span>
          </button></td>`;
        } else {
          const filtrada = Agenda.pasaFiltros(r, state) ? '' : 'slot-atenuado';
          const pagoMark = r.pago === 'pagado' ? ' · $' : r.pago === 'sena' ? ' · seña' : '';
          html += `<td><button class="slot slot-${r.estado} ${filtrada}" data-slot-reserva="${r.id}"
            title="${Utils.escapeHTML(r.cliente)} · ${ESTADOS[r.estado].label} · ${PAGOS[r.pago].label}">
            <span class="slot-nombre">${Utils.escapeHTML(r.cliente)}</span>
            <span class="slot-meta">${ESTADOS[r.estado].label}${pagoMark}</span>
          </button></td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    const wrap = document.getElementById('agenda-grilla');
    wrap.classList.toggle('scroll-x', !compacta);
    wrap.innerHTML = html;
  },

  // ---- Lista de reservas del día con acciones ----

  renderLista(state, delDia, reincidentes) {
    const filtradas = delDia.filter(r => Agenda.pasaFiltros(r, state));

    if (filtradas.length === 0) {
      document.getElementById('agenda-lista').innerHTML =
        `<div class="empty-state">
          <strong>No hay reservas para mostrar</strong>
          <span>Probá limpiar filtros o cargá una reserva nueva para esta fecha.</span>
          <button class="btn btn-primary" id="btn-empty-nueva" data-slot-libre data-hora="${BLOQUES[0]}" data-cancha="1">Crear reserva</button>
        </div>`;
      return;
    }

    const puedeVerMonto = typeof Auth === 'undefined' || Auth.esAdmin();
    const filas = filtradas.map(r => {
      const badgeReinc = Validation.esReincidente(r.telefono, reincidentes)
        ? ` <span class="badge badge-naranja" title="${MSG_REINCIDENCIA}">⚠ reincidente</span>` : '';
      return `<tr class="${r.estado === 'cancelada' ? 'fila-cancelada' : ''}">
        <td data-label="Hora" class="celda-hora"><strong>${r.hora}</strong><span class="celda-sub">${r.duracion} min</span></td>
        <td data-label="Cancha">Cancha ${r.cancha}</td>
        <td data-label="Cliente"><strong>${Utils.escapeHTML(r.cliente)}</strong>${badgeReinc}<span class="celda-sub">${Utils.escapeHTML(r.telefono)}</span></td>
        <td data-label="Estado"><span class="badge badge-${ESTADOS[r.estado].color}">${ESTADOS[r.estado].label}</span></td>
        <td data-label="Pago"><span class="badge badge-${PAGOS[r.pago].color}">${PAGOS[r.pago].label}</span><span class="celda-sub">${Utils.escapeHTML(r.medioPago || '')}</span></td>
        ${puedeVerMonto ? `<td data-label="Monto" class="celda-monto">${Utils.moneda(r.monto)}</td>` : ''}
        <td data-label="Obs." class="celda-obs">${Utils.escapeHTML(r.obs || 'Sin observaciones')}</td>
        <td data-label="Acciones" class="celda-acciones">${Agenda.botonesAccion(r)}</td>
      </tr>`;
    }).join('');

    document.getElementById('agenda-lista').innerHTML = `
      <div class="scroll-x"><table class="tabla">
        <thead><tr>
          <th>Hora</th><th>Cancha</th><th>Cliente</th><th>Estado</th>
          <th>Pago</th>${puedeVerMonto ? '<th>Monto</th>' : ''}<th>Obs.</th><th>Acciones</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table></div>`;
  },

  botonesAccion(r) {
    const b = [];
    const btn = (accion, label, title, clase = 'btn-ghost') =>
      `<button class="btn ${clase} btn-mini" data-accion="${accion}" data-id="${r.id}" title="${title}">${label}</button>`;

    if (r.estado === 'pendiente') b.push(btn('confirmar', '✓ Confirmar', 'Marcar como confirmada', 'btn-verde'));
    if (r.estado === 'confirmada' || r.estado === 'pendiente') {
      b.push(btn('finalizar', 'Finalizar', 'Marcar como finalizada'));
      b.push(btn('no_asistio', 'No asistió', 'Marcar como no asistió'));
    }
    b.push(btn('pago', 'Pago', 'Registrar pago o seña'));
    b.push(btn('mensajes', 'WhatsApp', 'Copiloto de mensajes de WhatsApp'));
    b.push(btn('editar', 'Editar', 'Editar reserva'));
    if (r.estado !== 'cancelada' && r.estado !== 'finalizada') {
      b.push(btn('cancelar', 'Cancelar', 'Cancelar reserva'));
    }
    return `<div class="acciones-grupo">${b.join('')}</div>`;
  },
};
