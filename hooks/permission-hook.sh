#!/bin/bash
# ClaudeRemote — Hook de Permissão do Claude Code
# Envia pedidos de permissão ao servidor local que reencaminha para Telegram

SERVER_URL="${CLAUDE_REMOTE_URL:-http://127.0.0.1:8765}"

# Ler evento JSON do stdin
INPUT=$(cat)

# Extrair campos com jq
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // .toolName // "unknown"' 2>/dev/null)
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // .toolInput // {}' 2>/dev/null)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null)

# POST ao servidor local (timeout = APPROVAL_TIMEOUT + 10s de margem)
RESPONSE=$(curl -s -m 310 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool_name\": \"$TOOL_NAME\", \"tool_input\": $TOOL_INPUT, \"cwd\": \"$CWD\"}" \
  "$SERVER_URL/request-approval" 2>/dev/null)

# Extrair decisão (default: deny por segurança)
DECISION=$(echo "$RESPONSE" | jq -r '.decision // "deny"' 2>/dev/null)
if [ -z "$DECISION" ] || [ "$DECISION" = "null" ]; then
  DECISION="deny"
fi

# Mapear para formato do hook
if [ "$DECISION" = "allow" ]; then
  BEHAVIOR="allow"
else
  BEHAVIOR="deny"
fi

# Retornar ao Claude Code
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "$BEHAVIOR"
    }
  }
}
EOF
