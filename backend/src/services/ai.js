export async function moderateContent(env, content) {
  try {
    const result = await env.AI.run('@cf/meta/llama-guard-3-8b', {
      messages: [
        {
          role: 'user',
          content: `Modera el siguiente texto. Detecta odio, violencia, spam, acoso o contenido inapropiado. Responde únicamente con "safe" o "unsafe":\n\n${content}`,
        },
      ],
    });

    const raw = String(result.response ?? JSON.stringify(result)).toLowerCase();
    const isSafe = raw.includes('safe') && !raw.includes('unsafe');
    return { isSafe, comment: isSafe ? null : 'Marcado como no seguro por la moderación automática' };
  } catch (error) {
    return { isSafe: false, aiError: true, comment: 'Pendiente de revisión manual (error de moderación automática)' };
  }
}
