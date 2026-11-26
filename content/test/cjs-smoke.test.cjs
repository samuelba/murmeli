'use strict';
// Consumes the built package the way the CommonJS NestJS backend does: require() of ESM (Node 24).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const content = require('@murmeli/content');

test('require(esm) exposes the loader and the exercise registry', () => {
  assert.equal(typeof content.loadContent, 'function');
  assert.equal(content.EXERCISE_TYPE_IDS.length, 15);
  const loaded = content.loadContent();
  assert.ok(loaded.tracks.length >= 3);
  const parsed = content.EXERCISE_PARAMS_SCHEMAS['add-sub'].safeParse({
    operations: ['add'],
    max: 10,
  });
  assert.equal(parsed.success, true);
});
