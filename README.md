# 🎾 Agenda Inteligente Interna — Nivel Padel Club

Herramienta interna de gestión de reservas para **Nivel Padel Club** (Córdoba, Argentina), pensada para que el personal de recepción reemplace el cuaderno de papel por una agenda digital rápida, clara y sin costo operativo.

---

## 1. Problema detectado

El club gestiona las reservas de sus **12 canchas** a mano, en un cuaderno. Eso genera:

- Demoras para saber qué horarios están libres.
- Riesgo de **dobles reservas** en la misma cancha y horario.
- Poco control de señas, pagos y cancelaciones.
- Cero visibilidad de ocupación, horarios flojos e ingresos.
- Mensajes de confirmación/recordatorio escritos a mano, uno por uno.
- Dependencia total de un objeto físico que se puede perder o dañar.

## 2. Solución propuesta

Una **aplicación web interna** (agenda + dashboard) que:

- Muestra la **grilla de disponibilidad** del día (10 bloques de 90 min × 12 canchas) de un vistazo: lo libre se ve libre y se reserva con un click.
- **Bloquea las dobles reservas** con una validación centralizada (regla crítica del negocio).
- Registra estado del turno, seña/pago, medio de pago y monto.
- Incluye un **Copiloto de mensajes** que redacta el mensaje de WhatsApp correcto según el estado de la reserva (confirmación, pedido de seña, recordatorio, cancelación) y lo abre en WhatsApp con un click.
- Ofrece un **dashboard semanal**: ocupación, ingresos proyectados y reales, cancha y día más fuertes, horarios flojos para promocionar, y alertas de clientes reincidentes por no asistencia.
- Exporta todo a **CSV** y trae **datos demo** listos para presentar.

## 3. Arquitectura y stack

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | HTML + CSS + JavaScript vanilla (sin frameworks, sin build) | Producto terminado y demostrable: se abre con doble click en `index.html`, corre en cualquier máquina del club, cero dependencias, cero costo. |
| Persistencia | `localStorage` detrás de un módulo `Store` | Los datos sobreviven al cerrar el navegador. El `Store` encapsula todo el acceso: migrar a una API/base de datos real es reemplazar un solo archivo. |
| Lógica de negocio | Módulos separados (`validation`, `whatsapp`, `dashboard`) | La regla anti-duplicados y las métricas viven en un solo lugar, reutilizables y testeables. |
| Copiloto IA | Plantillas dinámicas según estado de la reserva | Demuestra el valor del copiloto sin costo de API; el módulo `WhatsApp.generarMensaje()` es el punto exacto donde se enchufaría un LLM real (Claude API) en el futuro. |
| Estética | Paleta validada por accesibilidad (modo claro y oscuro automático) | Uso por personal no técnico, en recepción, de día y de noche. |

### Estructura de archivos

```
index.html          Estructura de la app (vistas, modales)
css/styles.css      Estilos, tema claro/oscuro, responsive
js/config.js        Reglas del club: canchas, bloques 08:00–23:00, estados, mensajes obligatorios
js/utils.js         Fechas locales, formato moneda/porcentaje, toasts
js/store.js         Persistencia (localStorage) + CRUD + exportación CSV
js/demo.js          ~30 reservas demo realistas, adaptadas a la semana actual
js/validation.js    ⭐ Validación anti-duplicados centralizada + reincidencia de no asistencia
js/whatsapp.js      Copiloto de mensajes + normalización de teléfonos + links wa.me
js/agenda.js        Vista agenda: cards, alertas, grilla de disponibilidad, lista con acciones
js/dashboard.js     Métricas del día/semana, gráficos de barras, alertas del negocio
js/app.js           Estado global, navegación, formularios y eventos
```

## 4. Cómo ejecutar el proyecto

**Opción A (la más simple):** doble click en `index.html`. Funciona directo desde el disco.

**Opción B (servidor local):**

```bash
npx serve .          # o: python -m http.server 8000
```

y abrir la URL que indique la terminal.

No requiere instalación, cuentas ni configuración. Los datos demo se cargan solos la primera vez.

## 5. Guion de demo sugerido

1. **Dashboard** → mostrar ocupación semanal, ingresos proyectados vs. reales, horarios flojos y la alerta de reincidencia.
2. **Agenda** → grilla del día: verde confirmado, amarillo pendiente, huecos "Libre".
3. Cambiar de fecha con ‹ › o el calendario.
4. Click en un hueco **Libre** → se abre el formulario con fecha, hora y cancha ya cargadas → guardar.
5. Intentar crear **otra reserva en la misma fecha, hora y cancha** → el sistema la bloquea con el mensaje: *"No se puede registrar esta reserva porque la cancha ya está ocupada en ese día y horario."*
6. Editar una reserva (la validación no la detecta contra sí misma).
7. En la vista **Lista**: confirmar un turno pendiente (✓), registrar seña con 💲.
8. Abrir 💬 el **Copiloto**: ver el mensaje sugerido según el estado, alternar entre confirmación / seña / recordatorio / cancelación, copiar o abrir WhatsApp.
9. Cancelar una reserva 🚫 → el horario vuelve a quedar libre en la grilla.
10. Marcar un turno como **No asistió** 🚷 → si el cliente ya tenía una falta, aparece la alerta de reincidencia.
11. Exportar todo con **⬇ CSV** (abre directo en Excel).
12. **↺ Demo** reinicia los datos de demostración en cualquier momento.

## 6. Funcionalidades implementadas

Agenda diaria con grilla y lista · cambio de fecha · filtros por cancha/estado/pago · alta, edición y cancelación de reservas · validación anti-duplicados centralizada · estados de turno (pendiente, confirmada, cancelada, finalizada, no asistió) · estados de pago (sin seña, seña, pagado, pendiente) con medio y monto · copiloto de mensajes con 4 plantillas y sugerencia inteligente · links de WhatsApp con teléfono normalizado y validación (*"Teléfono inválido o incompleto."*) · dashboard diario y semanal con ocupación, ingresos proyectados/reales, cancha y día top, horarios fuertes/flojos · alerta de reincidencia por no asistencia (2+ faltas del mismo teléfono) · exportación CSV · datos demo con carga y reinicio · modo oscuro automático · responsive (PC y celular).

## 7. Limitaciones del MVP

- No integra pagos reales (Mercado Pago se registra como medio, no cobra).
- No usa la API oficial de WhatsApp: abre `wa.me` con el mensaje precargado.
- Los datos viven en el navegador (`localStorage`): sirven para un puesto de recepción; para varios dispositivos simultáneos hace falta un backend con base de datos.
- No hay login ni roles: cualquier persona con acceso a la máquina puede operar.
- El copiloto usa plantillas inteligentes, no un modelo de IA en vivo.
- Los ingresos "reales" se calculan sobre el monto total de la reserva (una seña se cuenta completa, según la definición del enunciado).

## 8. Próximas mejoras

1. Backend liviano (Node/Express o Supabase) con base de datos en la nube y sincronización multiusuario.
2. Login por roles (recepción / administración).
3. Turnos fijos semanales automáticos para clientes recurrentes.
4. Recordatorios automáticos programados vía WhatsApp Business API.
5. Cobro de señas online con Mercado Pago (link de pago en el mensaje de seña).
6. Copiloto conectado a la API de Claude para mensajes personalizados por historial del cliente.
7. Portal público de reservas para clientes.
8. Gestión de clientes frecuentes con historial y promociones dirigidas a horarios flojos.
9. Módulo de torneos y clases.
