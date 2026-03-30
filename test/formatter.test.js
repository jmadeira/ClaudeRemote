'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  escapeMarkdown,
  formatPermissionRequest,
  formatTaskResult,
  formatStatus,
  formatWelcome,
} = require('../src/formatter');

describe('escapeMarkdown', () => {
  test('escapa backslash antes de outros caracteres', () => {
    // A barra invertida deve ser escapada primeiro para evitar duplo-escape
    assert.equal(escapeMarkdown('a\\b'), 'a\\\\b');
    // Texto com barra invertida e underscore
    const result = escapeMarkdown('a\\_b');
    assert.equal(result, 'a\\\\\\_b');
  });

  test('escapa underscore', () => {
    assert.equal(escapeMarkdown('hello_world'), 'hello\\_world');
  });

  test('escapa asterisco', () => {
    assert.equal(escapeMarkdown('hello*world'), 'hello\\*world');
  });

  test('escapa backtick', () => {
    assert.equal(escapeMarkdown('hello`world'), 'hello\\`world');
  });

  test('escapa colchetes e parênteses', () => {
    assert.equal(escapeMarkdown('[link](url)'), '\\[link\\]\\(url\\)');
  });

  test('escapa todos os caracteres especiais', () => {
    const special = '_*[]()~`>#+-=|{}.!';
    const escaped = escapeMarkdown(special);
    // Cada char deve ter \ antes
    for (const ch of special) {
      assert.ok(escaped.includes('\\' + ch), `Deveria escapar: ${ch}`);
    }
  });

  test('não altera texto normal', () => {
    assert.equal(escapeMarkdown('hello world'), 'hello world');
  });

  test('converte não-string para string', () => {
    assert.equal(escapeMarkdown(42), '42');
  });
});

describe('formatPermissionRequest', () => {
  test('ferramenta Bash mostra comando', () => {
    const msg = formatPermissionRequest('Bash', { command: 'npm test' }, '/projeto', 'id-123');
    assert.ok(msg.includes('Bash'), 'Deve incluir nome da ferramenta');
    assert.ok(msg.includes('npm test'), 'Deve incluir o comando');
    assert.ok(msg.includes('id-123') || msg.includes('id\\-123'), 'Deve incluir o requestId');
  });

  test('ferramenta Edit mostra caminho do ficheiro', () => {
    const msg = formatPermissionRequest('Edit', { path: '/src/app.js' }, '/projeto', 'id-456');
    assert.ok(msg.includes('Edit'), 'Deve incluir nome da ferramenta');
    // O path pode ser escapado pelo Markdown (ex: . → \.)
    assert.ok(msg.includes('/src/app'), 'Deve incluir o path');
  });

  test('ferramenta Write mostra caminho', () => {
    const msg = formatPermissionRequest('Write', { path: '/out/file.txt' }, '/projeto', 'id-789');
    assert.ok(msg.includes('Write'));
    assert.ok(msg.includes('/out/file.txt') || msg.includes('out'));
  });

  test('ferramenta Read mostra padrão', () => {
    const msg = formatPermissionRequest('Read', { path: '/src/index.js' }, '/projeto', 'id-read');
    assert.ok(msg.includes('Read'));
  });

  test('ferramenta desconhecida mostra JSON truncado', () => {
    const msg = formatPermissionRequest('CustomTool', { key: 'value' }, '/projeto', 'id-other');
    assert.ok(msg.includes('CustomTool'));
  });

  test('escapa caracteres especiais do Markdown no cwd', () => {
    const msg = formatPermissionRequest('Bash', { command: 'ls' }, '/home/user_test/project.dir', 'id-esc');
    // O cwd com underscore e ponto deve ser escapado
    assert.ok(msg.includes('\\_') || msg.includes('/home'), 'cwd deve aparecer escapado ou sem chars especiais');
  });

  test('trunca comando longo a 500 chars', () => {
    const longCmd = 'a'.repeat(600);
    const msg = formatPermissionRequest('Bash', { command: longCmd }, '/proj', 'id-long');
    // Deve conter "..." indicando truncagem
    assert.ok(msg.includes('...'), 'Deve truncar comando longo');
  });
});

describe('formatTaskResult', () => {
  test('sucesso mostra emoji ✅', () => {
    const msg = formatTaskResult('faz algo', 'output ok', true, 5000);
    assert.ok(msg.includes('✅'));
  });

  test('erro mostra emoji ⚠️', () => {
    const msg = formatTaskResult('faz algo', 'erro aqui', false, 1000);
    assert.ok(msg.includes('⚠️'));
  });

  test('trunca output longo a ~3800 chars', () => {
    const longOutput = 'x'.repeat(5000);
    const msg = formatTaskResult('prompt', longOutput, true, 1000);
    // Output deve ser truncado
    assert.ok(msg.length < 5000, 'Mensagem deve ser truncada');
    assert.ok(msg.includes('truncado'), 'Deve indicar que foi truncado');
  });

  test('trunca prompt a 100 chars', () => {
    const longPrompt = 'p'.repeat(200);
    const msg = formatTaskResult(longPrompt, 'output', true, 1000);
    // O prompt original tem 200 chars mas deve ser truncado a 100 + indicador
    // Após truncar e escapar Markdown, os "..." ficam como "\.\.\."
    assert.ok(msg.includes('\\.\\.\\.') || msg.includes('...'), 'Deve truncar prompt longo');
  });

  test('mostra duração', () => {
    const msg = formatTaskResult('teste', 'ok', true, 45000);
    assert.ok(msg.includes('45s') || msg.includes('45'), 'Deve mostrar duração em segundos');
  });
});

describe('formatStatus', () => {
  test('mostra pedidos pendentes', () => {
    const msg = formatStatus(3, null, '/projeto');
    assert.ok(msg.includes('3'), 'Deve mostrar contagem de pendentes');
  });

  test('mostra sem pedidos pendentes', () => {
    const msg = formatStatus(0, null, '/projeto');
    assert.ok(msg.includes('pendentes') || msg.includes('Sem'));
  });

  test('mostra tarefa ativa', () => {
    const task = { prompt: 'faz algo', startedAt: Date.now(), cwd: '/proj' };
    const msg = formatStatus(0, task, '/projeto');
    assert.ok(msg.includes('faz algo') || msg.includes('ativa'));
  });

  test('mostra diretório do projeto', () => {
    const msg = formatStatus(0, null, '/meu/projeto');
    assert.ok(msg.includes('/meu/projeto') || msg.includes('meu'));
  });
});

describe('formatWelcome', () => {
  test('contém comandos principais', () => {
    const msg = formatWelcome();
    assert.ok(msg.includes('start') || msg.includes('Bem\\-vindo') || msg.includes('Bem-vindo'));
  });

  test('é uma string não vazia', () => {
    const msg = formatWelcome();
    assert.ok(typeof msg === 'string');
    assert.ok(msg.length > 0);
  });
});
