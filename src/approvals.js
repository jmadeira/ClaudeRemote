'use strict';

const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');

class ApprovalManager extends EventEmitter {
  constructor(timeoutSeconds) {
    super();
    // 0 ou omitido = sem timeout (espera indefinida). Qualquer valor > 0 = timeout em segundos.
    this._timeoutMs = timeoutSeconds > 0 ? timeoutSeconds * 1000 : 0;
    // Mapa de id → { resolve, timer, metadata }
    this._pending = new Map();
  }

  // Cria um novo pedido pendente. Retorna Promise que resolve com "allow" ou "deny".
  // Se _timeoutMs === 0, a promise fica pendente até ser resolvida manualmente.
  createRequest(id, metadata) {
    const requestId = id || randomUUID();
    return new Promise((resolve) => {
      let timer = null;
      if (this._timeoutMs > 0) {
        timer = setTimeout(() => {
          if (this._pending.has(requestId)) {
            this._cleanup(requestId);
            this.emit('timeout', requestId, metadata);
            resolve('deny');
          }
        }, this._timeoutMs);
      }

      this._pending.set(requestId, { resolve, timer, metadata });
    });
  }

  // Resolve um pedido existente
  // Retorna true se encontrou e resolveu, false se expirado/inexistente
  resolveRequest(id, decision) {
    const entry = this._pending.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this._pending.delete(id);
    entry.resolve(decision);
    return true;
  }

  // Aprova todos os pendentes
  approveAll() {
    const count = this._pending.size;
    for (const [id, entry] of this._pending.entries()) {
      clearTimeout(entry.timer);
      entry.resolve('allow');
    }
    this._pending.clear();
    return count;
  }

  // Rejeita todos os pendentes (para /denyall)
  denyAll() {
    const count = this._pending.size;
    for (const [id, entry] of this._pending.entries()) {
      clearTimeout(entry.timer);
      entry.resolve('deny');
    }
    this._pending.clear();
    return count;
  }

  // Retorna número de pedidos pendentes
  get pendingCount() {
    return this._pending.size;
  }

  // Limpa um pedido (chamado internamente no timeout)
  _cleanup(id) {
    const entry = this._pending.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      this._pending.delete(id);
    }
  }
}

module.exports = ApprovalManager;
