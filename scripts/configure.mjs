import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export function validateTailnetHost(input) {
  const host = String(input || '').toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.ts\.net$/.test(host)) {
    throw new Error('Indicare il nome completo assegnato da Tailscale, es. pc.nome-rete.ts.net, senza URL o credenziali.');
  }
  return host;
}

export function validatePublicPort(input = 443) {
  if (!/^\d+$/.test(String(input))) throw new Error('La porta HTTPS deve essere un intero tra 1 e 65535.');
  const port = Number(input);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta HTTPS non valida.');
  return port;
}

export function makeConfig({ mode = 'local', hostname, publicPort = 443 } = {}) {
  if (!['local', 'tailscale'].includes(mode)) throw new Error('Modalita non supportata.');
  const remote = mode === 'tailscale';
  const host = remote ? validateTailnetHost(hostname) : 'localhost';
  const port = validatePublicPort(publicPort);
  const origin = 'https://' + host + (port === 443 ? '' : ':' + port);
  return {
    '$schema': 'https://raw.githubusercontent.com/Ylianst/MeshCentral/master/meshcentral-config-schema.json',
    settings: {
      cert: host,
      port: 8943,
      portBind: '127.0.0.1',
      redirPort: 0,
      mpsPort: 0,
      exactPorts: true,
      meshScanner: false,
      amtScanner: false,
      WANonly: remote,
      LANonly: !remote,
      selfUpdate: false,
      allowLoginToken: false,
      sessionSameSite: 'strict',
      allowHighQualityDesktop: true,
      ...(remote ? { aliasPort: port, tlsOffload: '127.0.0.1', trustedProxy: '127.0.0.1' } : {})
    },
    domains: {
      '': {
        title: 'Aueron Remote',
        title2: 'I tuoi computer, ovunque',
        welcomeText: 'Desktop, terminale e file dei tuoi PC.',
        newAccounts: false,
        userNameIsEmail: false,
        mobileSite: true,
        siteStyle: 3,
        nightMode: 0,
        allowSavingDeviceCredentials: false,
        guestDeviceSharing: false,
        footer: 'Aueron Remote - powered by MeshCentral (Apache-2.0)',
        loginfooter: 'Centro personale. Accedi con il tuo account Aueron.',
        passwordRequirements: { min: 10 },
        ...(remote ? { certUrl: origin + '/' } : {}),
        agentCustomization: {
          displayName: 'Aueron Remote Host',
          description: 'Accesso autorizzato a desktop, terminale e file tramite il tuo centro Aueron.',
          companyName: 'AueronRemote',
          serviceName: 'aueronremote',
          fileName: 'AueronRemoteHost',
          installText: 'Installa questo host solo sui tuoi computer. Il PC sara gestibile dal tuo centro Aueron.'
        }
      }
    }
  };
}

export function writeNewConfig(path, options) {
  const config = makeConfig(options);
  if (existsSync(path)) throw new Error('Configurazione gia presente: non viene sovrascritta. Preparare un nuovo file e confrontarlo manualmente.');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
  return config;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { mode: { type: 'string', default: 'local' }, hostname: { type: 'string' }, publicPort: { type: 'string', default: '443' }, output: { type: 'string', default: 'runtime/meshcentral-data/config.json' } } });
    writeNewConfig(resolve(values.output), values);
    console.log('Configurazione creata. Nessun account, servizio o porta pubblica attivato.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
