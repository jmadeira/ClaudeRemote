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
//
// Comportamento quando o servidor ClaudeRemote não está disponível:
//   O hook não devolve nenhuma decisão — o Claude Code cai para o seu mecanismo
//   nativo de aprovação (interface do utilizador). Nenhuma ação é bloqueada
//   nem aprovada automaticamente.

const https = require('https');
const http = require('http');

const SERVER_URL = process.env.CLAUDE_REMOTE_URL || 'http://127.0.0.1:8765';

function post(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);

    // Verificar primeiro se o servidor está disponível (conexão rápida)
    const probe = lib.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: '/health',
      method: 'GET',
      timeout: 2000,
    }, () => {
      probe.destroy();
      // Servidor está disponível — fazer o pedido real sem timeout
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        // Sem timeout: aguarda indefinidamente até o utilizador aprovar/rejeitar
      }, (res2) => {
        let raw = '';
        res2.on('data', (c) => { raw += c; });
        res2.on('end', () => resolve({ available: true, body: raw }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });

    probe.on('error', () => {
      probe.destroy();
      resolve({ available: false });
    });
    probe.on('timeout', () => {
      probe.destroy();
      resolve({ available: false });
    });
    probe.end();
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

  let result;
  try {
    result = await post(`${SERVER_URL}/request-approval`, { tool_name: toolName, tool_input: toolInput, cwd });
  } catch (_) {
    result = { available: false };
  }

  if (!result.available) {
    // Servidor não está a correr — não tomar nenhuma decisão.
    // O Claude Code cai para o mecanismo nativo de aprovação na interface do utilizador.
    process.exit(0);
  }

  const res = JSON.parse(result.body);
  const decision = res.decision === 'allow' ? 'allow' : 'deny';

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: decision },
    },
  }) + '\n');
}

main().catch(() => {
  // Erro inesperado — não tomar decisão, deixar o Claude Code tratar
  process.exit(0);
});
