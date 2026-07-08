/* =========================================================
   Servidor minimo de Nivel Padel Club.
   - Sirve el frontend estatico.
   - GET  /api/config -> config publica (Supabase URL + anon key).
   - POST /api/generate-whatsapp-message -> mensaje WhatsApp con OpenAI.

   OPENAI_API_KEY vive solo aca: nunca llega al navegador.
   ========================================================= */

require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 4173;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname, { index: 'index.html' }));

app.get('/api/config', (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    iaDisponible: Boolean(OPENAI_API_KEY),
    modelo: OPENAI_API_KEY ? OPENAI_MODEL : null,
  });
});

const DESCRIPCION_TIPO = {
  confirmacion: 'Confirmacion de reserva: confirmale al cliente su turno.',
  sena: 'Solicitud de sena o comprobante: el turno esta pre-reservado y debe enviar sena o comprobante para confirmarlo.',
  recordatorio: 'Recordatorio: recordale el turno y sugerile llegar 10 minutos antes.',
  cancelacion: 'Cancelacion registrada: informale que su cancelacion quedo registrada y agradecele por avisar.',
  personalizado: 'Mensaje operativo personalizado: redacta el mensaje siguiendo la instruccion del personal del club.',
};

function textoSeguro(valor, fallback = 'no informado') {
  const texto = String(valor ?? '').trim();
  return texto || fallback;
}

function armarDatosReserva(reserva) {
  return [
    `- Nombre del cliente: ${textoSeguro(reserva.cliente)}`,
    reserva.telefono ? `- Telefono: ${reserva.telefono}` : null,
    `- Fecha: ${textoSeguro(reserva.fechaLegible || reserva.fecha)}`,
    `- Hora: ${textoSeguro(reserva.hora)}`,
    `- Cancha: ${textoSeguro(reserva.cancha)}`,
    `- Estado del turno: ${textoSeguro(reserva.estado)}`,
    `- Estado de pago: ${textoSeguro(reserva.pago)}`,
    `- Medio de pago: ${textoSeguro(reserva.medioPago, 'No definido')}`,
    `- Monto: ${reserva.monto ? '$' + reserva.monto : 'no informado'}`,
    reserva.obs ? `- Observaciones internas: ${reserva.obs}` : null,
  ].filter(Boolean).join('\n');
}

async function generarMensajeOpenAI({ reserva, tipo, instruccion }) {
  const datos = armarDatosReserva(reserva);
  const prompt =
    'Genera un mensaje breve de WhatsApp para un cliente de un club de padel en Cordoba, Argentina.\n' +
    'Usa tono claro, amable y profesional, con espanol argentino y voseo natural.\n' +
    'No inventes datos. No menciones que sos una IA. No uses markdown ni encabezados.\n' +
    'El mensaje debe estar listo para enviar por WhatsApp y tener entre 2 y 4 oraciones.\n\n' +
    `Tipo de mensaje: ${DESCRIPCION_TIPO[tipo]}\n` +
    (tipo === 'personalizado' && instruccion ? `Instruccion del personal: ${instruccion}\n` : '') +
    `\nDatos de la reserva:\n${datos}`;

  const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.45,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'Sos un asistente de recepcion de Nivel Padel Club. Redactas mensajes breves, naturales y profesionales para WhatsApp. Respondes solo con el texto del mensaje.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`OpenAI respondio ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const data = await respuesta.json();
  const mensaje = data.choices?.[0]?.message?.content?.trim();
  if (!mensaje) throw new Error('OpenAI devolvio una respuesta vacia');
  return mensaje;
}

async function manejarGeneracion(req, res) {
  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: 'ia_no_configurada' });
  }

  const { reserva, tipo, instruccion = '' } = req.body || {};
  if (!reserva || !tipo || !DESCRIPCION_TIPO[tipo]) {
    return res.status(400).json({ error: 'peticion_invalida' });
  }

  try {
    const mensaje = await generarMensajeOpenAI({ reserva, tipo, instruccion });
    res.json({ mensaje, modelo: OPENAI_MODEL, proveedor: 'openai' });
  } catch (err) {
    console.error('[IA] Error llamando a OpenAI:', err.message);
    res.status(502).json({ error: 'ia_fallo' });
  }
}

app.post('/api/generate-whatsapp-message', manejarGeneracion);
// Alias de compatibilidad con la migracion parcial anterior.
app.post('/api/generar-mensaje', manejarGeneracion);

app.listen(PORT, () => {
  console.log(`Nivel Padel Club corriendo en http://localhost:${PORT}`);
  console.log(`- Supabase: ${process.env.SUPABASE_URL ? 'configurado' : 'NO configurado (modo local)'}`);
  console.log(`- IA (OpenAI): ${OPENAI_API_KEY ? `configurada (${OPENAI_MODEL})` : 'NO configurada (fallback local)'}`);
});
