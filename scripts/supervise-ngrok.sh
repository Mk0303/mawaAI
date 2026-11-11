#!/usr/bin/env bash
# Restart loop for the Mawa AI ngrok tunnel (public HTTPS -> 127.0.0.1:3210).
# Always uses Mani's config file. Never prints the authtoken or the env.
set -u
NGROK=/usr/local/bin/ngrok
CFG=/home/box/.config/ngrok/ngrok.yml
LOG=/workspace/mawa-ai-logs/ngrok.log
PIDFILE=/workspace/mawa-ai-logs/mawa-ngrok.pid
URLFILE=/workspace/mawa-ai-logs/ngrok-url.txt
mkdir -p "$(dirname "$LOG")"

if [[ -f "$PIDFILE" ]]; then
  old=$(cat "$PIDFILE" 2>/dev/null || true)
  if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
    echo "supervise-ngrok already running as pid $old" >&2
    exit 0
  fi
fi

echo $$ > "$PIDFILE"
exec >>"$LOG" 2>&1
echo "$(date -Iseconds) ngrok supervisor start pid=$$"

# Only pin a URL if a confirmed static dev domain was recorded in
# ngrok-url-pin.txt (one hostname, no ephemeral session URLs). Pinning a
# random *.ngrok-free.app name on the free plan fails with ERR_NGROK_313.
args=(http 127.0.0.1:3210 --config "$CFG" --log stdout --log-format logfmt --log-level info)
PINFILE=/workspace/mawa-ai-logs/ngrok-url-pin.txt
if [[ -f "$PINFILE" ]]; then
  url=$(tr -d '[:space:]' < "$PINFILE")
  case "$url" in
    https://*.ngrok-free.dev|https://*.ngrok-free.app)
      args+=(--url "$url")
      echo "$(date -Iseconds) pinning confirmed dev domain $url"
      ;;
  esac
fi

while true; do
  echo "$(date -Iseconds) starting ngrok http 127.0.0.1:3210"
  "$NGROK" "${args[@]}"
  code=$?
  echo "$(date -Iseconds) ngrok exited $code; restarting in 2s"
  sleep 2
done
