#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 4 ]; then
  echo "Uso: $0 <project-id-or-name> <environment> <VAR_NAME> <VAR_VALUE>"
  echo "Ex: $0 my-project production VITE_TURNSTILE_SITE_KEY my-site-key"
  echo "Requisitos: export VERCEL_TOKEN=your_token"
  exit 1
fi

PROJECT_ARG="$1"
ENVIRONMENT="$2" # production|preview|development
KEY="$3"
VALUE="$4"

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "ERRO: defina VERCEL_TOKEN no ambiente (use um token com permissões de projeto)."
  exit 2
fi

API_BASE="https://api.vercel.com"

# If PROJECT_ARG looks like an id (starts with "prj_" or "proj_"), use it, else try to resolve by name
PROJECT_ID=""
if [[ "$PROJECT_ARG" =~ ^(prj_|proj_|project_) ]]; then
  PROJECT_ID="$PROJECT_ARG"
else
  echo "Procurando projeto com nome '$PROJECT_ARG'..."
  # Try listing projects and match by name
  PROJECT_ID=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "$API_BASE/v9/projects" \
    | jq -r --arg NAME "$PROJECT_ARG" '.projects[] | select(.name == $NAME) | .id' | head -n1)
  if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
    echo "Projeto não encontrado por nome. Passe o project-id diretamente (você pode obter em Vercel UI)."
    exit 3
  fi
fi

echo "Usando project id: $PROJECT_ID"

echo "Buscando variáveis de ambiente existentes..."
EXISTING_ENV_ID=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "$API_BASE/v9/projects/$PROJECT_ID/env" \
  | jq -r --arg KEY "$KEY" --arg ENV "$ENVIRONMENT" '.envs[] | select(.key==$KEY and (.target|index($ENV))) | .id' | head -n1)

if [ -n "$EXISTING_ENV_ID" ] && [ "$EXISTING_ENV_ID" != "null" ]; then
  echo "Variável já existe (id=$EXISTING_ENV_ID). Atualizando..."
  curl -s -X PATCH "$API_BASE/v9/projects/$PROJECT_ID/env/$EXISTING_ENV_ID" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d $(jq -n --arg v "$VALUE" '{value:$v}') \
    | jq
  echo "Atualização concluída."
else
  echo "Criando variável '$KEY' para ambiente '$ENVIRONMENT'..."
  # target must be array; we add only requested environment
  curl -s -X POST "$API_BASE/v9/projects/$PROJECT_ID/env" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d $(jq -n --arg k "$KEY" --arg v "$VALUE" --argjson tgt '["'$(echo "$ENVIRONMENT")'" ]' '{key:$k,value:$v,target:$tgt,type:"encrypted"}') \
    | jq
  echo "Criação concluída."
fi

echo "OK"
