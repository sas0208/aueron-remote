// Adapt the upstream CLI without placing passwords in command-line arguments.
// Credentials arrive on stdin from the Windows-protected identity launcher.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'node_modules/meshcentral/meshctrl.js');
const allowed = new Set(['listdevices', 'listdevicegroups', 'deviceinfo', 'runcommand', 'upload', 'download', 'help']);

function validateArguments(args) {
  const action = String(args[0] || 'listdevices').toLowerCase();
  if (!allowed.has(action)) throw new Error('Operazione non disponibile per Aueron AI.');
  if (args.slice(1).some(arg => /^--?(?:url|login|token|proxy|password|pass(?:=|$)|cert)/i.test(arg))) {
    throw new Error('La destinazione e l’identita vengono gestite da Aueron, non dagli argomenti.');
  }
  return action;
}
function trustedSource(source) {
  const marker = '{ rejectUnauthorized: false, checkServerIdentity: onVerifyServer }';
  if (source.split(marker).length - 1 !== 3) throw new Error('MeshCtrl e cambiato: rivalutare le verifiche TLS prima di usare il nuovo codice.');
  // Restore standard Node certificate-chain AND hostname verification for all three transports.
  const networkGuard = 'function displayDeviceInfo(sysinfo, lastconnect, network, nodes) {';
  if (source.split(networkGuard).length !== 2) throw Error('Verificare il controllo dati di rete della nuova versione MeshCtrl.');
  return source.split(marker).join('{ rejectUnauthorized: true }').replace(networkGuard, networkGuard + '\n    network = network || {}; // Missing network metadata is allowed for a restricted identity.');
}
function validateIdentity(data) {
  const url = new URL(data.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !/^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/i.test(url.hostname)) throw new Error('Indirizzo del centro privato non valido.');
  if (data.username !== 'aueron-ai' || typeof data.password !== 'string' || data.password.length < 10) throw new Error('Identita Aueron AI non valida.');
  // MeshCtrl appends control.ashx itself.
  return { ...data, websocket: 'wss://' + url.host + '/' };
}
async function main() {
  let args = process.argv.slice(2);
  let envelope;
  if (args[0] === '--request-stdin') {
    let input = '';
    for await (const chunk of process.stdin) { input += chunk; if (input.length > 1048576) throw Error('Richiesta troppo grande.'); }
    envelope = JSON.parse(input.replace(/^\uFEFF/, ''));
    const operation = envelope.operation;
    if (!operation || !Array.isArray(operation.args) || operation.args.some(x => typeof x !== 'string')) throw Error('Argomenti non validi.');
    args = [operation.action, ...operation.args];
  }
  const action = validateArguments(args);
  if (!args.length) args.push(action);
  if (JSON.parse(fs.readFileSync(path.join(root, 'node_modules/meshcentral/package.json'), 'utf8')).version !== '1.2.5') throw new Error('Versione MeshCentral non verificata.');
  const code = trustedSource(fs.readFileSync(entry, 'utf8'));
  const extra = [];
  if (action !== 'help') {
    if (!envelope) {
      let input = '';
      for await (const chunk of process.stdin) { input += chunk; if (input.length > 8192) throw new Error('Dati di accesso troppo grandi.'); }
      envelope = JSON.parse(input.replace(/^\uFEFF/, ''));
    }
    const identity = validateIdentity(envelope);
    extra.push('--url', identity.websocket, '--loginuser', identity.username, '--loginpass', identity.password);
    if ((action === 'listdevices' || action === 'listdevicegroups') && !args.includes('--json')) args.push('--json');
    if (action === 'runcommand' && !args.includes('--reply')) args.push('--reply');
  }
  // Only in-process argv changes; the OS process command line contains no password.
  process.argv = [process.execPath, entry, ...args, ...extra];
  const child = new Module(entry, module);
  child.filename = entry;
  child.paths = Module._nodeModulePaths(path.dirname(entry));
  child._compile(code, entry);
  if (action !== 'help') setTimeout(() => { console.error('Timeout Aueron AI: operazione non confermata.'); process.exit(124); }, 10 * 60 * 1000).unref();
}
module.exports = { validateArguments, validateIdentity, trustedSource };
if (require.main === module) main().catch(() => { console.error('Aueron AI non puo completare la richiesta. Verificare identita, argomenti e versione del centro.'); process.exitCode = 1; });
