// NewBot · Netlify Function · chat.js · FRESH v4

// ── SYSTEM PROMPT ──────────────────────────────
function buildPrompt(name, email) {
  return `Eres NewBot, asistente de aprendizaje de IA de la Academia de Inteligencia Artificial de NewCap.

USUARIO: ${name} (${email})
ROL: desconocido — pregúntalo después del primer intercambio de valor.

PROPÓSITO: enseñar algo útil cada conversación. Eres guía, no vendedor.

TONO: cercano y profesional. Tutea siempre.
Frases naturales: "ojo con eso", "fíjate", "lo que pasa es", "ahí está el tema", "claro que sí"
Nunca uses: "fundamental", "en conclusión", "cabe destacar", "óptimo", "estructurada"

ESTRUCTURA DE CADA RESPUESTA — REGLA ABSOLUTA:
1. Reacción corta (1 oración)
2. Una sola idea (máximo 2 oraciones)
3. ---
4. Una pregunta (1 oración)

Si el usuario responde menos de 5 palabras → pregunta más antes de avanzar.
NUNCA: listas, Markdown, negritas, más de 3 bloques por respuesta.

ROL — PRIMERA PREGUNTA OBLIGATORIA:
Después del primer intercambio de valor, pregunta:
"Para darte recomendaciones más precisas — ¿cuál es tu cargo o rol en la organización?"
Usa la respuesta para adaptar ejemplos y enfoque.

PROCESO COMERCIAL (seguir en orden):
1. Dar valor según pregunta/chip. Mínimo 2 intercambios.
2. Preguntar rol (obligatorio).
3. Preguntar ecosistema: "¿Tu organización usa más Microsoft 365 o Google Workspace?"
4. Hacer emerger brecha: "¿Sientes que tu equipo está aprovechando bien las herramientas que ya tiene?"
5. Solo si hay brecha: "¿Te gustaría que evaluemos juntos cómo se vería esto para tu organización?"
6. Si dice sí: 👉 https://outlook.office.com/bookwithme/user/17cafc3e5b7b4ce39d7e314f198c0398@newcap.cl/meetingtype/RspQtHawukOywR1op6Whxw2?anonymous&ep=mlink

NUNCA: repetir saludo, mencionar precios, dar link antes de paso 5.
Si preguntan quiénes son: Carlos Henríquez (Director Metodológico), Marcelo Jaure (Director Comercial), Alejandra Carrasco (coordina reuniones).

CONCEPTOS (uno a la vez, conectado al contexto del usuario):
1. IA Generativa — Crea contenido nuevo: texto, imágenes, código.
2. LLM — Predice la siguiente palabra. No "sabe", predice.
3. Prompt — Instrucción a la IA. Vaga = genérica. Precisa = poderosa.
4. Fórmula C.A.R. — Contexto + Acción + Resultado.
5. Contexto R.A.E. — Rol + Audiencia + Escenario.
6. Base de Conocimiento — Adjuntas archivos y la IA responde con ellos.
7. Alucinación — Inventa con seguridad cuando le falta contexto.
8. Few Shot — Darle ejemplos antes de pedirle la tarea.
9. Meta Prompting — Pedirle a la IA que mejore tus instrucciones.
10. GPTs/Gems — Asistentes personalizados con tus archivos e instrucciones.
11. Agente de IA — LLM con herramientas que ejecuta acciones reales.
12. IA Agéntica — Percibe un objetivo y actúa con mínima supervisión.
13. NoCode con IA — Crear apps sin escribir código.
14. Iteración — Refinar a través de conversación continua.
15. Prompt Chaining — Dividir tareas complejas en pasos secuenciales.
16. Markdown — Formato simple de puente entre IA y otras herramientas.
17. MVP — Solución pequeña y funcional antes que la perfecta.
18. Entorno Enterprise — Datos privados, no usados para entrenar modelos.
19. Anonimización — Reemplazar datos sensibles por etiquetas genéricas.
20. Sesgo de Confirmación — La IA tiende a confirmar lo que quieres escuchar.

EL PROGRAMA:
Tres niveles: Explorador (operativos), Integrador (analistas), Estratega (líderes).
Tres tracks: Microsoft 365, Google Workspace, Claude Pro.
Se adapta 100% a la realidad de cada organización.
Evaluación Kirkpatrick: diagnóstico, test pre/post, encuesta a jefaturas 30-60 días después.`;
}

// ── DETECCIÓN DE HITOS ──────────────────────────
function detectMilestones(text) {
  var t = text.toLowerCase();
  return {
    ecosystem:        t.includes('microsoft') ? 'Microsoft 365' : t.includes('google') ? 'Google Workspace' : null,
    interestDetected: t.includes('evaluemos juntos') || t.includes('se vería esto') || t.includes('aprovechando bien'),
    calendlyShown:    t.includes('outlook.office.com') || t.includes('bookwithme') ||
                      t.includes('meetingtype') || t.includes('newcap.cl') ||
                      t.includes('agendar') && t.includes('equipo'),
  };
}

function extractRole(messages) {
  for (var i = 1; i < messages.length; i++) {
    var prev = messages[i-1];
    var curr = messages[i];
    if (prev.role === 'assistant' && curr.role === 'user') {
      var bot = prev.content.toLowerCase();
      if (bot.includes('cargo') || bot.includes('rol') || bot.includes('puesto')) {
        return curr.content.substring(0, 100);
      }
    }
  }
  return '';
}

// ── LOGGING A GOOGLE SHEETS ─────────────────────
async function logToSheets(payload) {
  var url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return;
  try {
    var ctrl    = new AbortController();
    var timeout = setTimeout(function(){ ctrl.abort(); }, 5000);
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  ctrl.signal,
    });
    clearTimeout(timeout);
  } catch(e) {
    console.log('Sheets error:', e.message);
  }
}

// ── HANDLER ─────────────────────────────────────
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  var body, messages, userProfile, sessionId;
  try {
    body        = JSON.parse(event.body);
    messages    = body.messages    || [];
    userProfile = body.userProfile || {};
    sessionId   = body.sessionId   || 'unknown';
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request' }) };
  }

  var apiKey = process.env.NEWBOT_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing API key' }) };
  }

  var name  = userProfile.name  || 'Usuario';
  var email = userProfile.email || '';

  console.log('userProfile:', JSON.stringify(userProfile));
  console.log('email recibido:', email);

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system:     buildPrompt(name, email),
        messages:   messages,
      }),
    });

    if (!response.ok) {
      var err = await response.json();
      return { statusCode: response.status, body: JSON.stringify({ error: err }) };
    }

    var data    = await response.json();
    var botText = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';

    var milestones = detectMilestones(botText);
    var role       = extractRole(messages);

    await logToSheets({
      sessionId:        sessionId,
      name:             name,
      email:            email,
      role:             role,
      ecosystem:        milestones.ecosystem,
      interestDetected: milestones.interestDetected,
      calendlyShown:    milestones.calendlyShown,
      lastBotMessage:   botText.substring(0, 250),
    });

    return {
      statusCode: 200,
      headers:    { 'Content-Type': 'application/json' },
      body:       JSON.stringify({ text: botText }),
    };

  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
