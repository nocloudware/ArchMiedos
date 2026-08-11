import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSex,
  normalizeAgeGroup,
  normalizeCountry,
  SEX_OPTIONS,
  AGE_GROUPS,
} from '../src/utils/validation.js';

test('normalizeSex acepta opciones válidas y rechaza el resto', () => {
  assert.equal(normalizeSex('hombre'), 'hombre');
  assert.equal(normalizeSex('mujer'), 'mujer');
  assert.equal(normalizeSex('otro'), 'otro');
  assert.equal(normalizeSex(''), null);
  assert.equal(normalizeSex('no-binario'), null);
  assert.equal(normalizeSex(undefined), null);
  assert.equal(normalizeSex(42), null);
});

test('normalizeAgeGroup acepta rangos definidos y rechaza el resto', () => {
  assert.equal(normalizeAgeGroup('0-19'), '0-19');
  assert.equal(normalizeAgeGroup('20-29'), '20-29');
  assert.equal(normalizeAgeGroup('90+'), '90+');
  assert.equal(normalizeAgeGroup(''), null);
  assert.equal(normalizeAgeGroup('10-19'), null);
  assert.equal(normalizeAgeGroup('100+'), null);
  assert.equal(normalizeAgeGroup(undefined), null);
});

test('AGE_GROUPS cubre de 0-19 hasta 90+', () => {
  assert.equal(AGE_GROUPS[0], '0-19');
  assert.equal(AGE_GROUPS[AGE_GROUPS.length - 1], '90+');
  assert.equal(AGE_GROUPS.length, 9);
});

test('normalizeCountry valida ISO2 y normaliza a mayúsculas', () => {
  assert.equal(normalizeCountry('cl'), 'CL');
  assert.equal(normalizeCountry('CL'), 'CL');
  assert.equal(normalizeCountry('Us'), 'US');
  assert.equal(normalizeCountry('Chile'), null);
  assert.equal(normalizeCountry(''), null);
  assert.equal(normalizeCountry('ARG'), null);
  assert.equal(normalizeCountry(undefined), null);
});

test('SEX_OPTIONS contiene las 3 opciones de sexo', () => {
  assert.deepEqual(SEX_OPTIONS, ['hombre', 'mujer', 'otro']);
});
