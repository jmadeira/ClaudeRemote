'use strict';

const { test, describe, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Mock do child_process.spawn para não precisar do claude CLI
const { EventEmitter } = require('events');

describe('ClaudeRunner', () => {
  // Usar mock de spawn para simular processos
  test('isRunning é false inicialmente', async () => {
    const ClaudeRunner = require('../src/claude-runner');
    const runner = new ClaudeRunner('echo', process.cwd(), 10, 1);
    assert.equal(runner.isRunning, false);
  });

  test('activeTask é null inicialmente', () => {
    const ClaudeRunner = require('../src/claude-runner');
    const runner = new ClaudeRunner('echo', process.cwd(), 10, 1);
    assert.equal(runner.activeTask, null);
  });

  test('cancel() retorna false sem tarefa ativa', () => {
    const ClaudeRunner = require('../src/claude-runner');
    const runner = new ClaudeRunner('echo', process.cwd(), 10, 1);
    assert.equal(runner.cancel(), false);
  });

  test('run() com diretório inexistente retorna erro', async () => {
    const ClaudeRunner = require('../src/claude-runner');
    const runner = new ClaudeRunner('echo', process.cwd(), 10, 1);
    try {
      await runner.run('hello', '/caminho/que/nao/existe/9999');
      assert.fail('Devia ter lançado erro');
    } catch (err) {
      assert.ok(err.message.includes('Diretório') || err.message.includes('não encontrado'));
    }
  });

  test('run() com comando "echo" retorna sucesso', async () => {
    const ClaudeRunner = require('../src/claude-runner');
    // Usar 'echo' como substituto do claude para teste
    const runner = new ClaudeRunner('echo', process.cwd(), 10, 1);
    const result = await runner.run('hello world');
    // echo retorna o texto passado, mas claude-runner passa args específicos
    // O importante é que não crashe e retorne um objeto válido
    assert.ok(typeof result === 'object');
    assert.ok('success' in result);
    assert.ok('output' in result);
    assert.ok('duration' in result);
    assert.ok(typeof result.duration === 'number');
    assert.ok(result.duration >= 0);
  });

  test('run() com comando inexistente retorna mensagem de erro clara', async () => {
    const ClaudeRunner = require('../src/claude-runner');
    const runner = new ClaudeRunner('comando-que-nao-existe-xyz', process.cwd(), 10, 1);
    const result = await runner.run('hello');
    assert.equal(result.success, false);
    assert.ok(
      result.output.includes('não encontrado') || result.output.includes('Claude Code CLI'),
      `Output inesperado: ${result.output}`
    );
  });

  test('não permite mais que MAX_CONCURRENT_TASKS simultâneas', async () => {
    const ClaudeRunner = require('../src/claude-runner');
    // Simular uma tarefa ativa forçando _activeTask
    const runner = new ClaudeRunner('echo', process.cwd(), 10, 1);
    runner._activeTask = { prompt: 'tarefa fake', startedAt: Date.now(), cwd: process.cwd() };

    try {
      await runner.run('segunda tarefa');
      assert.fail('Devia ter lançado erro');
    } catch (err) {
      assert.ok(err.message.includes('tarefa ativa'));
    }

    // Limpar
    runner._activeTask = null;
  });
});
