'use strict';

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

class ClaudeRunner {
  constructor(claudeCmd, defaultCwd, taskTimeout, maxConcurrent) {
    this._claudeCmd = claudeCmd || 'claude';
    this._defaultCwd = defaultCwd || process.cwd();
    // timeout em milissegundos
    this._taskTimeoutMs = (taskTimeout || 600) * 1000;
    this._maxConcurrent = maxConcurrent || 1;
    this._activeTask = null;
    this._activeProcess = null;
  }

  // Executa um prompt no Claude Code CLI
  // Retorna { success: boolean, output: string, duration: number }
  run(prompt, cwd) {
    if (this._activeTask) {
      return Promise.reject(new Error('Já existe uma tarefa ativa. Usa /cancel para cancelar.'));
    }

    const workDir = cwd || this._defaultCwd;

    if (!existsSync(workDir)) {
      return Promise.reject(new Error(`Diretório não encontrado: ${workDir}`));
    }

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const args = ['-p', prompt, '--output-format', 'text', '--cwd', workDir];

      let proc;
      try {
        proc = spawn(this._claudeCmd, args, {
          env: { ...process.env },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        if (err.code === 'ENOENT') {
          resolve({
            success: false,
            output: 'Claude Code CLI não encontrado. Instala com: npm install -g @anthropic-ai/claude-code',
            duration: 0,
          });
          return;
        }
        resolve({ success: false, output: String(err.message), duration: 0 });
        return;
      }

      this._activeProcess = proc;
      this._activeTask = { prompt, startedAt, cwd: workDir };

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

      // Timeout
      const timeoutHandle = setTimeout(() => {
        if (this._activeProcess === proc) {
          try { proc.kill('SIGTERM'); } catch (_) {}
          this._activeTask = null;
          this._activeProcess = null;
          const duration = Date.now() - startedAt;
          resolve({
            success: false,
            output: `Timeout: a tarefa excedeu ${Math.round(this._taskTimeoutMs / 1000)}s e foi cancelada.`,
            duration,
          });
        }
      }, this._taskTimeoutMs);

      proc.on('error', (err) => {
        clearTimeout(timeoutHandle);
        this._activeTask = null;
        this._activeProcess = null;
        const duration = Date.now() - startedAt;
        if (err.code === 'ENOENT') {
          resolve({
            success: false,
            output: 'Claude Code CLI não encontrado. Instala com: npm install -g @anthropic-ai/claude-code',
            duration,
          });
        } else {
          resolve({ success: false, output: String(err.message), duration });
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);
        this._activeTask = null;
        this._activeProcess = null;
        const duration = Date.now() - startedAt;

        const success = code === 0 || (stdout.length > 0);
        const output = stdout.length > 0 ? stdout : (stderr || `Processo terminou com código ${code}`);

        resolve({ success, output, duration });
      });
    });
  }

  // Cancela a tarefa ativa (se existir)
  cancel() {
    if (!this._activeProcess) return false;
    try {
      this._activeProcess.kill('SIGTERM');
    } catch (_) {}
    return true;
  }

  // Verifica se há tarefa ativa
  get isRunning() {
    return this._activeTask !== null;
  }

  // Info da tarefa ativa
  get activeTask() {
    return this._activeTask ? { ...this._activeTask } : null;
  }
}

module.exports = ClaudeRunner;
