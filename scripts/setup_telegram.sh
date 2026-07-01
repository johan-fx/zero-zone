set +x

read -rsp "Telegram bot token: " TELEGRAM_BOT_TOKEN; echo
read -rsp "Telegram webhook secret token: " TELEGRAM_WEBHOOK_SECRET_TOKEN; echo

curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://zona-cero-api-staging.jauss.workers.dev/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET_TOKEN}"

curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"

unset TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET_TOKEN
