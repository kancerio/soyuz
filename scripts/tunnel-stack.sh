#!/bin/bash
# Демо-стек Soyuz за serveo-туннелями с автопереподключением.
# Serveo выдаёт случайный URL при каждом переподключении — скрипт следит
# за URL и перезапускает backend/frontend с акту адресами.
#
# Запуск: bash scripts/tunnel-stack.sh start|stop|status|url
# Требует: postgres+redis локально, LM Studio на :1234 (для реального ИИ).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/scripts/.tunnel-stack"
SSH="ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes"

mkdir -p "$RUN"

tunnel_pid_file() { echo "$RUN/tunnel-$1.pid"; }
app_pid_file()    { echo "$RUN/$1.pid"; }

start_tunnel() { # $1=tag $2=local_port
  (
    while true; do
      $SSH -R 80:localhost:"$2" serveo.net > "$RUN/tunnel-$1.log" 2>&1
      echo "$(date '+%H:%M:%S') tunnel $1 lost, reconnecting" >> "$RUN/events.log"
      sleep 3
    done
  ) &
  echo $! > "$(tunnel_pid_file "$1")"
}

tunnel_url() { # $1=tag
  grep -o 'https://[a-z0-9.-]*serveousercontent\.com' "$RUN/tunnel-$1.log" 2>/dev/null | head -1
}

start_backend() { # $1=fe url
  (
    cd "$ROOT/backend"
    FRONTEND_URL="$1" nohup npm run start:prod > /tmp/backend.log 2>&1 &
    echo $! > "$(app_pid_file backend)"
  )
}

start_frontend() { # $1=api url $2=ai url
  (
    cd "$ROOT"
    NEXT_PUBLIC_API_URL="$1" NEXT_PUBLIC_SOCKET_URL="$1" NEXT_PUBLIC_AI_API_URL="$2" \
      nohup npm run dev > /tmp/frontend.log 2>&1 &
    echo $! > "$(app_pid_file frontend)"
  )
}

stop_pid_file() { # $1=pidfile
  [ -f "$1" ] && kill "$(cat "$1")" 2>/dev/null; rm -f "$1"
}

stop_all() {
  for t in fe api ai; do stop_pid_file "$(tunnel_pid_file "$t")"; done
  stop_pid_file "$(app_pid_file backend)"; stop_pid_file "$(app_pid_file frontend)"
  pkill -f 'serveo.net' 2>/dev/null
  echo stopped
}

case "$1" in
  stop) stop_all; exit 0 ;;
  status)
    for t in fe api ai; do echo "$t: $(tunnel_url "$t")"; done
    exit 0 ;;
  url) tunnel_url fe; exit 0 ;;
  start) stop_all ;;
  *) echo "usage: $0 start|stop|status|url"; exit 1 ;;
esac

echo "$(date '+%H:%M:%S') stack starting" >> "$RUN/events.log"
start_tunnel fe 3000
start_tunnel api 3001
start_tunnel ai 8000

# ждём первых URL
for i in $(seq 1 30); do
  FE=$(tunnel_url fe); API=$(tunnel_url api); AI=$(tunnel_url ai)
  [ -n "$FE" ] && [ -n "$API" ] && [ -n "$AI" ] && break
  sleep 2
done
echo "$(date '+%H:%M:%S') urls: fe=$FE api=$API ai=$AI" >> "$RUN/events.log"

pkill -f 'node dist/main' 2>/dev/null; pkill -f 'next dev' 2>/dev/null; sleep 2
start_backend "$FE"
start_frontend "$API" "$AI"

# мониторинг: при смене любого URL перезапускаем затронутые сервисы
while true; do
  sleep 20
  NFE=$(tunnel_url fe); NAPI=$(tunnel_url api); NAI=$(tunnel_url ai)
  [ -z "$NFE" ] || [ -z "$NAPI" ] || [ -z "$NAI" ] && continue

  if [ "$NFE" != "$FE" ]; then
    echo "$(date '+%H:%M:%S') fe url changed: $FE -> $NFE" >> "$RUN/events.log"
    FE="$NFE"
    pkill -f 'node dist/main' 2>/dev/null; sleep 2; start_backend "$FE"
  fi
  if [ "$NAPI" != "$API" ] || [ "$NAI" != "$AI" ]; then
    echo "$(date '+%H:%M:%S') api/ai url changed" >> "$RUN/events.log"
    API="$NAPI"; AI="$NAI"
    pkill -f 'next dev' 2>/dev/null; sleep 2; start_frontend "$API" "$AI"
  fi
done
