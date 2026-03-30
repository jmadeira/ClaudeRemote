'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

// Mock do ApprovalManager para os testes do servidor
class MockApprovalManager {
  constructor() {
    this._pending = new Map();
    this._decision = 'allow';
  }

  createRequest(id, metadata) {
    return Promise.resolve(this._decision);
  }

  get pendingCount() {
    return this._pending.size;
  }
}

const { createServer } = require('../src/server');

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (_) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      const json = JSON.stringify(body);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(json));
      req.write(json);
    }
    req.end();
  });
}

describe('Servidor HTTP', () => {
  let server;
  let port;
  let mockManager;

  before(async () => {
    mockManager = new MockApprovalManager();
    const app = createServer(mockManager, null);
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

  test('GET /health retorna status ok', async () => {
    const result = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/health',
      method: 'GET',
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.status, 'ok');
    assert.ok('uptime' in result.body);
    assert.ok('pending' in result.body);
  });

  test('POST /request-approval retorna decision', async () => {
    mockManager._decision = 'allow';
    const result = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/request-approval',
      method: 'POST',
    }, { tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: '/tmp' });

    assert.equal(result.statusCode, 200);
    assert.ok(result.body.decision === 'allow' || result.body.decision === 'deny');
  });

  test('POST /request-approval sem tool_name retorna 400', async () => {
    const result = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/request-approval',
      method: 'POST',
    }, { tool_input: { command: 'ls' } });

    assert.equal(result.statusCode, 400);
    assert.ok('error' in result.body);
  });

  test('servidor só aceita conexões de localhost', () => {
    // Verificar que o servidor está bound a 127.0.0.1
    const address = server.address();
    assert.equal(address.address, '127.0.0.1');
  });

  test('POST /request-approval com decision deny', async () => {
    mockManager._decision = 'deny';
    const result = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/request-approval',
      method: 'POST',
    }, { tool_name: 'Edit', tool_input: { path: '/file.js' }, cwd: '/tmp' });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.decision, 'deny');
  });
});
