// Clasificación de miedos por tema real (no por la primera letra de la frase).
// Usa Workers AI para extraer el sustantivo/concepto del miedo y deriva la letra.
// Si la IA falla, cae a una heurística en español; como último recurso, la
// primera letra del contenido.

const CLASSIFY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const CLASSIFY_PROMPT = `Identifica el MIEDO DE FONDO de la frase: la causa emocional o el concepto detrás del miedo, no el objeto literal ni la frase completa. Si menciona a una persona o una situación, traduce a qué teme la persona en su raíz.

Elige el concepto más cercano de esta lista, o si ninguno encaja escribe uno equivalente breve (1-2 palabras):
fracaso, rechazo, abandono, soledad, maltrato, muerte, enfermedad, pobreza, oscuridad, animales, alturas, exposición, incertidumbre, pérdida, compromiso, encierro, multitudes, sangre, olvido

Ejemplos:
- "Tengo miedo a que nadie ocupe esta app" -> fracaso
- "Tengo miedo a mi papá" -> maltrato
- "Tengo miedo a las arañas" -> animales
- "Me da miedo la oscuridad" -> oscuridad
- "Tengo miedo de perder a mi familia" -> pérdida

Responde ÚNICAMENTE con el concepto elegido, en minúsculas, sin punto final ni explicaciones.`;

const ARTICLE_RE = /^(?:el|la|los|las|lo|un|una|unos|unas)\s+/i;
const AUX_RE = /^(?:ser|estar|tener|haber|ponerse|volverse)\s+/i;

const GROUPS = ['A-C', 'D-F', 'G-I', 'J-L', 'M-O', 'P-R', 'S-U', 'V-X', 'Y-Z'];

export function groupForLetter(letter) {
  const L = String(letter || '').toUpperCase();
  return GROUPS.find((g) => L >= g.charAt(0) && L <= g.charAt(2)) || null;
}

export async function classifyFear(env, content) {
  try {
    const topic = await extractWithAI(env, content);
    const cleaned = cleanTopic(topic);
    if (isValidTopic(cleaned)) {
      return { topic: cleaned, letter: letterOf(cleaned) };
    }
  } catch {
    /* caer al heurístico */
  }

  const heuristic = heuristicTopic(content);
  if (heuristic && isValidTopic(heuristic)) {
    const cleaned = cleanTopic(heuristic);
    return { topic: cleaned, letter: letterOf(cleaned) };
  }

  return { topic: content.slice(0, 40), letter: letterOf(content) };
}

async function extractWithAI(env, content) {
  const result = await env.AI.run(CLASSIFY_MODEL, {
    messages: [
      {
        role: 'user',
        content: `${CLASSIFY_PROMPT}\n\nFrase: "${content}"\nConcepto:`,
      },
    ],
    temperature: 0,
    max_tokens: 40,
  });
  const raw = String(result?.response ?? '').trim();
  return raw.split('\n')[0] || '';
}

function cleanTopic(topic) {
  return String(topic ?? '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(ARTICLE_RE, '')
    .replace(AUX_RE, '')
    .trim()
    .slice(0, 40);
}

function isValidTopic(topic) {
  const t = String(topic ?? '').trim();
  return t.length >= 2 && /[a-záéíóúüñ]/i.test(t) && !/^(que|a|de|en|por|para|no|nada|nunca|muy|más|otro)$/i.test(t);
}

function letterOf(topic) {
  const normalized = String(topic ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const ch = normalized.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(ch) ? ch : 'A';
}

function heuristicTopic(content) {
  const text = String(content ?? '').toLowerCase();
  const patterns = [
    /\bmiedo\s+a\s+(?:la|las|el|los|lo|un|una|unos|unas|mí|ti)\s+([a-záéíóúüñ]+)/i,
    /\bmiedo\s+de\s+(?:la|las|el|los|lo|un|una|unos|unas)\s+([a-záéíóúüñ]+)/i,
    /\bme\s+da\s+miedo\s+(?:la|las|el|los|lo|un|una|unos|unas)?\s*([a-záéíóúüñ]+)/i,
    /\bme\s+(?:asusta|aterra|espanta|preocupa)\s+(?:la|las|el|los|lo|un|una|unos|unas)?\s*([a-záéíóúüñ]+)/i,
    /\bmiedo\s+(?:a|de)\s+([a-záéíóúüñ]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}
