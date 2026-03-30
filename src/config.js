'use strict';

require('dotenv').config();

// Variáveis obrigatórias
const requiredVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ Variável de ambiente obrigatória não definida: ${varName}`);
    console.error('   Copia o ficheiro .env.example para .env e preenche os valores.');
    process.exit(1);
  }
}

const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  PORT: parseInt(process.env.PORT, 10) || 8765,
  APPROVAL_TIMEOUT: parseInt(process.env.APPROVAL_TIMEOUT, 10) || 300,
  PROJECT_DIR: process.env.PROJECT_DIR || process.cwd(),
  CLAUDE_CMD: process.env.CLAUDE_CMD || 'claude',
  MAX_CONCURRENT_TASKS: parseInt(process.env.MAX_CONCURRENT_TASKS, 10) || 1,
  TASK_TIMEOUT: parseInt(process.env.TASK_TIMEOUT, 10) || 600,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
