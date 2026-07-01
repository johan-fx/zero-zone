interface Env {
  API_VERSION: string;
  BOT_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_ROLLOUT?: 'off' | 'observe' | 'enforce';
  TELEGRAM_INTENT_ROUTER_ENABLED?: string;
  TELEGRAM_INTENT_MODEL?: string;
  TELEGRAM_INTENT_CONFIDENCE_THRESHOLD?: string;
  AI: Ai;
  INCIDENT_CELL_OBJECTS: DurableObjectNamespace;
  DB: D1Database;
}
