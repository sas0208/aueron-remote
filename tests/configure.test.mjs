import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeConfig, validateTailnetHost, validatePublicPort, writeNewConfig } from '../scripts/configure.mjs';

test('preparation binds only loopback and disables ongoing self-registration', () => {
  const config = makeConfig();
  assert.equal(config.settings.portBind, '127.0.0.1');
  assert.equal(config.settings.redirPort, 0);
  assert.equal(config.settings.mpsPort, 0);
  assert.equal(config.settings.exactPorts, true);
  assert.equal(config.domains[''].newAccounts, false);
  assert.equal(config.settings.allowLoginToken, false);
  assert.equal(config.domains[''].passwordRequirements.min, 10);
});

test('the tailnet gateway stays loopback-only behind a trusted local TLS proxy', () => {
  const config = makeConfig({ mode: 'tailscale', hostname: 'Desktop.tail-example.ts.net.' });
  assert.equal(config.settings.cert, 'desktop.tail-example.ts.net');
  assert.equal(config.settings.portBind, '127.0.0.1');
  assert.equal(config.settings.aliasPort, 443);
  assert.equal(config.settings.tlsOffload, '127.0.0.1');
  assert.equal(config.domains[''].certUrl, 'https://desktop.tail-example.ts.net/');
  assert.equal(config.domains[''].newAccounts, false);
});

test('reject URLs, credentials, path injection and arbitrary public hosts', () => {
  for (const input of ['https://pc.test.ts.net', 'pc.test.ts.net/abc', 'pc.test.ts.net?token=x', 'user:pass@pc.test.ts.net', 'pc.example.com', 'localhost', 'pc\ntest.ts.net', '-pc.test.ts.net', 'pc.test.ts.net.evil.com']) {
    assert.throws(() => validateTailnetHost(input));
  }
  assert.throws(() => makeConfig({ mode: 'public' }));
});

test('a separate HTTPS port is included in agent advertised port and certificate URL', () => {
  const config = makeConfig({ mode: 'tailscale', hostname: 'pc.tail-example.ts.net', publicPort: '8443' });
  assert.equal(config.settings.aliasPort, 8443);
  assert.equal(config.domains[''].certUrl, 'https://pc.tail-example.ts.net:8443/');
  for (const value of ['443/other', '443?x=1', '0', '65536', '-1', '1e3', 1.5, NaN]) {
    assert.throws(() => validatePublicPort(value));
  }
});

test('existing runtime configuration is never overwritten or read', () => {
  const temp = mkdtempSync(join(tmpdir(), 'aueron-config-test-'));
  try {
    const file = join(temp, 'config.json');
    writeFileSync(file, 'preserve-existing-user-state');
    assert.throws(() => writeNewConfig(file, {}), /gia presente/);
    assert.equal(readFileSync(file, 'utf8'), 'preserve-existing-user-state');
  } finally { rmSync(temp, { recursive: true }); }
});
