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

1. **Aprovação remota de permissões** — Quando o Claude Code pede permissão para executar uma ferramenta (Bash, Edit, Write, etc.), recebes uma notificação no Telegram com botões [✅ Aprovar] e [❌ Rejeitar]. Podes também aprovar/rejeitar respondendo com texto simples (`s`/`n`).

2. **Envio remoto de tarefas** — Envia mensagens de texto no Telegram que são executadas como prompts no Claude Code CLI, mantendo contexto de conversação entre mensagens.

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

### 4. Configurar o hook no Claude Code

O hook intercepta os pedidos de permissão do Claude Code e envia-os para o Telegram em vez de mostrar prompts interativos no terminal.

Adiciona ao ficheiro `~/.claude/settings.json` **no nível raiz** (não dentro de `"permissions"`):

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /caminho/absoluto/para/ClaudeRemote/hooks/permission-hook.js"
          }
        ]
      }
    ]
  },
  "permissions": {
    ...
  }
}
```

> **Importante:** O hook tem de estar no nível raiz do JSON, não dentro de `"permissions"`. Usa sempre o caminho absoluto.
>
> **Windows:** usa `node` + caminho absoluto com barras `/`. O `permission-hook.js` é puro Node.js e funciona em Windows, Linux e Mac sem dependências externas.

### 5. Iniciar

```bash
npm start
```

Ao arrancar, recebes no Telegram uma confirmação de que o servidor está online.

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
| `/new` | Iniciar nova sessão (limpa contexto da conversa) |
| `/denyall` | Rejeitar todos os pedidos de permissão pendentes |
| `/project` | Ver diretório do projeto atual |
| `/project <caminho>` | Mudar o diretório do projeto |
| `/task` | Ver informação da tarefa ativa |
| `/cancel` | Cancelar a tarefa ativa |
| `/help` | Ajuda detalhada |

**Enviar tarefas:** qualquer mensagem de texto (não-comando) é executada como prompt no Claude Code, mantendo o contexto da sessão anterior.

---

## Aprovação de Permissões

Quando o Claude Code pede permissão para editar um ficheiro, executar um comando, etc., recebes no Telegram:

```
🔔 Pedido de Permissao
🛠 Ferramenta: Edit
📁 /caminho/do/projeto
🕐 21:36
📄 src/server.js

[✅ Aprovar]  [❌ Rejeitar]
```

Podes responder de três formas:
- **Botões inline** — clica ✅ ou ❌ diretamente na mensagem
- **Texto `s`** (ou `sim`, `y`, `yes`, `1`) — aprova todos os pedidos pendentes
- **Texto `n`** (ou `não`, `nao`, `no`, `0`) — rejeita todos os pedidos pendentes

---

## Contexto de Conversação

As tarefas enviadas via Telegram mantêm contexto entre mensagens — o Claude lembra-se das instruções anteriores na mesma sessão.

Para começar uma conversa nova (sem memória das anteriores), usa `/new`.

---

## Configuração (`.env`)

| Variável | Obrigatória | Default | Descrição |
|----------|-------------|---------|-----------|
| `TELEGRAM_BOT_TOKEN` | Sim | — | Token do BotFather |
| `TELEGRAM_CHAT_ID` | Sim | — | Chat ID do utilizador |
| `PORT` | Não | 8765 | Porta do servidor HTTP local |
| `APPROVAL_TIMEOUT` | Não | 0 | Timeout em segundos para aprovação. `0` = sem timeout (aguarda indefinidamente) |
| `PROJECT_DIR` | Não | `process.cwd()` | Diretório do projeto |
| `CLAUDE_CMD` | Não | `claude` | Comando do Claude Code CLI |
| `MAX_CONCURRENT_TASKS` | Não | 1 | Máximo de tarefas simultâneas |
| `TASK_TIMEOUT` | Não | 0 | Timeout em segundos para tarefas CLI. `0` = sem timeout. Se ambos > 0, `TASK_TIMEOUT` deve ser superior a `APPROVAL_TIMEOUT` |

---

## Exemplos de Uso

### Aprovar um comando Bash

```
🔔 Pedido de Permissao
🛠 Ferramenta: Bash
📁 /home/joao/meu-projeto
🕐 14:32
$ npm install express

[✅ Aprovar] [❌ Rejeitar]
```

### Enviar tarefa de desenvolvimento

```
Tu:     "Adiciona validação de email ao formulário de registo"
Bot:    ⏳ A processar...
        📁 /home/joao/meu-projeto
Bot:    ✅ Resultado
        Adicionei validação de email...
        ⏱ 45s
```

### Conversa com contexto

```
Tu:     "Cria a função validateEmail em src/utils/validators.js"
Bot:    ✅ Resultado — função criada
Tu:     "Agora adiciona testes para essa função"   ← Claude lembra-se do contexto
Bot:    ✅ Resultado — testes adicionados
Tu:     /new                                        ← nova sessão
```

### Mudar de projeto

```
/project C:/Users/joao/outro-projeto
✅ Projeto alterado para: C:/Users/joao/outro-projeto
```

---

## Logging no Terminal

O servidor mostra em tempo real o que está a acontecer:

```
[21:30:01] 📨 Telegram → tarefa recebida: "Adiciona validação de email..."
[21:30:01] 📁 Projeto: C:/Users/joao/meu-projeto
[21:30:05] 🔔 Pedido de permissao: Edit | cwd: ... | ID: abc-123
[21:30:08] ✅ Permissão aprovada via botão | ID: abc-123
[21:30:45] ✅ Claude concluiu em 44000ms
[21:30:45] 📤 Resultado enviado ao Telegram
```

---

## Testes

```bash
npm test
```

64 testes (unit + integração) usando o runner nativo do Node.js (`node:test`), sem dependências externas.

---

## CI

GitHub Actions corre os testes automaticamente em Node.js 18, 20 e 22 em cada push e pull request para `main`.

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

**Mensagem de arranque não chega ao Telegram**
- Confirma que o servidor arrancou sem erros no terminal
- Verifica que o token e chat ID no `.env` estão corretos

**Os botões de aprovação não aparecem**
- Confirma que o hook está configurado no nível raiz do `~/.claude/settings.json` (não dentro de `"permissions"`)
- Verifica que o caminho para `permission-hook.js` é absoluto e correto
- Confirma que o servidor ClaudeRemote está a correr antes de lançar tarefas no Claude Code

**O Claude pede aprovação no terminal em vez do Telegram**
- O hook não está a ser chamado — verifica a configuração do `~/.claude/settings.json`
- Reinicia o Claude Code após alterar o `settings.json`

**Timeout em todos os pedidos**
- Verifica que o servidor está a correr: `curl http://127.0.0.1:8765/health`
- Confirma que a porta 8765 não está em uso por outro processo

**Claude CLI não encontrado**
- Instala globalmente: `npm install -g @anthropic-ai/claude-code`
- Ou define o caminho completo em `CLAUDE_CMD=/caminho/para/claude`

**Contexto perdido entre mensagens**
- É comportamento esperado após `/new` ou reinício do servidor
- O contexto é mantido automaticamente durante a sessão

---

## Requisitos

- **Node.js** >= 18.0.0
- **Claude Code CLI** — `npm install -g @anthropic-ai/claude-code`

---

## Licença

MIT — ver [LICENSE](LICENSE)
