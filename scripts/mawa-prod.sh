#!/usr/bin/env bash
# Control the production server and its ngrok tunnel.
# Usage: scripts/mawa-prod.sh start|stop|status|restart
set -u
ROOT=/workspace/mawa-ai
LOG=/workspace/mawa-ai-logs/prod.log
PIDFILE=/workspace/mawa-ai-logs/mawa-prod.pid
SUP="$ROOT/scripts/supervise-prod.sh"
NGROK_LOG=/workspace/mawa-ai-logs/ngrok.log
NGROK_PIDFILE=/workspace/mawa-ai-logs/mawa-ngrok.pid
NGROK_SUP="$ROOT/scripts/supervise-ngrok.sh"

is_alive() { [[ -n "${1:-}" ]] && kill -0 "$1" 2>/dev/null; }

stop_pidfile() {
  local file="$1"
  local pid=""
  [[ -f "$file" ]] && pid=$(cat "$file" 2>/dev/null || true)
  if is_alive "$pid"; then
    kill -TERM -- "-$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
    pkill -TERM -P "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      is_alive "$pid" || break
      sleep 0.3
    done
    if is_alive "$pid"; then
      kill -KILL -- "-$pid" 2>/dev/null || true
      kill -KILL "$pid" 2>/dev/null || true
      pkill -KILL -P "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$file"
}

status() {
  local pid=""
  [[ -f "$PIDFILE" ]] && pid=$(cat "$PIDFILE" 2>/dev/null || true)
  if is_alive "$pid"; then
    echo "supervisor running pid=$pid"
  else
    echo "supervisor not running"
  fi
  if ss -tlnp 2>/dev/null | grep -q ':3210'; then
    echo "port 3210 is listening"
    ss -tlnp 2>/dev/null | grep ':3210' || true
  else
    echo "port 3210 is free"
  fi
  local npid=""
  [[ -f "$NGROK_PIDFILE" ]] && npid=$(cat "$NGROK_PIDFILE" 2>/dev/null || true)
  if is_alive "$npid"; then
    echo "ngrok supervisor running pid=$npid"
  else
    echo "ngrok supervisor not running"
  fi
  if ss -tlnp 2>/dev/null | grep -q '127.0.0.1:4040'; then
    echo "ngrok agent API listening on 127.0.0.1:4040"
  else
    echo "ngrok agent API not listening"
  fi
}

stop_ngrok() {
  stop_pidfile "$NGROK_PIDFILE"
  # Only our ngrok (config path / 3210). Never touch other tunnels (e.g. cloudflared :8765).
  if command -v pgrep >/dev/null 2>&1; then
    pgrep -af '/usr/local/bin/ngrok http 127.0.0.1:3210' | grep -v pgrep | awk '{print $1}' | while read -r p; do
      kill -TERM "$p" 2>/dev/null || true
    done
  fi
  echo "ngrok stopped"
}

start_ngrok() {
  local pid=""
  [[ -f "$NGROK_PIDFILE" ]] && pid=$(cat "$NGROK_PIDFILE" 2>/dev/null || true)
  if is_alive "$pid"; then
    echo "ngrok already running pid=$pid"
    return 0
  fi
  mkdir -p "$(dirname "$NGROK_LOG")"
  setsid -f bash "$NGROK_SUP" >/dev/null 2>&1
  for _ in $(seq 1 40); do
    if ss -tlnp 2>/dev/null | grep -q '127.0.0.1:4040'; then
      echo "ngrok agent API is up"
      return 0
    fi
    sleep 0.5
  done
  echo "timed out waiting for ngrok agent API; last log lines:" >&2
  tail -n 40 "$NGROK_LOG" >&2 || true
  return 1
}

stop() {
  stop_ngrok
  local pid=""
  [[ -f "$PIDFILE" ]] && pid=$(cat "$PIDFILE" 2>/dev/null || true)
  if is_alive "$pid"; then
    # Kill the supervisor and its process group if possible, else its children.
    kill -TERM -- "-$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
    # Children (npm / next-server) may not share the group if not started with setsid.
    pkill -TERM -P "$pid" 2>/dev/null || true
    for i in 1 2 3 4 5; do
      is_alive "$pid" || break
      sleep 0.3
    done
    if is_alive "$pid"; then
      kill -KILL -- "-$pid" 2>/dev/null || true
      kill -KILL "$pid" 2>/dev/null || true
      pkill -KILL -P "$pid" 2>/dev/null || true
    fi
  fi
  # If anything is still bound to 3210 and is a next/npm process from this app, stop it.
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti :3210 | while read -r p; do
      cmd=$(ps -p "$p" -o args= 2>/dev/null || true)
      if [[ "$cmd" == *mawa-ai* || "$cmd" == *next-server* || "$cmd" == *"next start"* ]]; then
        kill -TERM "$p" 2>/dev/null || true
      fi
    done
  fi
  rm -f "$PIDFILE"
  echo "stopped"
}

start() {
  local pid=""
  [[ -f "$PIDFILE" ]] && pid=$(cat "$PIDFILE" 2>/dev/null || true)
  if is_alive "$pid"; then
    echo "already running pid=$pid"
    start_ngrok
    status
    return 0
  fi
  mkdir -p "$(dirname "$LOG")"
  # setsid so stop can signal the whole group. Inherited env has provider keys;
  # this script never prints the environment.
  setsid -f bash "$SUP" >/dev/null 2>&1
  # Wait until port is up (or supervisor wrote a crash line).
  for i in $(seq 1 60); do
    if ss -tlnp 2>/dev/null | grep -q ':3210'; then
      start_ngrok
      status
      return 0
    fi
    sleep 0.5
  done
  echo "timed out waiting for port 3210; last log lines:" >&2
  tail -n 40 "$LOG" >&2 || true
  return 1
}

cmd=${1:-status}
case "$cmd" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  restart) stop; start ;;
  start-ngrok) start_ngrok ;;
  stop-ngrok) stop_ngrok ;;
  *) echo "usage: $0 start|stop|status|restart|start-ngrok|stop-ngrok" >&2; exit 2 ;;
esac
