import incidentMigration from '../migrations/0001_incidents.sql?raw';
import telegramConversationStateMigration from '../migrations/0002_telegram_conversation_states.sql?raw';
import workCenterMigration from '../migrations/0003_work_centers.sql?raw';
import resourceLogisticsMigration from '../migrations/0004_resource_reports_dispatch.sql?raw';
import sosMigration from '../migrations/0005_sos_alerts.sql?raw';
import privateWebLinksMigration from '../migrations/0006_private_web_links.sql?raw';
import syncHardeningMigration from '../migrations/0007_sync_hardening.sql?raw';
import operationalObservabilityMigration from '../migrations/0008_operational_observability.sql?raw';
import channelIdentityPreferredLocaleMigration from '../migrations/0009_channel_identity_preferred_locale.sql?raw';
import incidentGeographyMigration from '../migrations/0010_incident_geography.sql?raw';
import operationalUpdatesMigration from '../migrations/0011_operational_updates.sql?raw';
import privateWebLinksOperationalScopeMigration from '../migrations/0012_private_web_links_operational_scope.sql?raw';
import resourceReportReporterTargetHashMigration from '../migrations/0013_resource_report_reporter_target_hash.sql?raw';
import proactiveUpdateOptoutsMigration from '../migrations/0014_proactive_update_optouts.sql?raw';
import incidentDemoSeed from '../seeds/incident-zc-demo.sql?raw';

export async function resetApiTestDatabase(db: D1Database): Promise<void> {
  await execSqlStatements(db, incidentMigration);
  await execSqlStatements(db, telegramConversationStateMigration);
  await execSqlStatements(db, workCenterMigration);
  await execSqlStatements(db, resourceLogisticsMigration);
  await execSqlStatements(db, sosMigration);
  await execSqlStatements(db, privateWebLinksMigration);
  await execSqlStatements(db, syncHardeningMigration);
  await execSqlStatements(db, operationalObservabilityMigration);
  await execSqlStatements(db, channelIdentityPreferredLocaleMigration);
  await execSqlStatements(db, incidentGeographyMigration);
  await execSqlStatements(db, operationalUpdatesMigration);
  await execSqlStatements(db, privateWebLinksOperationalScopeMigration);
  await execSqlStatements(db, resourceReportReporterTargetHashMigration);
  await execSqlStatements(db, proactiveUpdateOptoutsMigration);
  await execSqlStatements(
    db,
    `
    DELETE FROM proactive_update_optouts;
    DELETE FROM operational_update_delivery_attempts;
    DELETE FROM operational_update_actions;
    DELETE FROM operational_update_deliveries;
    DELETE FROM operational_update_audiences;
    DELETE FROM operational_updates;
    DELETE FROM sync_change_log;
    DELETE FROM rate_limit_buckets;
    DELETE FROM operational_audit_events;
    DELETE FROM private_web_link_attempts;
    DELETE FROM private_web_links;
    DELETE FROM critical_fanout_jobs;
    DELETE FROM sos_events;
    DELETE FROM sos_alerts;
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
    const normalized = `${statement.replace(/\s+/g, ' ')};`;
    try {
      await db.exec(normalized);
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate column name')) {
        const duplicateSafeColumns = ['preferred_locale', 'country_code', 'country_name', 'latitude', 'longitude', 'reporter_target_hash'];
        if (duplicateSafeColumns.some((column) => normalized.includes(`ADD COLUMN ${column} `))) {
          continue;
        }
      }
      throw error;
    }
  }
}
