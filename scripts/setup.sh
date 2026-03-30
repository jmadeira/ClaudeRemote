#!/bin/bash
# ClaudeRemote — Setup interativo

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo ""
echo "🚀 ClaudeRemote — Setup"
echo "═══════════════════════════════════════"
echo ""

# 1. Verificar Node.js >= 18
if ! command -v node &>/dev/null; then
  echo "❌ Node.js não encontrado. Instala em: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js >= 18 é necessário. Versão atual: $(node --version)"
  exit 1
fi
echo "✅ Node.js $(node --version)"

# 2. Verificar jq
if ! command -v jq &>/dev/null; then
  echo "⚠️  jq não encontrado. É necessário para o hook de permissões."
  echo "   Instala com:"
  echo "   Ubuntu/Debian: sudo apt install jq"
  echo "   macOS:         brew install jq"
  echo ""
  read -r -p "Continuar sem jq? [s/N] " CONTINUE
  if [[ "$CONTINUE" != "s" && "$CONTINUE" != "S" ]]; then
    exit 1
  fi
else
  echo "✅ jq $(jq --version)"
fi

# 3. Verificar claude CLI
if ! command -v claude &>/dev/null; then
  echo "⚠️  claude CLI não encontrado."
  echo "   Instala com: npm install -g @anthropic-ai/claude-code"
  echo ""
else
  echo "✅ claude CLI encontrado"
fi

echo ""
echo "📝 Configuração do Telegram"
echo "───────────────────────────"
echo ""
echo "Para criar um bot Telegram:"
echo "  1. Abre o Telegram e procura @BotFather"
echo "  2. Envia /newbot e segue as instruções"
echo "  3. Copia o token que o BotFather te dá"
echo ""
read -r -p "TELEGRAM_BOT_TOKEN: " BOT_TOKEN

if [ -z "$BOT_TOKEN" ]; then
  echo "❌ Token não pode estar vazio."
  exit 1
fi

echo ""
echo "Para obter o teu Chat ID:"
echo "  1. Procura @userinfobot no Telegram"
echo "  2. Envia qualquer mensagem"
echo "  3. Copia o ID que ele te envia"
echo "  Ou usa: node scripts/get-chat-id.js"
echo ""
read -r -p "TELEGRAM_CHAT_ID: " CHAT_ID

if [ -z "$CHAT_ID" ]; then
  echo "❌ Chat ID não pode estar vazio."
  exit 1
fi

echo ""
read -r -p "PROJECT_DIR [$(pwd)]: " PROJECT_DIR
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

# Criar .env
ENV_FILE="$PROJECT_ROOT/.env"
cat > "$ENV_FILE" <<ENVFILE
# ClaudeRemote — Configuração
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
TELEGRAM_CHAT_ID=$CHAT_ID
PROJECT_DIR=$PROJECT_DIR
ENVFILE

echo ""
echo "✅ Ficheiro .env criado em $ENV_FILE"

# npm install
echo ""
echo "📦 A instalar dependências..."
cd "$PROJECT_ROOT" && npm install
echo "✅ Dependências instaladas"

# Caminho absoluto do hook
HOOK_PATH="$PROJECT_ROOT/hooks/permission-hook.sh"
chmod +x "$HOOK_PATH"

echo ""
echo "🔗 Configuração do Claude Code Hook"
echo "────────────────────────────────────"
echo ""
echo "Adiciona ao ficheiro ~/.claude/settings.json:"
echo ""
cat <<HOOKJSON
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "$HOOK_PATH"
          }
        ]
      }
    ]
  }
}
HOOKJSON

SETTINGS_FILE="$HOME/.claude/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
  echo ""
  read -r -p "Adicionar automaticamente ao $SETTINGS_FILE? [s/N] " AUTO_ADD
  if [[ "$AUTO_ADD" == "s" || "$AUTO_ADD" == "S" ]]; then
    # Backup
    cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak"
    echo "   Backup criado: $SETTINGS_FILE.bak"
    echo "   ⚠️  Por favor, edita $SETTINGS_FILE manualmente para adicionar o hook."
    echo "      (Edição automática de JSON é complexa — usa o exemplo acima)"
  fi
fi

echo ""
echo "🎉 Setup concluído!"
echo ""
echo "Para iniciar:"
echo "  npm start"
echo ""
echo "Para desenvolvimento:"
echo "  npm run dev"
echo ""
