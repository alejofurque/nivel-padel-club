# Agenda Inteligente Interna - Nivel Padel Club

Aplicacion web interna para gestionar reservas de **Nivel Padel Club** con agenda operativa, login por roles, persistencia en Supabase y copiloto de mensajes de WhatsApp con OpenAI o fallback local.

## Problema

El club administra 12 canchas en un cuaderno de papel. Eso dificulta ver disponibilidad, aumenta el riesgo de dobles reservas, hace lento el seguimiento de pagos y deja sin metricas claras a la administracion.

## Solucion

La app reemplaza el cuaderno por una agenda digital simple para recepcion:

- Agenda diaria con 12 canchas y bloques de 90 minutos.
- Alta, edicion, confirmacion, cancelacion y no asistencia.
- Validacion anti-duplicados centralizada.
- Reservas canceladas liberan disponibilidad.
- Dashboard financiero y operativo solo para Administrador.
- Copiloto WhatsApp con OpenAI y fallback local sin API key.
- Persistencia principal en Supabase, con modo local solo como fallback de demo.
- Exportacion CSV para administracion.

## Stack

- Frontend: HTML, CSS y JavaScript vanilla.
- Backend minimo: Node.js + Express.
- Base de datos/Auth: Supabase Free Tier.
- IA: OpenAI Chat Completions usando `OPENAI_API_KEY` en servidor.
- Sin framework frontend ni build obligatorio.

## Arquitectura

```text
index.html              Vistas, login y modales
css/styles.css          UI responsive, modo claro/oscuro, login y copiloto
js/config.js            Canchas, horarios, estados y mensajes obligatorios
js/db.js                Cliente Supabase y mapeo tabla reservations
js/auth.js              Login por usuario/clave y roles
js/store.js             Fachada de datos: Supabase o fallback local
js/validation.js        Regla anti-duplicados centralizada
js/whatsapp.js          Normalizacion de telefonos, wa.me, OpenAI/fallback
js/agenda.js            Agenda diaria, filtros, grilla/lista y alertas
js/dashboard.js         Metricas protegidas para Administrador
js/demo.js              Seed demo semanal
js/app.js               Estado global, eventos y permisos UI
server.js               Servidor estatico + endpoints /api
supabase/schema.sql     SQL idempotente de tablas, indices y RLS
.env.example            Variables esperadas
```

## Configuracion

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` a partir de `.env.example`:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

La `SUPABASE_ANON_KEY` puede usarse en frontend porque Supabase la disena para clientes publicos y la seguridad real depende de RLS. `OPENAI_API_KEY` nunca se expone al navegador: solo la lee `server.js`.

3. Ejecutar:

```bash
npm start
```

Abrir [http://localhost:4173](http://localhost:4173).

> Si se abre `index.html` directo, la app cae a modo local de demo porque no puede leer `/api/config`. Para Supabase y OpenAI reales, usar `npm start`.

## Supabase

1. Crear un proyecto en Supabase.
2. Ir a **SQL Editor**.
3. Ejecutar completo el archivo [supabase/schema.sql](supabase/schema.sql).
4. Copiar `Project URL` en `SUPABASE_URL`.
5. Copiar `anon public` en `SUPABASE_ANON_KEY`.

El SQL crea:

- `public.reservations`.
- `public.profiles`.
- constraints de estados validos.
- indice unico parcial `date + time + court` para reservas no canceladas.
- trigger de `updated_at`.
- RLS y politicas basicas.

## Usuarios Demo

Crear en Supabase Auth:

- Email: `admin@nivelpadel.local`, password: `admin123`, auto confirm.
- Email: `recepcion@nivelpadel.local`, password: `recepcion123`, auto confirm.

La app pide usuario simple:

- `admin` / `admin123` -> Administrador.
- `recepcion` / `recepcion123` -> Recepcionista.

El trigger de Supabase crea perfiles automaticamente:

- `admin` -> `admin`.
- `recepcion` -> `recepcionista`.

## Roles

Administrador puede ver agenda, dashboard, metricas financieras, exportar CSV y resetear datos demo.

Recepcionista puede ver agenda, crear, editar, confirmar, cancelar, marcar no asistencia y generar WhatsApp. No ve la pestana Dashboard. Si fuerza el acceso, la app muestra:

> No tenés permisos para acceder a esta sección.

## OpenAI y Fallback

Endpoint principal:

```text
POST /api/generate-whatsapp-message
```

El servidor recibe tipo de mensaje y datos de reserva, llama a OpenAI con `OPENAI_MODEL` o `gpt-4o-mini`, y devuelve `{ mensaje }`.

Tipos soportados:

- Confirmacion de reserva.
- Solicitud de sena o comprobante.
- Recordatorio.
- Cancelacion registrada.
- Mensaje operativo personalizado.

Si `OPENAI_API_KEY` no existe, esta vacia o falla la llamada:

- La app muestra `IA procesando mensaje...`.
- Espera al menos 1.5 segundos.
- Genera una plantilla local dinamica con datos reales.
- Permite copiar y abrir WhatsApp igual.

## Reglas De Negocio

La validacion anti-duplicados vive en [js/validation.js](js/validation.js):

- Bloquea misma fecha + hora + cancha si la reserva existente no esta cancelada.
- Ignora la propia reserva al editar.
- Mensaje obligatorio:

```text
No se puede registrar esta reserva porque la cancha ya está ocupada en ese día y horario.
```

Supabase refuerza la regla con un indice unico parcial sobre reservas activas. Si dos usuarios intentan guardar al mismo tiempo, la base tambien bloquea el duplicado.

## Datos Demo

El seed demo incluye mas de 20 reservas distribuidas en la semana actual, estados variados, pagos variados y una reincidencia de `No asistio`.

- En modo local se carga automaticamente si no hay reservas.
- En Supabase no se auto-siembra para evitar duplicados.
- El Administrador puede usar `Demo` para resetear y cargar reservas demo.

## Guion De Demo

1. Ejecutar `npm start`.
2. Entrar con `admin` / `admin123`.
3. Ver Agenda, filtros, canchas 1-6 / 7-12 y vista lista.
4. Entrar al Dashboard y mostrar ingresos, ocupacion, rankings y alertas.
5. Crear una reserva nueva desde un slot libre.
6. Intentar crear otra reserva activa en el mismo dia, hora y cancha.
7. Ver el bloqueo anti-duplicado con el mensaje obligatorio.
8. Editar la reserva y guardar sin que se detecte contra si misma.
9. Cancelar la reserva y crear otra en el mismo slot.
10. Abrir Copiloto WhatsApp, generar mensaje, copiarlo y abrir `wa.me`.
11. Quitar `OPENAI_API_KEY` y reiniciar para mostrar fallback local.
12. Exportar CSV.
13. Cerrar sesion.
14. Entrar con `recepcion` / `recepcion123`.
15. Confirmar que puede operar agenda y WhatsApp, pero no Dashboard.
16. Verificar que los cambios persisten en Supabase al recargar.

## Limitaciones

- No hay pagos reales ni integracion Mercado Pago.
- WhatsApp usa `wa.me`; no usa WhatsApp Business API.
- La `SERVICE_ROLE_KEY` no se usa ni debe cargarse en frontend.
- El fallback local existe para demo academica sin presupuesto de IA.
- Supabase con CDN requiere conexion a internet; sin servidor o sin config la app usa modo local.

## Futuras Mejoras

- Edge Function para mover mas reglas al servidor.
- Auditoria detallada por usuario.
- Turnos fijos recurrentes.
- Recordatorios automaticos con WhatsApp Business API.
- Portal publico de reservas.
- Links de pago reales.
- Reportes descargables por periodo.
