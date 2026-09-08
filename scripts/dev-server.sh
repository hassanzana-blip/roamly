#!/usr/bin/env bash
# Vite dev server (HMR) with the demo env, detached. Usage: scripts/dev-server.sh start|stop|status  (port 5174)
PORT=${DEV_PORT:-5174}
export NODE_ENV=development APP_ENV=development SKIP_ENV_SAFETY=true
export DATABASE_URL="${DATABASE_URL:-mysql://root@localhost:3306/hellosky_it}" APP_BASE_URL="http://localhost:$PORT"
export DUFFEL_API_KEY= STRIPE_SECRET_KEY= STRIPE_PUBLISHABLE_KEY= LOG_LEVEL=warn
export PII_ENCRYPTION_KEY=$(node -e 'process.stdout.write(Buffer.alloc(32,9).toString("base64"))')
case "$1" in
  start)
    pkill -f "vite --port ${PORT}[ ]" 2>/dev/null; sleep 0.5
    setsid nohup npx vite --port "$PORT" --strictPort --host >/tmp/hs-dev.log 2>&1 < /dev/null &
    for _ in $(seq 1 40); do curl -sf -o /dev/null "http://localhost:$PORT/" && { echo "dev up on :$PORT"; exit 0; }; sleep 1; done
    echo "dev failed"; tail -20 /tmp/hs-dev.log; exit 1;;
  stop) pkill -f "vite --port ${PORT}[ ]" 2>/dev/null; echo stopped;;
  status) curl -sf -o /dev/null "http://localhost:$PORT/" && echo up || echo down;;
  *) echo "usage: $0 start|stop|status"; exit 2;;
esac
