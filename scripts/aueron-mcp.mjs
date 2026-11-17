import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as operations from './ai-operations.mjs';

const server = new McpServer({ name:'aueron', version:'0.2.0' });
const nodeId=z.string().regex(/^node\/\/[\w@$]+$/).describe('ID completo ottenuto da list_devices; non indovinare il PC.');
const absolutePath=z.string().min(3).max(4096);
function tool(name, description, inputSchema, handler, readOnly=false) {
  server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:!readOnly,openWorldHint:false}},async args=>{
    try { const result=await handler(args); return {content:[{type:'text',text:JSON.stringify(result,null,2)}],isError:typeof result.exitCode==='number' && result.exitCode!==0}; }
    catch(error) {return {content:[{type:'text',text:error.message}],isError:true};}
  });
}
tool('list_devices','Elenca i PC personali autorizzati e il loro stato.',{},operations.devices,true);
tool('device_info','Informazioni di un PC autorizzato.',{nodeId},args=>operations.info(args.nodeId),true);
tool('run_powershell','Esegue un comando sul PC e nella directory indicati, con codice di uscita remoto verificato. Opera come servizio Windows, non come utente interattivo. Usare solo per il lavoro richiesto; preservare file esistenti. Un timeout non interrompe necessariamente il processo remoto.',{nodeId,workingDirectory:absolutePath,command:z.string().min(1).max(24000),timeoutSeconds:z.number().int().min(5).max(540).default(120)},operations.run);
tool('upload_file','Trasferisce un file locale in una directory remota esistente e confronta SHA256. Rifiuta un file remoto gia presente alla verifica iniziale.',{nodeId,localFile:absolutePath,remoteDirectory:absolutePath},operations.upload);
tool('download_file','Recupera un file remoto, confronta SHA256 e crea un nuovo file locale senza sovrascrivere.',{nodeId,remoteFile:absolutePath,localFile:absolutePath},operations.download);
await server.connect(new StdioServerTransport());
