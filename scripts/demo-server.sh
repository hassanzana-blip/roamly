#!/usr/bin/env bash
# Boot the built app + worker in demo mode (no Duffel/Stripe keys) against local MariaDB.
# Usage: scripts/demo-server.sh start|stop|status   (requires `npm run build` first)
PORT=${E2E_PORT:-3411}
export NODE_ENV=production APP_ENV=development FORCE_SERVE=true SKIP_ENV_SAFETY=true
export PORT DATABASE_URL="${DATABASE_URL:-mysql://root@localhost:3306/hellosky_it}" APP_BASE_URL="http://localhost:$PORT"
export DUFFEL_API_KEY= STRIPE_SECRET_KEY= STRIPE_PUBLISHABLE_KEY= LOG_LEVEL=warn
export PII_ENCRYPTION_KEY=$(node -e 'process.stdout.write(Buffer.alloc(32,9).toString("base64"))')
kill_old() {
  pkill -f '^node dist/boot\.js' 2>/dev/null
  pkill -f '^node dist/worker\.js' 2>/dev/null
}
case "$1" in
  start)
    kill_old; sleep 0.5
    nohup node dist/boot.js >/tmp/hs-web.log 2>&1 &
    FORCE_SERVE=false nohup node dist/worker.js >/tmp/hs-worker.log 2>&1 &
    for _ in $(seq 1 60); do
      if curl -sf "http://localhost:$PORT/healthz" >/dev/null; then echo "web up on :$PORT"; exit 0; fi
      sleep 1
    done
    echo "web failed to start"; tail -30 /tmp/hs-web.log; exit 1;;
  stop) kill_old; echo stopped;;
  status) curl -sf "http://localhost:$PORT/healthz" && echo && echo ok || echo down;;
  *) echo "usage: $0 start|stop|status"; exit 2;;
esac
