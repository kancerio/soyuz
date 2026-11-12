#!/bin/bash
# Три localtunnel-туннеля с фиксированными поддоменами и автопереподключением.
# Поддомены first-come-first-served: URL стабильны, пока процесс жив.
# Запуск: bash scripts/lt-tunnels.sh start|stop|status
RUN="$(cd "$(dirname "$0")/.." && pwd)/scripts/.lt-tunnels"
mkdir -p "$RUN"

start_lt() { # $1=tag $2=port $3=subdomain
  (
    while true; do
      npx -y localtunnel --port "$2" --subdomain "$3" > "$RUN/$1.log" 2>&1
      echo "$(date '+%H:%M:%S') lt $1 lost, reconnecting" >> "$RUN/events.log"
      sleep 3
    done
  ) &
  echo $! > "$RUN/$1.pid"
}

case "$1" in
  stop)
    for t in fe api ai; do [ -f "$RUN/$t.pid" ] && kill "$(cat "$RUN/$t.pid")" 2>/dev/null; rm -f "$RUN/$t.pid"; done
    pkill -f "localtunnel" 2>/dev/null; echo stopped; exit 0 ;;
  status)
    for t in fe api ai; do echo "$t: $(grep -o 'https://[a-z0-9.-]*\.loca\.lt' "$RUN/$t.log" 2>/dev/null | head -1)"; done
    exit 0 ;;
  start)
    for t in fe api ai; do [ -f "$RUN/$t.pid" ] && kill "$(cat "$RUN/$t.pid")" 2>/dev/null; done ;;
  *) echo "usage: $0 start|stop|status"; exit 1 ;;
esac

start_lt fe 3000 soyuzmsg-kan
start_lt api 3001 soyuzmsg-api-kan
start_lt ai 8000 soyuzmsg-ai-kan
echo "lt tunnels starting (fe=api=ai subdomains: soyuzmsg-kan / soyuzmsg-api-kan / soyuzmsg-ai-kan)"
