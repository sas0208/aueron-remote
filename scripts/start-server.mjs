// Explicitly detach all standard handles: background server must not hold the launcher's pipes open.
import { spawn } from 'node:child_process';
import { openSync, closeSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const logDir = join(root, 'runtime/launcher-logs');
mkdirSync(logDir, { recursive: true });
const output = openSync(join(logDir, 'server.out.log'), 'a');
const errors = openSync(join(logDir, 'server.err.log'), 'a');
const child = spawn(process.execPath, [join(root, 'node_modules/meshcentral/meshcentral.js'),
  '--datapath=' + join(root, 'runtime/meshcentral-data'),
  '--filespath=' + join(root, 'runtime/meshcentral-files')], {
  cwd: root, detached: true, windowsHide: true, stdio: ['ignore', output, errors]
});
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('spawn', () => { console.log(child.pid); child.unref(); });
closeSync(output);
closeSync(errors);
