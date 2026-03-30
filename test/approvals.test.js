'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const ApprovalManager = require('../src/approvals');

describe('ApprovalManager', () => {
  let manager;

  beforeEach(() => {
    // Timeout de 1s para testes rápidos
    manager = new ApprovalManager(1);
  });

  test('criar pedido e resolver com "allow"', async () => {
    const id = 'req-allow';
    const promise = manager.createRequest(id, { tool_name: 'Bash' });
    const resolved = manager.resolveRequest(id, 'allow');
    assert.equal(resolved, true);
    const result = await promise;
    assert.equal(result, 'allow');
  });

  test('criar pedido e resolver com "deny"', async () => {
    const id = 'req-deny';
    const promise = manager.createRequest(id, { tool_name: 'Edit' });
    const resolved = manager.resolveRequest(id, 'deny');
    assert.equal(resolved, true);
    const result = await promise;
    assert.equal(result, 'deny');
  });

  test('resolver pedido inexistente retorna false', () => {
    const result = manager.resolveRequest('nao-existe', 'allow');
    assert.equal(result, false);
  });

  test('pedido que expira resolve com "deny" automaticamente', async () => {
    // Timeout de 50ms para este teste
    const fastManager = new ApprovalManager(0.05);
    const id = 'req-timeout';
    const promise = fastManager.createRequest(id, { tool_name: 'Bash' });
    const result = await promise;
    assert.equal(result, 'deny');
  });

  test('timeout emite evento "timeout"', async () => {
    const fastManager = new ApprovalManager(0.05);
    let emittedId = null;
    fastManager.on('timeout', (id) => { emittedId = id; });
    const id = 'req-evt';
    await fastManager.createRequest(id, {});
    assert.equal(emittedId, id);
  });

  test('denyAll rejeita todos os pendentes e retorna contagem', async () => {
    const p1 = manager.createRequest('r1', {});
    const p2 = manager.createRequest('r2', {});
    const p3 = manager.createRequest('r3', {});

    assert.equal(manager.pendingCount, 3);

    const count = manager.denyAll();
    assert.equal(count, 3);
    assert.equal(manager.pendingCount, 0);

    const [v1, v2, v3] = await Promise.all([p1, p2, p3]);
    assert.equal(v1, 'deny');
    assert.equal(v2, 'deny');
    assert.equal(v3, 'deny');
  });

  test('pendingCount reflete estado correto', () => {
    assert.equal(manager.pendingCount, 0);
    manager.createRequest('a', {});
    assert.equal(manager.pendingCount, 1);
    manager.createRequest('b', {});
    assert.equal(manager.pendingCount, 2);
    manager.resolveRequest('a', 'allow');
    assert.equal(manager.pendingCount, 1);
  });

  test('timeout limpa o pedido do mapa', async () => {
    const fastManager = new ApprovalManager(0.05);
    const id = 'clean-test';
    await fastManager.createRequest(id, {});
    assert.equal(fastManager.pendingCount, 0);
  });

  test('approveAll aprova todos os pendentes e retorna contagem', async () => {
    const p1 = manager.createRequest('a1', {});
    const p2 = manager.createRequest('a2', {});
    assert.equal(manager.pendingCount, 2);
    const count = manager.approveAll();
    assert.equal(count, 2);
    assert.equal(manager.pendingCount, 0);
    const [v1, v2] = await Promise.all([p1, p2]);
    assert.equal(v1, 'allow');
    assert.equal(v2, 'allow');
  });

  test('approveAll em lista vazia retorna 0', () => {
    const count = manager.approveAll();
    assert.equal(count, 0);
  });

  test('denyAll em lista vazia retorna 0', () => {
    const count = manager.denyAll();
    assert.equal(count, 0);
  });

  test('resolver o mesmo pedido duas vezes retorna false na segunda', async () => {
    const id = 'double-resolve';
    const promise = manager.createRequest(id, {});
    manager.resolveRequest(id, 'allow');
    await promise;
    const second = manager.resolveRequest(id, 'deny');
    assert.equal(second, false);
  });
});
