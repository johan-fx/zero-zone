interface Env {
  API_VERSION: string;
  BOT_TOKEN?: string;
  INCIDENT_CELL_OBJECTS: DurableObjectNamespace;
  DB: D1Database;
}
