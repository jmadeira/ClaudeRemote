#!/usr/bin/env node
'use strict';

// Hook de permissão do ClaudeRemote — compatível com Windows/Linux/Mac
// Configurar em ~/.claude/settings.json:
// {
//   "hooks": {
//     "PermissionRequest": [{
//       "matcher": "",
//       "hooks": [{ "type": "command", "command": "node C:/caminho/para/ClaudeRemote/hooks/permission-hook.js" }]
//     }]
//   }
// }

const https = require('https');
const http = require('http');

const SERVER_URL = process.env.CLAUDE_REMOTE_URL || 'http://127.0.0.1:8765';

function post(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      // Sem timeout: aguarda indefinidamente até o utilizador aprovar/rejeitar no Telegram
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve(raw));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  let event;
  try { event = JSON.parse(input); } catch (_) { event = {}; }

  const toolName = event.tool_name || event.toolName || 'unknown';
  const toolInput = event.tool_input || event.toolInput || {};
  const cwd = event.cwd || '';

  let decision = 'deny';
  try {
    const raw = await post(`${SERVER_URL}/request-approval`, { tool_name: toolName, tool_input: toolInput, cwd });
    const res = JSON.parse(raw);
    if (res.decision === 'allow') decision = 'allow';
  } catch (_) {
    // Servidor não disponível — negar por segurança
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: decision },
    },
  };
  process.stdout.write(JSON.stringify(output) + '\n');
}

main().catch(() => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny' } },
  }) + '\n');
});
