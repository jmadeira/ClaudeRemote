'use strict';

// Escapa caracteres especiais do Markdown do Telegram (MarkdownV1)
function escapeMarkdown(text) {
  if (typeof text !== 'string') return String(text);
  // Primeiro escapar a barra invertida para evitar duplo-escape,
  // depois escapar os restantes: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text
    .replace(/\\/g, '\\\\')
    .replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Formata um pedido de permissão para mensagem Telegram
function formatPermissionRequest(toolName, toolInput, cwd, requestId) {
  const now = new Date();
  const time = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const safeCwd = escapeMarkdown(cwd || '');
  const safeId = escapeMarkdown(requestId || '');

  let details = '';

  if (toolName === 'Bash' || toolName === 'bash') {
    const cmd = toolInput && toolInput.command ? toolInput.command : JSON.stringify(toolInput || {});
    const truncated = cmd.length > 500 ? cmd.slice(0, 500) + '...' : cmd;
    details = `\`\`\`\n${truncated}\n\`\`\``;
  } else if (toolName === 'Edit' || toolName === 'Write' || toolName === 'edit' || toolName === 'write') {
    const filePath = toolInput && (toolInput.path || toolInput.file_path || toolInput.filePath);
    details = filePath ? `📄 \`${escapeMarkdown(filePath)}\`` : escapeMarkdown(JSON.stringify(toolInput || {}).slice(0, 200));
  } else if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep' || toolName === 'read' || toolName === 'glob' || toolName === 'grep') {
    const pattern = toolInput && (toolInput.path || toolInput.pattern || toolInput.glob);
    details = pattern ? `🔍 \`${escapeMarkdown(pattern)}\`` : escapeMarkdown(JSON.stringify(toolInput || {}).slice(0, 200));
  } else {
    const raw = JSON.stringify(toolInput || {});
    const truncated = raw.length > 300 ? raw.slice(0, 300) + '...' : raw;
    details = `\`${escapeMarkdown(truncated)}\``;
  }

  return (
    `🔔 *Pedido de Permissão*\n` +
    `🛠 Ferramenta: *${escapeMarkdown(toolName)}*\n` +
    `📁 ${safeCwd}\n` +
    `🕐 ${time}\n` +
    `🆔 \`${safeId}\`\n\n` +
    details
  );
}

// Formata o resultado de uma tarefa CLI
function formatTaskResult(prompt, output, success, duration) {
  const emoji = success ? '✅' : '⚠️';
  const truncatedPrompt = prompt && prompt.length > 100 ? prompt.slice(0, 100) + '...' : (prompt || '');
  const truncatedOutput = output && output.length > 3800 ? output.slice(0, 3800) + '\n\n_(output truncado)_' : (output || '');
  const durationStr = duration != null ? `\n⏱ ${Math.round(duration / 1000)}s` : '';

  return (
    `${emoji} *Resultado*\n` +
    `📝 _${escapeMarkdown(truncatedPrompt)}_\n\n` +
    `${escapeMarkdown(truncatedOutput)}` +
    durationStr
  );
}

// Formata mensagem de status
function formatStatus(pendingCount, activeTask, projectDir) {
  const pendingStr = pendingCount > 0
    ? `🟡 ${pendingCount} pedido(s) pendente(s)`
    : '✅ Sem pedidos pendentes';

  const taskStr = activeTask
    ? `⏳ Tarefa ativa: _${escapeMarkdown(activeTask.prompt ? activeTask.prompt.slice(0, 80) : '?')}_`
    : '💤 Sem tarefa ativa';

  const dirStr = `📁 Projeto: \`${escapeMarkdown(projectDir || 'não definido')}\``;

  return `📊 *Estado*\n${pendingStr}\n${taskStr}\n${dirStr}`;
}

// Formata a mensagem de boas-vindas (/start)
function formatWelcome() {
  return (
    `👋 *Bem-vindo ao ClaudeRemote\\!*\n\n` +
    `Controla o Claude Code remotamente via Telegram\\.\n\n` +
    `*Comandos disponíveis:*\n` +
    `/start \\- Boas\\-vindas\n` +
    `/status \\- Estado atual\n` +
    `/denyall \\- Rejeitar todos os pedidos pendentes\n` +
    `/project \\- Ver ou mudar projeto\n` +
    `/task \\- Ver tarefa ativa\n` +
    `/cancel \\- Cancelar tarefa ativa\n` +
    `/help \\- Ajuda detalhada\n\n` +
    `*Como usar:*\n` +
    `Envia qualquer mensagem de texto para executar como tarefa no Claude Code\\.`
  );
}

module.exports = {
  escapeMarkdown,
  formatPermissionRequest,
  formatTaskResult,
  formatStatus,
  formatWelcome,
};
