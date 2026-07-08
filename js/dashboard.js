/* =========================================================
   Dashboard: métricas del día y de la semana de referencia,
   gráficos simples (barras HTML/CSS) y alertas del negocio.
   ========================================================= */

const Dashboard = {

  render(state) {
    const fecha = state.dashFecha;
    const dias = Utils.diasDeSemana(fecha);
    const semana = Store.getPorRango(dias[0], dias[6]);
    const delDia = semana.filter(r => r.fecha === fecha);
    const activasSemana = semana.filter(r => r.estado !== 'cancelada');
    const activasDia = delDia.filter(r => r.estado !== 'cancelada');

    document.getElementById('dash-rango-semana').textContent =
      `${Utils.fechaCorta(dias[0])} al ${Utils.fechaCorta(dias[6])}`;

    // ---- Métricas base ----
    const suma = lista => lista.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const ingresosProyectados = suma(activasSemana);
    const ingresosReales = suma(semana.filter(r =>
      r.estado === 'finalizada' || r.pago === 'pagado' || r.pago === 'sena'));
    const ocupacionDia = activasDia.length / CAPACIDAD_DIARIA;
    const ocupacionSemana = activasSemana.length / CAPACIDAD_SEMANAL;

    const cuentaDia = estado => delDia.filter(r => r.estado === estado).length;
    const cancelacionesSemana = semana.filter(r => r.estado === 'cancelada').length;
    const noAsistenciasSemana = semana.filter(r => r.estado === 'no_asistio').length;

    // ---- Agregaciones para gráficos e insights ----
    const porDia = dias.map(d => ({
      dia: d,
      total: activasSemana.filter(r => r.fecha === d).length,
    }));
    const porBloque = BLOQUES.map(h => ({
      hora: h,
      total: activasSemana.filter(r => r.hora === h).length,
    }));
    const porCancha = CANCHAS.map(c => ({
      cancha: c,
      total: activasSemana.filter(r => Number(r.cancha) === c).length,
    }));

    const mejorDia = [...porDia].sort((a, b) => b.total - a.total)[0];
    const mejorCancha = [...porCancha].sort((a, b) => b.total - a.total)[0];
    const bloquesOrdenados = [...porBloque].sort((a, b) => b.total - a.total);
    const horarioTop = bloquesOrdenados[0];
    const horarioFlojo = bloquesOrdenados[bloquesOrdenados.length - 1];

    // ---- Render ----
    document.getElementById('dash-contenido').innerHTML = `
      <div class="cards">
        ${Dashboard.kpi('Reservas activas (semana)', activasSemana.length, `${semana.length} totales`)}
        ${Dashboard.kpi('Ocupación del día', Utils.porcentaje(ocupacionDia), `${activasDia.length} de ${CAPACIDAD_DIARIA} turnos`)}
        ${Dashboard.kpi('Ocupación semanal', Utils.porcentaje(ocupacionSemana), `${activasSemana.length} de ${CAPACIDAD_SEMANAL} turnos`)}
        ${Dashboard.kpi('Ingresos proyectados', Utils.moneda(ingresosProyectados), 'reservas activas de la semana', true)}
        ${Dashboard.kpi('Ingresos reales', Utils.moneda(ingresosReales), 'finalizadas, pagadas o con seña', true)}
        ${Dashboard.kpi('Cancelaciones', cancelacionesSemana, 'semana de referencia')}
        ${Dashboard.kpi('No asistencias', noAsistenciasSemana, 'alerta para seguimiento')}
      </div>

      <div class="panel">
        <h3 class="panel-titulo">Resumen del día · ${Utils.fechaLegible(fecha)}</h3>
        <div class="resumen-estados">
          ${Object.entries(ESTADOS).map(([k, e]) =>
            `<span class="badge badge-${e.color}">${e.label}: <strong>${cuentaDia(k)}</strong></span>`).join('')}
        </div>
        <div class="progress-line" title="Ocupación del día"><span style="width:${Math.min(100, ocupacionDia * 100)}%"></span></div>
      </div>

      <div class="panel">
        <h3 class="panel-titulo">Lectura rápida para gestión</h3>
        <div class="dash-insights">
          <div class="insight"><span>Cancha más usada</span><strong>Cancha ${mejorCancha.cancha}</strong><small>${mejorCancha.total} reservas</small></div>
          <div class="insight"><span>Horario más ocupado</span><strong>${horarioTop.hora}</strong><small>${horarioTop.total} reservas</small></div>
          <div class="insight"><span>Horario para promo</span><strong>${horarioFlojo.hora}</strong><small>${horarioFlojo.total} reservas</small></div>
          <div class="insight"><span>Día fuerte</span><strong>${Utils.diaSemanaCorto(mejorDia.dia)}</strong><small>${mejorDia.total} reservas</small></div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="panel">
          <h3 class="panel-titulo">Reservas activas por día</h3>
          ${Dashboard.graficoBarras(porDia.map(d => ({
            label: Utils.diaSemanaCorto(d.dia),
            valor: d.total,
            destacar: d.dia === mejorDia.dia && mejorDia.total > 0,
            titulo: `${Utils.fechaLegible(d.dia)}: ${d.total} reservas activas`,
          })))}
          <p class="panel-nota">📈 Día con más reservas: <strong>${Utils.fechaLegible(mejorDia.dia)}</strong> (${mejorDia.total})</p>
        </div>

        <div class="panel">
          <h3 class="panel-titulo">Ocupación por horario (semana)</h3>
          ${Dashboard.graficoBarras(porBloque.map(b => ({
            label: b.hora,
            valor: b.total,
            destacar: b.hora === horarioTop.hora && horarioTop.total > 0,
            titulo: `Bloque ${b.hora}: ${b.total} reservas en la semana`,
          })))}
          <p class="panel-nota">🔥 Más ocupado: <strong>${horarioTop.hora}</strong> (${horarioTop.total}) ·
             🧊 Más flojo: <strong>${horarioFlojo.hora}</strong> (${horarioFlojo.total}) — ideal para promociones</p>
        </div>

        <div class="panel">
          <h3 class="panel-titulo">Reservas por cancha (semana)</h3>
          ${Dashboard.graficoBarras(porCancha.map(c => ({
            label: 'C' + c.cancha,
            valor: c.total,
            destacar: c.cancha === mejorCancha.cancha && mejorCancha.total > 0,
            titulo: `Cancha ${c.cancha}: ${c.total} reservas en la semana`,
          })))}
          <p class="panel-nota">🏆 Cancha con más reservas: <strong>Cancha ${mejorCancha.cancha}</strong> (${mejorCancha.total})</p>
        </div>

        <div class="panel">
          <h3 class="panel-titulo">Alertas del negocio</h3>
          ${Dashboard.renderAlertas(delDia)}
        </div>
      </div>`;
  },

  kpi(label, valor, sub, chico = false) {
    return `<div class="card">
      <span class="card-label">${label}</span>
      <span class="card-valor ${chico ? 'card-valor-sm' : ''}">${valor}</span>
      <span class="card-sub">${sub}</span>
    </div>`;
  },

  // Gráfico de barras en HTML/CSS: una serie, un solo tono; el valor
  // máximo se destaca con el paso más oscuro del mismo tono (magnitud,
  // no categoría). Etiquetas directas sobre cada barra.
  graficoBarras(datos) {
    const max = Math.max(1, ...datos.map(d => d.valor));
    return `<div class="grafico" role="img" aria-label="Gráfico de barras">
      ${datos.map(d => `
        <div class="barra-col" title="${d.titulo}">
          <span class="barra-valor">${d.valor || ''}</span>
          <div class="barra ${d.destacar ? 'barra-destacada' : ''}" style="height:${Math.max(3, (d.valor / max) * 100)}%"></div>
          <span class="barra-label">${d.label}</span>
        </div>`).join('')}
    </div>`;
  },

  renderAlertas(delDia) {
    const alertas = [];
    const reincidentes = Validation.clientesReincidentes();

    for (const [tel, info] of reincidentes) {
      alertas.push(`<div class="alerta alerta-critica">⚠️ ${MSG_REINCIDENCIA} —
        <strong>${Utils.escapeHTML(info.cliente)}</strong> (tel. ${tel}) acumula ${info.faltas} faltas.
        Sugerencia: pedir seña por adelantado.</div>`);
    }

    const sinSena = delDia.filter(r =>
      r.estado !== 'cancelada' && r.estado !== 'finalizada' &&
      (r.pago === 'sin_sena' || r.pago === 'pendiente'));
    if (sinSena.length > 0) {
      alertas.push(`<div class="alerta alerta-aviso">💵 ${sinSena.length} turno${sinSena.length > 1 ? 's' : ''} del día
        sin seña ni pago registrado.</div>`);
    }

    if (alertas.length === 0) {
      alertas.push('<div class="alerta alerta-ok">✅ Sin alertas: la operación está al día.</div>');
    }
    return alertas.join('');
  },
};
