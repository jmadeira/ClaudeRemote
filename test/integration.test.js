'use strict';

// Testes de integração — testam o fluxo completo entre componentes reais
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const ApprovalManager = require('../src/approvals');
const { createServer } = require('../src/server');

function post(port, path, body) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(json);
    req.end();
  });
}

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
}

describe('Integração: ApprovalManager + Servidor HTTP', () => {
  let server;
  let port;
  let manager;
  let permissionRequests;

  before(async () => {
    manager = new ApprovalManager(5); // 5s timeout
    permissionRequests = [];

    const onPermissionRequest = async (toolName, toolInput, cwd, requestId) => {
      permissionRequests.push({ toolName, toolInput, cwd, requestId });
    };

    const app = createServer(manager, onPermissionRequest);
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('fluxo completo: pedido → aprovação via resolveRequest', async () => {
    // Enviar pedido de aprovação
    const requestPromise = post(port, '/request-approval', {
      tool_name: 'Edit',
      tool_input: { path: '/src/app.js' },
      cwd: '/projeto',
    });

    // Aguardar que o pedido seja registado no manager
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(manager.pendingCount, 1);

    // Verificar que o callback foi chamado
    assert.equal(permissionRequests.length, 1);
    assert.equal(permissionRequests[0].toolName, 'Edit');

    // Aprovar via manager (simula clique no botão Telegram)
    const requestId = permissionRequests[0].requestId;
    manager.resolveRequest(requestId, 'allow');

    // Verificar resposta HTTP
    const result = await requestPromise;
    assert.equal(result.status, 200);
    assert.equal(result.body.decision, 'allow');
    assert.equal(manager.pendingCount, 0);
  });

  test('fluxo completo: pedido → rejeição via denyAll', async () => {
    permissionRequests.length = 0;

    const requestPromise = post(port, '/request-approval', {
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
      cwd: '/projeto',
    });

    await new Promise((r) => setTimeout(r, 50));
    assert.equal(manager.pendingCount, 1);

    manager.denyAll();

    const result = await requestPromise;
    assert.equal(result.status, 200);
    assert.equal(result.body.decision, 'deny');
    assert.equal(manager.pendingCount, 0);
  });

  test('múltiplos pedidos simultâneos: aprovar todos', async () => {
    permissionRequests.length = 0;

    const p1 = post(port, '/request-approval', { tool_name: 'Edit', tool_input: { path: '/a.js' }, cwd: '/' });
    const p2 = post(port, '/request-approval', { tool_name: 'Write', tool_input: { path: '/b.js' }, cwd: '/' });
    const p3 = post(port, '/request-approval', { tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: '/' });

    await new Promise((r) => setTimeout(r, 100));
    assert.equal(manager.pendingCount, 3);

    manager.approveAll();

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    assert.equal(r1.body.decision, 'allow');
    assert.equal(r2.body.decision, 'allow');
    assert.equal(r3.body.decision, 'allow');
    assert.equal(manager.pendingCount, 0);
  });

  test('múltiplos pedidos simultâneos: rejeitar todos', async () => {
    const p1 = post(port, '/request-approval', { tool_name: 'Edit', tool_input: {}, cwd: '/' });
    const p2 = post(port, '/request-approval', { tool_name: 'Write', tool_input: {}, cwd: '/' });

    await new Promise((r) => setTimeout(r, 100));
    manager.denyAll();

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1.body.decision, 'deny');
    assert.equal(r2.body.decision, 'deny');
  });

  test('health check reporta pedidos pendentes corretamente', async () => {
    const before = await get(port, '/health');
    assert.equal(before.body.pending, 0);

    // Criar pedido pendente
    const requestPromise = post(port, '/request-approval', {
      tool_name: 'Bash',
      tool_input: { command: 'pwd' },
      cwd: '/',
    });

    await new Promise((r) => setTimeout(r, 50));
    const during = await get(port, '/health');
    assert.equal(during.body.pending, 1);

    manager.denyAll();
    await requestPromise;

    const after = await get(port, '/health');
    assert.equal(after.body.pending, 0);
  });

  test('timeout=0 mantém pedido pendente até resolução manual', async () => {
    const infiniteManager = new ApprovalManager(0);
    const timeouts = [];
    infiniteManager.on('timeout', (id) => timeouts.push(id));

    const app3 = createServer(infiniteManager, null);
    const server3 = await new Promise((resolve) => {
      const s = app3.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port3 = server3.address().port;

    const requestPromise = post(port3, '/request-approval', {
      tool_name: 'Edit',
      tool_input: { path: '/z.js' },
      cwd: '/',
    });

    // Aguardar para confirmar que não expirou sozinho
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(infiniteManager.pendingCount, 1, 'Deve manter pedido pendente');
    assert.equal(timeouts.length, 0, 'Não deve emitir timeout');

    // Resolver manualmente
    infiniteManager.approveAll();
    const result = await requestPromise;
    assert.equal(result.body.decision, 'allow');

    await new Promise((resolve) => server3.close(resolve));
  });

  test('timeout do pedido resolve com deny e emite evento', async () => {
    const fastManager = new ApprovalManager(0.1); // 100ms
    const timeouts = [];
    fastManager.on('timeout', (id) => timeouts.push(id));

    const app2 = createServer(fastManager, null);
    const server2 = await new Promise((resolve) => {
      const s = app2.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port2 = server2.address().port;

    const result = await post(port2, '/request-approval', {
      tool_name: 'Edit',
      tool_input: { path: '/x.js' },
      cwd: '/',
    });

    assert.equal(result.body.decision, 'deny');
    assert.equal(timeouts.length, 1);

    await new Promise((resolve) => server2.close(resolve));
  });

  test('pedido sem tool_name retorna 400', async () => {
    const result = await post(port, '/request-approval', {
      tool_input: { command: 'ls' },
      cwd: '/',
    });
    assert.equal(result.status, 400);
    assert.ok('error' in result.body);
  });
});

describe('Integração: hook de permissão', () => {
  test('permission-hook.js existe', () => {
    const path = require('path');
    const fs = require('fs');
    const hookPath = path.join(__dirname, '../hooks/permission-hook.js');
    assert.ok(fs.existsSync(hookPath), 'permission-hook.js deve existir');
  });

  test('permission-hook.js tem sintaxe válida', () => {
    const path = require('path');
    const { execFileSync } = require('child_process');
    const hookPath = path.join(__dirname, '../hooks/permission-hook.js');
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ['--check', hookPath]),
      'Deve ter sintaxe JavaScript válida'
    );
  });

  test('permission-hook.js contacta o servidor correto por default', () => {
    const path = require('path');
    const fs = require('fs');
    const hookPath = path.join(__dirname, '../hooks/permission-hook.js');
    const source = fs.readFileSync(hookPath, 'utf8');
    assert.ok(source.includes('127.0.0.1:8765'), 'Deve usar o endpoint local por default');
  });

  test('permission-hook.js suporta CLAUDE_REMOTE_URL env var', () => {
    const path = require('path');
    const fs = require('fs');
    const hookPath = path.join(__dirname, '../hooks/permission-hook.js');
    const source = fs.readFileSync(hookPath, 'utf8');
    assert.ok(source.includes('CLAUDE_REMOTE_URL'), 'Deve suportar CLAUDE_REMOTE_URL');
  });
});
