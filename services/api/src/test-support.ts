import incidentMigration from '../migrations/0001_incidents.sql?raw';
import telegramConversationStateMigration from '../migrations/0002_telegram_conversation_states.sql?raw';
import incidentDemoSeed from '../seeds/incident-zc-demo.sql?raw';

export async function resetApiTestDatabase(db: D1Database): Promise<void> {
  await execSqlStatements(db, incidentMigration);
  await execSqlStatements(db, telegramConversationStateMigration);
  await execSqlStatements(
    db,
    `
    DELETE FROM telegram_conversation_states;
    DELETE FROM audit_events;
    DELETE FROM incident_memberships;
    DELETE FROM channel_identities;
    DELETE FROM incidents;
  `,
  );
  await execSqlStatements(db, incidentDemoSeed);
}

async function execSqlStatements(db: D1Database, sql: string): Promise<void> {
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.exec(`${statement.replace(/\s+/g, ' ')};`);
  }
}
