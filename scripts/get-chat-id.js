#!/usr/bin/env node
'use strict';

// Helper para obter o Chat ID do Telegram

const { Telegraf } = require('telegraf');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Insere o TELEGRAM_BOT_TOKEN: ', async (token) => {
  if (!token) {
    console.error('❌ Token não pode estar vazio.');
    rl.close();
    process.exit(1);
  }

  const bot = new Telegraf(token);
  console.log('\n✅ Bot iniciado!');
  console.log('📱 Agora, no Telegram:');
  console.log('   1. Abre a conversa com o teu bot');
  console.log('   2. Envia /start ou qualquer mensagem');
  console.log('   3. O Chat ID será mostrado aqui\n');
  console.log('(Ctrl+C para sair)\n');

  bot.on('message', (ctx) => {
    const chatId = ctx.chat.id;
    const username = ctx.from && ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    console.log(`✅ Chat ID encontrado!`);
    console.log(`   Utilizador: ${username}`);
    console.log(`   Chat ID: ${chatId}`);
    console.log(`\nAdiciona ao teu .env:`);
    console.log(`TELEGRAM_CHAT_ID=${chatId}`);
    bot.stop();
    rl.close();
    process.exit(0);
  });

  try {
    await bot.launch();
  } catch (err) {
    console.error('❌ Erro ao iniciar o bot:', err.message);
    rl.close();
    process.exit(1);
  }

  process.on('SIGINT', () => {
    bot.stop('SIGINT');
    rl.close();
    process.exit(0);
  });
});
