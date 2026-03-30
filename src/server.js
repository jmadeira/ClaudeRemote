'use strict';

const express = require('express');
const { randomUUID } = require('crypto');

function createServer(approvalManager, onPermissionRequest) {
  const app = express();
  const startedAt = Date.now();

  // Middleware — parse JSON com limite de 1MB
  app.use(express.json({ limit: '1mb' }));

  // Log de cada request
  app.use((req, _res, next) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${req.method} ${req.path}`);
    next();
  });

  // POST /request-approval
  app.post('/request-approval', async (req, res) => {
    const { tool_name, tool_input, cwd } = req.body || {};

    if (!tool_name) {
      return res.status(400).json({ error: 'tool_name é obrigatório' });
    }

    const requestId = randomUUID();

    // Criar o pedido (Promise que vai resolver quando o utilizador decidir)
    const decisionPromise = approvalManager.createRequest(requestId, { tool_name, tool_input, cwd });

    // Notificar via Telegram (callback opcional)
    if (typeof onPermissionRequest === 'function') {
      onPermissionRequest(tool_name, tool_input, cwd, requestId).catch(() => {});
    }

    try {
      const decision = await decisionPromise;
      return res.json({ decision });
    } catch (err) {
      return res.json({ decision: 'deny' });
    }
  });

  // GET /health
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      pending: approvalManager.pendingCount,
      activeTask: false, // será atualizado pelo index.js se necessário
      uptime: Math.round((Date.now() - startedAt) / 1000),
    });
  });

  return app;
}

module.exports = { createServer };
