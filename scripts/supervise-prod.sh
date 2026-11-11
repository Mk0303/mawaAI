#!/usr/bin/env bash
# Restart loop for the Mawa AI production server on this box.
# Does not start a public tunnel. Never prints the environment (it has secrets).
set -u
ROOT=/workspace/mawa-ai
LOG=/workspace/mawa-ai-logs/prod.log
PIDFILE=/workspace/mawa-ai-logs/mawa-prod.pid
mkdir -p "$(dirname "$LOG")"
cd "$ROOT"

if [[ -f "$PIDFILE" ]]; then
  old=$(cat "$PIDFILE" 2>/dev/null || true)
  if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
    echo "supervise-prod already running as pid $old" >&2
    exit 0
  fi
fi

echo $$ > "$PIDFILE"
# stdout/stderr of this supervisor and of next start go to the prod log only.
exec >>"$LOG" 2>&1
echo "$(date -Iseconds) supervisor start pid=$$ cwd=$ROOT"
while true; do
  echo "$(date -Iseconds) starting next start -p 3210"
  # npm start = next start -p 3210. NODE_ENV=production is set by next start;
  # we also set it so any pre-start code sees it.
  NODE_ENV=production npm start
  code=$?
  echo "$(date -Iseconds) next start exited $code; restarting in 2s"
  sleep 2
done
