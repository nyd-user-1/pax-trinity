#!/usr/bin/env bash
# The local dev server on a leash (Brendan, 2026-10-30). The Mac has 8 GB and the dev server's memory
# grows until the machine freezes (next-server reached 9.33 GB). This runs the dev server and checks it
# every DEV_CHECK_SECONDS: when the server and everything it spawned pass DEV_MAX_MB, or macOS reports
# critical memory pressure while the server holds a real share of it, it stops the server and starts it
# again. A server that exits on its own (it does, after a next.config change) is started again too.
# Every restart is logged to DEV_WATCHDOG_LOG.
#
#   AWS_PROFILE=pax-new bash scripts/dev-watchdog.sh        (port 3000, 2,500 MB)
#   DEV_MAX_MB=2000 DEV_CLEAR_CACHE=1 bash scripts/dev-watchdog.sh
#
# DEV_CLEAR_CACHE=1 also empties .next/cache before each restart (slower first compile, smaller start).
# Stop it with Ctrl-C or by killing this script: it takes the server down with it.

set -u
PORT="${PORT:-3000}"
MAX_MB="${DEV_MAX_MB:-2500}"
CRITICAL_MIN_MB="${DEV_CRITICAL_MIN_MB:-800}"
CHECK="${DEV_CHECK_SECONDS:-10}"
LOG="${DEV_WATCHDOG_LOG:-/tmp/pax-dev-watchdog.log}"
cd "$(dirname "$0")/.." || exit 1

# Job control on: the server starts in its own process group, so a stop takes all of it.
set -m
CHILD=""

log() { echo "$(date '+%F %T') $*" | tee -a "$LOG"; }

# Resident memory of the server's process group, in MB.
group_mb() {
  ps -axo pgid=,rss= | awk -v g="$CHILD" '$1 == g { t += $2 } END { print int(t / 1024) }'
}

# macOS's pressure level: 1 normal, 2 warning, 4 critical.
pressure() { sysctl -n kern.memorystatus_vm_pressure_level 2>/dev/null || echo 1; }

start() {
  npx next dev -p "$PORT" &
  CHILD=$!
  log "started the dev server on :$PORT (process group $CHILD)"
}

stop() {
  [ -n "$CHILD" ] || return 0
  kill -TERM -- "-$CHILD" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$CHILD" 2>/dev/null || break
    sleep 1
  done
  kill -KILL -- "-$CHILD" 2>/dev/null
  wait "$CHILD" 2>/dev/null
  CHILD=""
}

trap 'log "watchdog stopped"; stop; exit 0' INT TERM

start
while sleep "$CHECK"; do
  if ! kill -0 "$CHILD" 2>/dev/null; then
    log "the dev server exited on its own; starting it again"
    wait "$CHILD" 2>/dev/null
    start
    continue
  fi
  mb=$(group_mb)
  level=$(pressure)
  if [ "$mb" -gt "$MAX_MB" ] || { [ "$level" -ge 4 ] && [ "$mb" -gt "$CRITICAL_MIN_MB" ]; }; then
    log "restarting: the dev server holds ${mb} MB (limit ${MAX_MB}), memory pressure level ${level}"
    stop
    [ "${DEV_CLEAR_CACHE:-0}" = "1" ] && rm -rf .next/cache && log "emptied .next/cache"
    start
  fi
done
