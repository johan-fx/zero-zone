import { OperationalEventSchema, type OperationalEvent } from '@zona-cero/contracts';

import type { ChannelTelemetryPort, TelegramTelemetryOptions, TelegramTelemetryScope } from './types';

const telemetryTerminalSteps = new Set(['joined', 'reported', 'updated', 'submitted', 'linked']);

export function emitChannelTelemetry(telemetry: ChannelTelemetryPort | undefined, event: OperationalEvent): void {
  if (!telemetry) return;

  const parsed = OperationalEventSchema.parse(event);
  void Promise.resolve()
    .then(() => telemetry.emit(parsed))
    .catch(() => undefined);
}

export function createTelegramTelemetryEvent(input: {
  scope: TelegramTelemetryScope;
  action: string;
  result: OperationalEvent['result'];
  errorCode?: OperationalEvent['errorCode'];
  latencyMs?: number;
}): OperationalEvent {
  return OperationalEventSchema.parse({
    event: input.scope === 'telegram.private_link' ? 'private_link.attempted' : 'operation.processed',
    category: input.scope === 'telegram.private_link' ? 'security' : 'sync',
    result: input.result,
    channel: 'telegram',
    scope: input.scope,
    action: input.action,
    errorCode: input.errorCode ?? null,
    ...(input.latencyMs === undefined ? {} : { latencyMs: input.latencyMs }),
    sampled: true,
  });
}

function resolveFlowTelemetryResult(previousStep: string, nextStep: string, responseText: string): Pick<OperationalEvent, 'result' | 'errorCode'> {
  if (nextStep === 'cancelled') return { result: 'bypassed', errorCode: null };
  if (telemetryTerminalSteps.has(nextStep)) return { result: 'accepted', errorCode: null };
  if (/rate[_ -]?limited/i.test(responseText)) return { result: 'rejected', errorCode: 'rate_limited' };
  if (/security challenge/i.test(responseText)) return { result: 'rejected', errorCode: 'security_challenge_required' };
  if (/turnstile/i.test(responseText)) return { result: 'rejected', errorCode: 'turnstile_failed' };
  if (/expired/i.test(responseText)) return { result: 'rejected', errorCode: 'link_expired' };
  if (/permission denied|not found|invalid|could not|rejected|failed/i.test(responseText)) return { result: 'rejected', errorCode: null };
  return previousStep === nextStep ? { result: 'bypassed', errorCode: null } : { result: 'accepted', errorCode: null };
}

function emitTelegramFlowTelemetry(
  options: TelegramTelemetryOptions | undefined,
  scope: TelegramTelemetryScope,
  previousStep: string,
  nextStep: string,
  responseText: string,
  startedAt: number,
): void {
  const result = resolveFlowTelemetryResult(previousStep, nextStep, responseText);
  emitChannelTelemetry(
    options?.telemetry,
    createTelegramTelemetryEvent({
      scope,
      action: `${previousStep}->${nextStep}`,
      result: result.result,
      errorCode: result.errorCode,
      latencyMs: Date.now() - startedAt,
    }),
  );
}

export async function withTelegramFlowTelemetry<TResult extends { state: { step: string }; responseText: string }>(
  options: TelegramTelemetryOptions | undefined,
  scope: TelegramTelemetryScope,
  previousStep: string,
  startedAt: number,
  run: () => Promise<{ state: { step: string }; responseText: string }>,
): Promise<TResult> {
  try {
    const result = await run();
    emitTelegramFlowTelemetry(options, scope, previousStep, result.state.step, result.responseText, startedAt);
    return result as TResult;
  } catch (error) {
    emitChannelTelemetry(
      options?.telemetry,
      createTelegramTelemetryEvent({
        scope,
        action: `${previousStep}->throw`,
        result: 'rejected',
        latencyMs: Date.now() - startedAt,
      }),
    );
    throw error;
  }
}
