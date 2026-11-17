import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { validateArguments, validateIdentity, trustedSource } = require('../scripts/meshctrl-protected.cjs');

test('AI cannot redirect credentials or invoke account administration', () => {
  assert.equal(validateArguments(['runcommand', '--id', 'node//test', '--run', 'echo ok']), 'runcommand');
  for (const args of [['adduser'], ['listdevices', '--url=https://elsewhere.test'], ['listdevices', '--loginpass', 'test'], ['upload', '--proxy', 'http://elsewhere.test']]) assert.throws(() => validateArguments(args));
});
test('AI accepts only the dedicated identity at a private HTTPS origin', () => {
  const sample = { username: 'aueron-ai', password: 'synthetic-test-value', url: 'https://pc.example.ts.net:8443/' };
  assert.equal(validateIdentity(sample).websocket, 'wss://pc.example.ts.net:8443/');
  for (const url of ['http://pc.example.ts.net/', 'https://evil.example/', 'https://pc.example.ts.net/?key=a', 'https://person:secret@pc.example.ts.net/']) assert.throws(() => validateIdentity({ ...sample, url }));
  assert.throws(() => validateIdentity({ ...sample, username: 'admin' }));
});
test('every upstream CLI transport uses normal certificate and hostname validation', () => {
  const original = readFileSync(new URL('../node_modules/meshcentral/meshctrl.js', import.meta.url), 'utf8');
  const hardened = trustedSource(original);
  assert.equal(hardened.includes('rejectUnauthorized: false'), false);
  assert.equal(hardened.split('{ rejectUnauthorized: true }').length - 1, 3);
  assert.throws(() => trustedSource('different upstream version'));
});
