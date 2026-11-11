#!/usr/bin/env bash
# Keeps the user-space tailscaled (Funnel for Mawa AI) alive; restarts it if it dies or goes offline.
set -u
T="$HOME/bin/tailscale --socket=$HOME/.tailscale/tailscaled.sock"
LOG=/workspace/mawa-ai-logs/tailscaled.log
start() { cd "$HOME/.tailscale" && setsid nohup "$HOME/bin/tailscaled" --tun=userspace-networking --statedir="$HOME/.tailscale" --socket="$HOME/.tailscale/tailscaled.sock" >>"$LOG" 2>&1 & }
bad=0
while true; do
  if ! pgrep -f "bin/tailscaled --tun=userspace" >/dev/null; then echo "$(date -Iseconds) watchdog: starting tailscaled" >>"$LOG"; start; bad=0
  elif timeout 10 $T status 2>/dev/null | head -1 | grep -q offline; then bad=$((bad+1))
    if [ $bad -ge 3 ]; then echo "$(date -Iseconds) watchdog: offline, restarting" >>"$LOG"; pkill -f "bin/tailscaled --tun=userspace"; sleep 2; start; bad=0; fi
  else bad=0; fi
  sleep 30
done
