import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const root = new URL('../', import.meta.url);
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
const entry = lock.packages['node_modules/meshcentral'];
if (entry.version !== '1.2.5' || entry.resolved !== 'https://registry.npmjs.org/meshcentral/-/meshcentral-1.2.5.tgz') throw Error('Pacchetto non previsto');
const response = await fetch(entry.resolved);
if (!response.ok) throw Error('Download ufficiale fallito');
const compressed = Buffer.from(await response.arrayBuffer());
if ('sha512-' + createHash('sha512').update(compressed).digest('base64') !== entry.integrity) throw Error('Integrita npm non valida');
const tar = gunzipSync(compressed);
let binary;
for (let offset = 0; offset + 512 <= tar.length;) {
  const name = tar.subarray(offset, offset + 100).toString().split('\0')[0];
  const size = parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0/g, '').trim(), 8) || 0;
  if (name === 'package/agents/MeshService64.exe') { binary = tar.subarray(offset + 512, offset + 512 + size); break; }
  offset += 512 + Math.ceil(size / 512) * 512;
}
const expected = 'cbf10a37fc01f74f2473aeca0a4b391dca6f9d0a8d0300aa7181dbce7bacc51e';
if (!binary || createHash('sha256').update(binary).digest('hex') !== expected) throw Error('Host diverso da quello verificato');
await writeFile(new URL('node_modules/meshcentral/agents/MeshService64.exe', root), binary);
console.log(JSON.stringify({ officialIntegrityVerified: true, hostSHA256: expected, bytes: binary.length }));
