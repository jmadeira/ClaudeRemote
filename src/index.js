#!/usr/bin/env node
'use strict';

const config = require('./config');
const ApprovalManager = require('./approvals');
const ClaudeRunner = require('./claude-runner');
const { createBot } = require('./bot');
const { createServer } = require('./server');

const VERSION = '1.0.0';

async function main() {
  console.log(`🚀 ClaudeRemote v${VERSION}`);

  // Instanciar componentes
  const approvalManager = new ApprovalManager(config.APPROVAL_TIMEOUT);
  const claudeRunner = new ClaudeRunner(
    config.CLAUDE_CMD,
    config.PROJECT_DIR,
    config.TASK_TIMEOUT,
    config.MAX_CONCURRENT_TASKS
  );

  // Criar bot
  const bot = createBot(config, approvalManager, claudeRunner);

  // Subscrever eventos de timeout do ApprovalManager
  approvalManager.on('timeout', async (requestId, metadata) => {
    const toolName = metadata && metadata.tool_name ? metadata.tool_name : 'unknown';
    await bot.sendMessage(`⏰ Pedido de permissão expirado\n🛠 Ferramenta: ${toolName}\n🆔 ${requestId}\nRejeitado automaticamente.`);
  });

  // Criar servidor HTTP
  const onPermissionRequest = (toolName, toolInput, cwd, requestId) =>
    bot.sendPermissionRequest(toolName, toolInput, cwd, requestId);

  const app = createServer(approvalManager, onPermissionRequest);

  // Lançar bot Telegram
  await bot.launch();
  console.log('🤖 Bot Telegram conectado');

  // Lançar servidor HTTP (bind apenas a localhost)
  const server = app.listen(config.PORT, '127.0.0.1', () => {
    console.log(`🌐 Servidor a escutar em http://127.0.0.1:${config.PORT}`);
    console.log(`📁 Projeto: ${config.PROJECT_DIR}`);
    console.log(`⏱  Timeout aprovações: ${config.APPROVAL_TIMEOUT}s | Timeout tarefas: ${config.TASK_TIMEOUT}s`);
    console.log('✅ Pronto!');
  });

  // Notificar que está online
  await bot.sendMessage(`🟢 ClaudeRemote v${VERSION} online\n📁 Projeto: ${config.PROJECT_DIR}\n🌐 Servidor: http://127.0.0.1:${config.PORT}`);

  // Graceful shutdown
  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n⏹ A encerrar (${signal})...`);

    // Rejeitar todos os pedidos pendentes
    const rejected = approvalManager.denyAll();
    if (rejected > 0) {
      console.log(`   ${rejected} pedido(s) pendente(s) rejeitado(s)`);
    }

    // Enviar mensagem de offline
    await bot.sendMessage(`🔴 ClaudeRemote offline.`).catch(() => {});

    // Parar bot
    bot.stop(signal);

    // Fechar servidor
    server.close(() => {
      console.log('   Servidor fechado.');
      process.exit(0);
    });

    // Forçar saída após 5s se não fechar
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Erro ao iniciar ClaudeRemote:', err.message);
  process.exit(1);
});
