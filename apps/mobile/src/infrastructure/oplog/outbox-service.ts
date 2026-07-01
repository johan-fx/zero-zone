import type { LocalOperationDatabase } from '@/infrastructure/local-db/local-db';
import { createSignedOperation, type OperationInput, type OperationSigner, type SignedOperation } from '@/infrastructure/security/operation-signer';
import { materializeOperations, type MaterializedOperationViews } from './materializer';

export type AppendSignedOperationAndMaterializeInput = {
  database: LocalOperationDatabase;
  input: OperationInput;
  signer: OperationSigner;
};

export type AppendSignedOperationAndMaterializeResult = {
  operation: SignedOperation;
  views: MaterializedOperationViews;
};

export async function appendSignedOperationAndMaterialize({
  database,
  input,
  signer,
}: AppendSignedOperationAndMaterializeInput): Promise<AppendSignedOperationAndMaterializeResult> {
  const operation = await createSignedOperation(input, signer);

  await database.syncOps.upsert(operation);

  const operations = (await database.syncOps.findByIncident(operation.incidentId)).filter(isSignedOperation);
  const views = materializeOperations(operations);

  await persistMaterializedViews(database, views);

  return { operation, views };
}

export async function replaceMaterializedOperationViews(database: LocalOperationDatabase, incidentId: string, views: MaterializedOperationViews): Promise<void> {
  await Promise.all([
    database.views.incidents.removeByIncident(incidentId),
    database.views.workCenters.removeByIncident(incidentId),
    database.views.presence.removeByIncident(incidentId),
    database.views.resourceReports.removeByIncident(incidentId),
    database.views.dispatchEvents.removeByIncident(incidentId),
    database.views.sosSignals.removeByIncident(incidentId),
    database.views.localSummaries.removeByIncident(incidentId),
  ]);

  await persistMaterializedViews(database, views);
}

export async function persistMaterializedViews(database: LocalOperationDatabase, views: MaterializedOperationViews): Promise<void> {
  await Promise.all(views.incidents.map((incident) => database.views.incidents.upsert(incident)));

  for (const center of views.workCenters) {
    await database.views.workCenters.upsert(center);
  }

  await Promise.all(views.presence.map((presence) => database.views.presence.upsert(presence)));
  await Promise.all(views.resourceReports.map((report) => database.views.resourceReports.upsert(report)));
  await Promise.all(views.dispatchEvents.map((event) => database.views.dispatchEvents.upsert(event)));
  await Promise.all(views.sosSignals.map((signal) => database.views.sosSignals.upsert(signal)));
  await Promise.all(views.localSummaries.map((summary) => database.views.localSummaries.upsert({ ...summary, summaryId: `${summary.incidentId}:${summary.cellId}` })));
}

export function isSignedOperation(operation: unknown): operation is SignedOperation {
  return Boolean(operation && typeof operation === 'object' && 'opId' in operation && 'signature' in operation && 'entityType' in operation);
}
