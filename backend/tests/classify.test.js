import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupForLetter, classifyFear } from '../src/services/classify.js';

test('groupForLetter asigna grupos por letra', () => {
  assert.equal(groupForLetter('A'), 'A-C');
  assert.equal(groupForLetter('c'), 'A-C');
  assert.equal(groupForLetter('D'), 'D-F');
  assert.equal(groupForLetter('Ñ'), null); // Ñ no está en el rango ASCII; letterOf la normaliza antes
  assert.equal(groupForLetter('Z'), 'Y-Z');
  assert.equal(groupForLetter(''), null);
  assert.equal(groupForLetter('1'), null);
});

test('SEC-001: classifyFear con IA capturada delimitada sin >>> fijo', async () => {
  let lastMsg = null;
  const env = {
    AI: {
      run: async (_model, opts) => {
        lastMsg = opts.messages[0].content;
        return { response: 'araña' };
      },
    },
  };
  const r = await classifyFear(env, 'Tengo miedo a las arañas');
  assert.equal(r.topic, 'araña');
  assert.equal(r.letter, 'A');
  assert.ok(!lastMsg.includes('\n>>>\n'), 'no hay cierre fijo adivinable');
  assert.match(lastMsg, /<<<ARCHMIEDOS:[A-Z0-9]{16}:START>>>/);
  assert.match(lastMsg, /<<<ARCHMIEDOS:[A-Z0-9]{16}:END>>>/);
});

test('classifyFear cae a heurística si la IA responde basura', async () => {
  const env = { AI: { run: async () => ({ response: '!!!' }) } };
  const r = await classifyFear(env, 'Tengo miedo a los perros');
  assert.equal(r.topic, 'perros');
});

test('classifyFear fallback: última letra del contenido si todo falla', async () => {
  const env = { AI: { run: async () => { throw new Error('AI down'); } } };
  const r = await classifyFear(env, 'zzz');
  assert.equal(r.letter, 'Z');
});
