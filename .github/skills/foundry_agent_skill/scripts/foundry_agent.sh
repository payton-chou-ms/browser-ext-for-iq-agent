#!/usr/bin/env bash
# Wrapper script for foundry_agent.py
# Automatically finds Python and sets up the environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$SKILL_DIR/.venv"

# Find Python executable
find_python() {
  # 1. Check if venv exists (created by start.sh)
  if [[ -x "$VENV_DIR/bin/python" ]]; then
    echo "$VENV_DIR/bin/python"
    return 0
  fi
  
  # 2. Check FOUNDRY_SKILL_PYTHON env var (set by start.sh)
  if [[ -n "${FOUNDRY_SKILL_PYTHON:-}" && -x "$FOUNDRY_SKILL_PYTHON" ]]; then
    echo "$FOUNDRY_SKILL_PYTHON"
    return 0
  fi
  
  # 3. Check common Python locations
  for cmd in python3 python /opt/homebrew/bin/python3 /usr/local/bin/python3; do
    if command -v "$cmd" &>/dev/null; then
      echo "$cmd"
      return 0
    fi
  done
  
  return 1
}

# Setup venv if needed
setup_venv() {
  local python_cmd="$1"
  
  if [[ ! -d "$VENV_DIR" ]]; then
    echo "Creating Python venv at $VENV_DIR..." >&2
    "$python_cmd" -m venv "$VENV_DIR"
  fi
  
  # Check if dependencies are installed
  if ! "$VENV_DIR/bin/python" -c "import azure.ai.projects" 2>/dev/null; then
    echo "Installing dependencies..." >&2
    "$VENV_DIR/bin/pip" install -q azure-ai-projects azure-identity python-dotenv
  fi
  
  echo "$VENV_DIR/bin/python"
}

# Main
PYTHON_CMD=$(find_python) || {
  echo "❌ Python is not installed or not available in the environment." >&2
  echo "Please install Python 3.9+ and try again." >&2
  exit 1
}

# Ensure venv and dependencies
if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  PYTHON_CMD=$(setup_venv "$PYTHON_CMD")
fi

# Execute the Python script
exec "$PYTHON_CMD" "$SCRIPT_DIR/foundry_agent.py" "$@"
