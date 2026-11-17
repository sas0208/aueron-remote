import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const meta = JSON.parse(readFileSync(resolve(root, 'node_modules/meshcentral/package.json'), 'utf8'));
if (meta.version !== '1.2.5') throw new Error('Patch non verificata per questa versione MeshCentral.');
const path = resolve(root, 'node_modules/meshcentral/meshcentral.js');
const source = readFileSync(path, 'utf8');
const oldPin = "modules.push('node-windows@0.1.14')";
const newPin = "modules.push('node-windows@1.0.0-beta.8') /* Aueron 2026-09-17: Windows dependency security update; see NOTICE.md. */";
if (source.includes(newPin)) { console.log('Patch Windows gia applicata.'); }
else {
  if (source.split(oldPin).length !== 2) throw new Error('Il sorgente upstream non corrisponde alla patch verificata.');
  writeFileSync(path, source.replace(oldPin, newPin));
  console.log('Pin Windows aggiornato; nessuna modifica ai protocolli MeshCentral.');
}
