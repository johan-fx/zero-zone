import incidentMigration from '../migrations/0001_incidents.sql?raw';
import telegramConversationStateMigration from '../migrations/0002_telegram_conversation_states.sql?raw';
import workCenterMigration from '../migrations/0003_work_centers.sql?raw';
import resourceLogisticsMigration from '../migrations/0004_resource_reports_dispatch.sql?raw';
import incidentDemoSeed from '../seeds/incident-zc-demo.sql?raw';

export async function resetApiTestDatabase(db: D1Database): Promise<void> {
  await execSqlStatements(db, incidentMigration);
  await execSqlStatements(db, telegramConversationStateMigration);
  await execSqlStatements(db, workCenterMigration);
  await execSqlStatements(db, resourceLogisticsMigration);
  await execSqlStatements(
    db,
    `
    DELETE FROM dispatch_events;
    DELETE FROM dispatch_tasks;
    DELETE FROM resource_reports;
    DELETE FROM sync_operations;
    DELETE FROM work_center_signals;
    DELETE FROM work_centers;
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
