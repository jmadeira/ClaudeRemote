'use strict';

const { Telegraf, Markup } = require('telegraf');
const { existsSync } = require('fs');
const { formatPermissionRequest, formatTaskResult, formatStatus, formatWelcome, escapeMarkdown } = require('./formatter');

function log(direction, msg) {
  const ts = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`[${ts}] ${direction} ${msg}`);
}

function createBot(config, approvalManager, claudeRunner) {
  const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

  // Diretório do projeto atual (mutável via /project)
  let currentProjectDir = config.PROJECT_DIR;

  // Middleware de segurança — verifica CHAT_ID em todos os updates
  bot.use((ctx, next) => {
    const chatId = ctx.chat && ctx.chat.id;
    if (String(chatId) !== String(config.TELEGRAM_CHAT_ID)) {
      // Ignorar silenciosamente
      return;
    }
    return next();
  });

  // /start
  bot.command('start', async (ctx) => {
    try {
      await ctx.reply(formatWelcome(), { parse_mode: 'Markdown' });
    } catch (_) {
      await ctx.reply('Bem-vindo ao ClaudeRemote! Envia uma mensagem de texto para executar uma tarefa no Claude Code.').catch(() => {});
    }
  });

  // /help
  bot.command('help', async (ctx) => {
    const msg =
      `*Ajuda do ClaudeRemote*\n\n` +
      `*Comandos:*\n` +
      `/start \\- Boas\\-vindas\n` +
      `/status \\- Estado atual \\(pedidos pendentes, tarefa ativa, projeto\\)\n` +
      `/denyall \\- Rejeitar todos os pedidos de permissão pendentes\n` +
      `/project \\- Ver diretório do projeto atual\n` +
      `/project <caminho> \\- Mudar o diretório do projeto\n` +
      `/task \\- Ver informação da tarefa ativa\n` +
      `/cancel \\- Cancelar a tarefa ativa\n` +
      `/help \\- Esta mensagem\n\n` +
      `*Enviar tarefas:*\n` +
      `Envia qualquer mensagem de texto \\(que não seja um comando\\) para executar como prompt no Claude Code\\.`;
    try {
      await ctx.reply(msg, { parse_mode: 'MarkdownV2' });
    } catch (_) {
      await ctx.reply('Usa /status, /denyall, /project, /task, /cancel para controlar o ClaudeRemote.').catch(() => {});
    }
  });

  // /status
  bot.command('status', async (ctx) => {
    const msg = formatStatus(approvalManager.pendingCount, claudeRunner.activeTask, currentProjectDir);
    try {
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (_) {
      await ctx.reply(`Estado: ${approvalManager.pendingCount} pendentes | Projeto: ${currentProjectDir}`).catch(() => {});
    }
  });

  // /denyall
  bot.command('denyall', async (ctx) => {
    const count = approvalManager.denyAll();
    await ctx.reply(`❌ ${count} pedido(s) rejeitado(s).`).catch(() => {});
  });

  // /project
  bot.command('project', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    const newPath = parts.slice(1).join(' ').trim();

    if (!newPath) {
      await ctx.reply(`📁 Projeto atual: \`${currentProjectDir}\``, { parse_mode: 'Markdown' }).catch(async () => {
        await ctx.reply(`Projeto atual: ${currentProjectDir}`).catch(() => {});
      });
      return;
    }

    if (!existsSync(newPath)) {
      await ctx.reply(`❌ Diretório não encontrado: ${newPath}`).catch(() => {});
      return;
    }

    currentProjectDir = newPath;
    await ctx.reply(`✅ Projeto alterado para: \`${newPath}\``, { parse_mode: 'Markdown' }).catch(async () => {
      await ctx.reply(`Projeto alterado para: ${newPath}`).catch(() => {});
    });
  });

  // /task
  bot.command('task', async (ctx) => {
    const task = claudeRunner.activeTask;
    if (!task) {
      await ctx.reply('💤 Sem tarefa ativa.').catch(() => {});
      return;
    }
    const elapsed = Math.round((Date.now() - task.startedAt) / 1000);
    const msg = `⏳ *Tarefa ativa*\n📝 _${escapeMarkdown(task.prompt.slice(0, 100))}_\n📁 ${escapeMarkdown(task.cwd)}\n⏱ ${elapsed}s decorridos`;
    try {
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (_) {
      await ctx.reply(`Tarefa ativa há ${elapsed}s: ${task.prompt.slice(0, 80)}`).catch(() => {});
    }
  });

  // /new — reiniciar sessão (nova conversa)
  bot.command('new', async (ctx) => {
    claudeRunner.resetSession();
    await ctx.reply('🔄 Nova sessão iniciada. O Claude não tem memória das mensagens anteriores.').catch(() => {});
  });

  // /cancel
  bot.command('cancel', async (ctx) => {
    const cancelled = claudeRunner.cancel();
    if (cancelled) {
      await ctx.reply('🛑 Tarefa cancelada.').catch(() => {});
    } else {
      await ctx.reply('💤 Sem tarefa ativa para cancelar.').catch(() => {});
    }
  });

  // Callback queries (botões inline de aprovação)
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery && ctx.callbackQuery.data;
    if (!data) return;

    const [action, requestId] = data.split(':');
    if (!action || !requestId) return;

    let decision;
    if (action === 'approve') {
      decision = 'allow';
    } else if (action === 'deny') {
      decision = 'deny';
    } else {
      return;
    }

    const found = approvalManager.resolveRequest(requestId, decision);

    if (!found) {
      log('⏰', `Pedido ${requestId} expirado ou já resolvido`);
      await ctx.answerCbQuery('⏰ Pedido expirado ou já resolvido.').catch(() => {});
      return;
    }

    const emoji = decision === 'allow' ? '✅ APROVADO' : '❌ REJEITADO';
    log(decision === 'allow' ? '✅' : '❌', `Permissão ${decision === 'allow' ? 'aprovada' : 'rejeitada'} via botão | ID: ${requestId}`);
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      await ctx.editMessageText(
        (ctx.callbackQuery.message.text || '') + `\n\n${emoji}`,
        { reply_markup: { inline_keyboard: [] } }
      );
    } catch (_) {
      // Ignorar erros de edição
    }

    await ctx.answerCbQuery(emoji).catch(() => {});
  });

  // Mensagens de texto (execução de tarefas + aprovação por texto)
  bot.on('text', async (ctx) => {
    const text = ctx.message && ctx.message.text;
    if (!text || text.startsWith('/')) return;

    // Aprovação por texto simples quando há pedidos pendentes
    if (approvalManager.pendingCount > 0) {
      const normalized = text.trim().toLowerCase();
      if (['s', 'sim', 'y', 'yes', '1'].includes(normalized)) {
        const count = approvalManager.approveAll();
        log('✅', `Aprovação por texto: ${count} pedido(s) aprovado(s)`);
        await ctx.reply(`✅ ${count} pedido(s) aprovado(s).`).catch(() => {});
        return;
      }
      if (['n', 'não', 'nao', 'no', '0'].includes(normalized)) {
        const count = approvalManager.denyAll();
        log('❌', `Rejeição por texto: ${count} pedido(s) rejeitado(s)`);
        await ctx.reply(`❌ ${count} pedido(s) rejeitado(s).`).catch(() => {});
        return;
      }
    }

    if (claudeRunner.isRunning) {
      log('⚠️', 'Tarefa já ativa — mensagem ignorada');
      await ctx.reply('⚠️ Já existe uma tarefa ativa. Aguarda ou usa /cancel para cancelar.').catch(() => {});
      return;
    }

    log('📨', `Telegram → tarefa recebida: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);
    log('📁', `Projeto: ${currentProjectDir}`);
    await ctx.reply(`⏳ A processar...\n📁 ${currentProjectDir}`).catch(() => {});

    // Executar em background — não bloqueia o handler do Telegraf
    claudeRunner.run(text, currentProjectDir)
      .catch((err) => ({ success: false, output: err.message, duration: 0 }))
      .then(async (result) => {
        log(result.success ? '✅' : '⚠️', `Claude concluiu em ${result.duration}ms`);
        if (!result.success) log('⚠️', `Erro: ${result.output.slice(0, 120)}`);
        const msg = formatTaskResult(text, result.output, result.success, result.duration);
        try {
          await bot.telegram.sendMessage(config.TELEGRAM_CHAT_ID, msg, { parse_mode: 'Markdown' });
          log('📤', 'Resultado enviado ao Telegram');
        } catch (_) {
          await bot.telegram.sendMessage(
            config.TELEGRAM_CHAT_ID,
            `${result.success ? '✅' : '⚠️'} ${result.output}`
          ).catch(() => {});
        }
      });
  });

  // Tratamento global de erros do Telegraf
  bot.catch((err, ctx) => {
    console.error('Telegraf error:', err.message);
  });

  // Função para enviar notificação de permissão ao utilizador
  bot.sendPermissionRequest = async (toolName, toolInput, cwd, requestId) => {
    log('🔔', `Pedido de permissao: ${toolName} | cwd: ${cwd} | ID: ${requestId}`);
    const msg = formatPermissionRequest(toolName, toolInput, cwd, requestId);
    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('✅ Aprovar', `approve:${requestId}`),
      Markup.button.callback('❌ Rejeitar', `deny:${requestId}`),
    ]);

    try {
      await bot.telegram.sendMessage(config.TELEGRAM_CHAT_ID, msg, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (_) {
      // Fallback sem Markdown
      try {
        await bot.telegram.sendMessage(
          config.TELEGRAM_CHAT_ID,
          `🔔 Pedido de Permissão\n🛠 ${toolName}\n📁 ${cwd}\n🆔 ${requestId}`,
          keyboard
        );
      } catch (__) {}
    }
  };

  // Função para enviar mensagem genérica
  bot.sendMessage = async (text) => {
    try {
      await bot.telegram.sendMessage(config.TELEGRAM_CHAT_ID, text);
    } catch (err) {
      console.error('⚠️ Falha ao enviar mensagem Telegram:', err.message);
    }
  };

  // Getter para o projeto atual (necessário no index.js)
  bot.getCurrentProjectDir = () => currentProjectDir;

  return bot;
}

module.exports = { createBot };
