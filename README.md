# ClaudeRemote

Controlo remoto bidirecional do Claude Code via Telegram — aprova permissões e envia tarefas de desenvolvimento diretamente do telemóvel.

---

## Como funciona

```
┌─────────────────────────────────────────────────────────┐
│                    COMPUTADOR DO DEV                     │
│                                                          │
│  ┌──────────────┐    Hook     ┌────────────────────┐    │
│  │  Claude Code  │ ─────────→ │   ClaudeRemote     │    │
│  │  (VS Code)    │ ←───────── │   (Node.js Server) │    │
│  └──────────────┘  Decisão    └────────┬───────────┘    │
│                                        │                 │
│  ┌──────────────┐   CLI spawn          │                 │
│  │  Claude Code  │ ←──────────────────┘                 │
│  │  (CLI tasks)  │                                       │
│  └──────────────┘                                        │
└────────────────────────────┬────────────────────────────┘
                             │ Telegram Bot API
                             │ (HTTPS)
                    ┌────────▼────────┐
                    │    Telegram      │
                    │  (Telemóvel)     │
                    └─────────────────┘
```

**Duas funções principais:**

1. **Aprovação remota de permissões** — Quando o Claude Code pede permissão para executar uma ferramenta (Bash, Edit, Write, etc.), recebes uma notificação no Telegram com botões [✅ Aprovar] e [❌ Rejeitar].

2. **Envio remoto de tarefas** — Envia mensagens de texto no Telegram que são executadas como prompts no Claude Code CLI.

---

## Setup Rápido

### 1. Criar bot no Telegram

1. Abre o Telegram e procura **@BotFather**
2. Envia `/newbot` e segue as instruções
3. Guarda o token que o BotFather te dá

### 2. Obter o teu Chat ID

1. Procura **@userinfobot** no Telegram
2. Envia qualquer mensagem
3. Guarda o ID que ele te envia

Ou usa o helper incluído:
```bash
node scripts/get-chat-id.js
```

### 3. Instalar e configurar

```bash
git clone https://github.com/jmadeira/ClaudeRemote.git claude-remote
cd claude-remote
npm install
cp .env.example .env
# Edita o .env com o teu token e chat ID
```

### 4. Adicionar hook ao Claude Code

Adiciona ao ficheiro `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/absoluto/claude-remote/hooks/permission-hook.sh"
          }
        ]
      }
    ]
  }
}
```

### 5. Iniciar

```bash
npm start
```

---

## Setup Automático

```bash
npm run setup
```

O script interativo guia-te por todo o processo.

---

## Comandos do Bot

| Comando | Descrição |
|---------|-----------|
| `/start` | Boas-vindas e lista de comandos |
| `/status` | Estado atual (pedidos pendentes, tarefa ativa, projeto) |
| `/denyall` | Rejeitar todos os pedidos de permissão pendentes |
| `/project` | Ver diretório do projeto atual |
| `/project <caminho>` | Mudar o diretório do projeto |
| `/task` | Ver informação da tarefa ativa |
| `/cancel` | Cancelar a tarefa ativa |
| `/help` | Ajuda detalhada |

**Enviar tarefas:** qualquer mensagem de texto (não-comando) é executada como prompt no Claude Code.

---

## Configuração (`.env`)

| Variável | Obrigatória | Default | Descrição |
|----------|-------------|---------|-----------|
| `TELEGRAM_BOT_TOKEN` | Sim | — | Token do BotFather |
| `TELEGRAM_CHAT_ID` | Sim | — | Chat ID do utilizador |
| `PORT` | Não | 8765 | Porta do servidor HTTP local |
| `APPROVAL_TIMEOUT` | Não | 300 | Timeout em segundos para aprovação |
| `PROJECT_DIR` | Não | `process.cwd()` | Diretório do projeto |
| `CLAUDE_CMD` | Não | `claude` | Comando do Claude Code CLI |
| `MAX_CONCURRENT_TASKS` | Não | 1 | Máximo de tarefas simultâneas |
| `TASK_TIMEOUT` | Não | 600 | Timeout em segundos para tarefas CLI |
| `LOG_LEVEL` | Não | `info` | Nível de log: debug, info, warn, error |

---

## Exemplos de Uso

### Aprovar um comando Bash

```
[Telegram] 🔔 Pedido de Permissão
           🛠 Ferramenta: Bash
           📁 /home/joao/meu-projeto
           🕐 14:32
           ```
           npm install express
           ```
           [✅ Aprovar] [❌ Rejeitar]
```

### Enviar tarefa de desenvolvimento

```
[Telegram] Utilizador: "Adiciona validação de email ao formulário de registo"
[Telegram] ⏳ A processar...
[Telegram] ✅ Resultado:
           Adicionei validação de email ao formulário de registo.
           - src/components/RegisterForm.jsx: Adicionada função validateEmail()
           - src/utils/validators.js: Novo ficheiro com regex de validação
           ⏱ 45s
```

### Mudar de projeto

```
/project /home/joao/outro-projeto
✅ Projeto alterado para: /home/joao/outro-projeto
```

---

## Arranque Automático no VS Code

Copia o ficheiro `.vscode/tasks.json.example` para `.vscode/tasks.json` no diretório do ClaudeRemote. O servidor iniciará automaticamente ao abrir o VS Code.

---

## Arranque como serviço systemd (Linux)

Cria o ficheiro `/etc/systemd/system/claude-remote.service`:

```ini
[Unit]
Description=ClaudeRemote — Controlo remoto do Claude Code via Telegram
After=network.target

[Service]
Type=simple
User=<teu-utilizador>
WorkingDirectory=/caminho/para/claude-remote
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable claude-remote
sudo systemctl start claude-remote
```

---

## FAQ / Resolução de Problemas

**O bot não responde**
- Verifica que o `TELEGRAM_BOT_TOKEN` está correto no `.env`
- Confirma que o `TELEGRAM_CHAT_ID` corresponde ao teu chat pessoal com o bot
- Usa `node scripts/get-chat-id.js` para obter o Chat ID correto

**O hook não funciona**
- Verifica que o caminho no `~/.claude/settings.json` é absoluto e correto
- Confirma que o script tem permissões de execução: `chmod +x hooks/permission-hook.sh`
- Verifica que `jq` e `curl` estão instalados

**Timeout em todos os pedidos**
- Verifica que o servidor está a correr: `curl http://127.0.0.1:8765/health`
- Confirma que a porta 8765 não está em uso por outro processo

**Claude CLI não encontrado**
- Instala globalmente: `npm install -g @anthropic-ai/claude-code`
- Ou define o caminho completo em `CLAUDE_CMD=/caminho/para/claude`

---

## Requisitos

- **Node.js** >= 18.0.0
- **jq** (para o hook bash) — `apt install jq` ou `brew install jq`
- **curl** (para o hook bash) — normalmente já instalado
- **Claude Code CLI** — `npm install -g @anthropic-ai/claude-code`

---

## Licença

MIT — ver [LICENSE](LICENSE)
