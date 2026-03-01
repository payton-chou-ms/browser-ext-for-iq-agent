#!/usr/bin/env bash
# Start Copilot CLI (headless) + HTTP Proxy
# Usage: ./start.sh [--debug]
#   --debug   Enable verbose debug logging
#
# Env vars:
#   CLI_PORT   (default: 4321)
#   HTTP_PORT  (default: 8321)

set -euo pipefail

# ── Load .env (if present) ──
if [[ -f .env ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    key="${key//[[:space:]]/}"
    [[ -z "$key" ]] && continue
    export "$key=$value"
  done < .env
fi

CLI_PORT="${CLI_PORT:-4321}"
HTTP_PORT="${HTTP_PORT:-8321}"
DEBUG=false
[[ "${1:-}" == "--debug" ]] && DEBUG=true

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Prefixes
P_CLI="${CYAN}[CLI]${NC}"
P_PROXY="${YELLOW}[PROXY]${NC}"
P_SYS="${DIM}[SYS]${NC}"

# ── Helpers ──
ts() { date "+%H:%M:%S"; }

log()   { echo -e "${DIM}[$(ts)]${NC} $*"; }
debug() { $DEBUG && echo -e "${DIM}[$(ts)]${NC} ${DIM}[DEBUG]${NC} $*" || true; }
err()   { echo -e "${DIM}[$(ts)]${NC} ${RED}[ERROR]${NC} $*" >&2; }
ok()    { echo -e "${DIM}[$(ts)]${NC} ${GREEN}${BOLD}✔ $*${NC}"; }

# Kill any process occupying a given port
free_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    log "${YELLOW}⚠ Port $port in use by PID(s): $pids — killing...${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      err "Cannot free port $port (PID $pids still alive). Aborting."
      exit 1
    fi
    ok "Port $port freed"
  else
    debug "Port $port is available"
  fi
}

# ── Cleanup on exit ──
cleanup() {
  [[ "${_CLEANED_UP:-0}" -eq 1 ]] && return
  _CLEANED_UP=1
  trap - EXIT SIGINT SIGTERM
  echo ""
  log "${P_SYS} ⏹ Shutting down..."
  [[ -n "${PROXY_PID:-}" ]] && kill "$PROXY_PID" 2>/dev/null && debug "Killed proxy PID $PROXY_PID"
  [[ -n "${CLI_PID:-}" ]]   && kill "$CLI_PID"   2>/dev/null && debug "Killed CLI PID $CLI_PID"
  wait 2>/dev/null
  log "${P_SYS} ✦ All processes stopped."
}
on_signal() {
  cleanup
  exit 0
}
trap on_signal SIGINT SIGTERM
trap cleanup EXIT

# ── Banner ──
echo ""
echo -e "  ${BOLD}✦ IQ Copilot Launcher${NC}"
echo -e "  ─────────────────────"
echo -e "  CLI port  : ${CYAN}$CLI_PORT${NC}"
echo -e "  Proxy port: ${YELLOW}$HTTP_PORT${NC}"
echo -e "  Debug     : $DEBUG"
if [[ -n "${FOUNDRY_ENDPOINT:-}" ]]; then
  echo -e "  Foundry   : ${GREEN}configured${NC}"
else
  echo -e "  Foundry   : ${DIM}not configured${NC}"
fi
# Python status (shown after venv check below)
echo ""

# ── Python venv setup for Foundry Agent Skill ──
SKILL_DIR=".github/skills/foundry_agent_skill"
VENV_DIR="$SKILL_DIR/.venv"

if [[ -d "$SKILL_DIR" ]]; then
  log "${P_SYS} Setting up Python venv for Foundry Agent Skill..."
  
  # Check if Python is available
  if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
  elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
  else
    log "${YELLOW}⚠ Python not found. Foundry Agent Skill will not work.${NC}"
    PYTHON_CMD=""
  fi
  
  if [[ -n "$PYTHON_CMD" ]]; then
    # Create venv if not exists
    if [[ ! -d "$VENV_DIR" ]]; then
      log "${P_SYS} Creating Python venv at $VENV_DIR..."
      "$PYTHON_CMD" -m venv "$VENV_DIR"
      ok "Python venv created"
    fi
    
    # Activate and install dependencies
    source "$VENV_DIR/bin/activate"
    
    # Check if dependencies are installed (quick check for azure-ai-projects)
    if ! "$VENV_DIR/bin/python" -c "import azure.ai.projects" 2>/dev/null; then
      log "${P_SYS} Installing Foundry Agent Skill dependencies..."
      "$VENV_DIR/bin/pip" install -q "azure-ai-projects>=2.0.0b4" azure-identity python-dotenv openai
      ok "Dependencies installed"
    else
      debug "Foundry Agent Skill dependencies already installed"
    fi
    
    # Export PYTHON_PATH for skill execution
    export FOUNDRY_SKILL_PYTHON="$VENV_DIR/bin/python"
    ok "Foundry Agent Skill Python ready: $FOUNDRY_SKILL_PYTHON"
  fi
fi

# 1) Free ports if occupied
log "${P_SYS} Checking ports..."
free_port "$CLI_PORT"
free_port "$HTTP_PORT"

# 2) Start Copilot CLI
log "${P_CLI} Starting copilot --headless --port $CLI_PORT"
copilot --headless --port "$CLI_PORT" > >(
  while IFS= read -r line; do
    echo -e "${DIM}[$(ts)]${NC} ${P_CLI} $line"
  done
) 2>&1 &
CLI_PID=$!
debug "${P_CLI} launched with PID $CLI_PID"

# Wait for CLI to bind
log "${P_CLI} Waiting for port $CLI_PORT..."
CLI_READY=false
for i in $(seq 1 10); do
  if lsof -ti:"$CLI_PORT" >/dev/null 2>&1; then
    CLI_READY=true
    break
  fi
  debug "${P_CLI} Attempt $i/10 — not ready yet"
  sleep 1
done

if ! $CLI_READY; then
  err "${P_CLI} Did not start on port $CLI_PORT after 10s. Aborting."
  exit 1
fi
ok "${P_CLI} Copilot CLI ready (PID $CLI_PID, port $CLI_PORT)"

# 3) Start HTTP proxy
log "${P_PROXY} Starting node src/proxy.js --cli-port $CLI_PORT --http-port $HTTP_PORT"
node src/proxy.js --cli-port "$CLI_PORT" --http-port "$HTTP_PORT" > >(
  while IFS= read -r line; do
    echo -e "${DIM}[$(ts)]${NC} ${P_PROXY} $line"
  done
) 2>&1 &
PROXY_PID=$!
debug "${P_PROXY} launched with PID $PROXY_PID"

sleep 1
if ! kill -0 "$PROXY_PID" 2>/dev/null; then
  err "${P_PROXY} Failed to start. Aborting."
  exit 1
fi
ok "${P_PROXY} HTTP Proxy ready (PID $PROXY_PID, port $HTTP_PORT)"

# ── Self-test ──
echo ""
log "${P_SYS} Running self-tests..."

TESTS_PASSED=0
TESTS_TOTAL=3

# Test 1: Proxy health
HEALTH=$(curl -sf "http://127.0.0.1:$HTTP_PORT/health" 2>/dev/null || echo "")
if [[ -n "$HEALTH" ]]; then
  ok "Test 1/3 — Proxy health endpoint responds"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  debug "  Response: $HEALTH"
else
  err "Test 1/3 — Proxy health endpoint unreachable"
fi

# Test 2: CLI ping via proxy (SDK REST API)
PING=$(curl -sf -X POST "http://127.0.0.1:$HTTP_PORT/api/ping" \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null || echo "")
if echo "$PING" | grep -q '"ok"'; then
  ok "Test 2/3 — CLI ping via SDK proxy succeeded"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  debug "  Response: $PING"
else
  err "Test 2/3 — CLI ping via SDK proxy failed"
  debug "  Response: $PING"
fi

# Test 3: CLI TCP port is listening
if lsof -ti:"$CLI_PORT" >/dev/null 2>&1; then
  ok "Test 3/3 — CLI TCP port $CLI_PORT is listening"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  err "Test 3/3 — CLI TCP port $CLI_PORT not listening"
fi

# ── Summary ──
echo ""
if [[ $TESTS_PASSED -eq $TESTS_TOTAL ]]; then
  echo -e "  ${GREEN}${BOLD}╔═══════════════════════════════════════╗${NC}"
  echo -e "  ${GREEN}${BOLD}║  ✦ ALL SYSTEMS GO  ($TESTS_PASSED/$TESTS_TOTAL tests passed)  ║${NC}"
  echo -e "  ${GREEN}${BOLD}╚═══════════════════════════════════════╝${NC}"
else
  echo -e "  ${RED}${BOLD}╔═══════════════════════════════════════╗${NC}"
  echo -e "  ${RED}${BOLD}║  ⚠ PARTIAL FAILURE ($TESTS_PASSED/$TESTS_TOTAL passed)        ║${NC}"
  echo -e "  ${RED}${BOLD}╚═══════════════════════════════════════╝${NC}"
fi

echo ""
echo -e "  ${DIM}Ctrl+C to stop all services${NC}"
echo -e "  ${CYAN}[CLI]${NC}   = Copilot CLI logs (port $CLI_PORT)"
echo -e "  ${YELLOW}[PROXY]${NC} = HTTP Proxy logs (port $HTTP_PORT)"
echo ""

# Keep alive with proxy restart loop
MAX_PROXY_RESTARTS=3
PROXY_RESTART_COUNT=0

while true; do
  # Wait for any child to exit
  wait -n 2>/dev/null || sleep 5

  # Check if CLI is still alive
  if ! kill -0 "$CLI_PID" 2>/dev/null; then
    err "${P_CLI} CLI process died. Exiting."
    exit 1
  fi

  # Check if proxy is still alive
  if ! kill -0 "$PROXY_PID" 2>/dev/null; then
    PROXY_RESTART_COUNT=$((PROXY_RESTART_COUNT + 1))
    if [[ $PROXY_RESTART_COUNT -gt $MAX_PROXY_RESTARTS ]]; then
      err "${P_PROXY} Proxy died $MAX_PROXY_RESTARTS times. Giving up."
      exit 1
    fi
    log "${P_PROXY} ⚠ Proxy died (attempt $PROXY_RESTART_COUNT/$MAX_PROXY_RESTARTS). Restarting..."
    sleep 2
    node src/proxy.js --cli-port "$CLI_PORT" --http-port "$HTTP_PORT" > >(
      while IFS= read -r line; do
        echo -e "${DIM}[$(ts)]${NC} ${P_PROXY} $line"
      done
    ) 2>&1 &
    PROXY_PID=$!
    sleep 1
    if kill -0 "$PROXY_PID" 2>/dev/null; then
      ok "${P_PROXY} Proxy restarted (PID $PROXY_PID)"
    else
      err "${P_PROXY} Proxy failed to restart"
    fi
  fi
done
