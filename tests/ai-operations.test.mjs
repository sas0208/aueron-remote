import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { remoteCommand, parseCommand } from '../scripts/ai-operations.mjs';
test('remote completion requires its own exit marker',()=>{
  assert.throws(()=>parseCommand('OK','AUERON_EXIT_test='));
  assert.throws(()=>parseCommand('AUERON_EXIT_other=0','AUERON_EXIT_test='));
  assert.deepEqual(parseCommand('hello\nAUERON_EXIT_test=7','AUERON_EXIT_test='),{confirmed:true,exitCode:7,output:'hello'});
});
test('PowerShell wrapper preserves success, native failure and explicit exit',{skip:process.platform!=='win32'},()=>{
  for(const [command,expected] of [["Write-Output 'ok'",0],['cmd.exe /c exit 9',9],['exit 7',7],["throw 'synthetic test error'",1]]){
    const wrapped=remoteCommand(command,process.env.ProgramFiles);
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(wrapped.script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
    assert.equal(parseCommand(result.stdout,wrapped.marker).exitCode,expected);
  }
  assert.throws(()=>remoteCommand('echo test','relative/path'));
});
