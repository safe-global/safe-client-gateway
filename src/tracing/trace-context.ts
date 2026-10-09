// SPDX-License-Identifier: FSL-1.1-MIT
import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';

/**
 * Number of hex characters in the low 64 bits of a 128-bit trace ID.
 */
const DATADOG_TRACE_ID_HEX_LENGTH = 16;

/**
 * Datadog's log/trace correlation attributes for the active span, or
 * `undefined` outside a trace (and whenever tracing is disabled).
 *
 * Datadog joins a log line to its trace on `dd.trace_id`/`dd.span_id` as
 * unsigned 64-bit decimals; for OpenTelemetry's 128-bit trace IDs that is the
 * low 64 bits.
 * @see https://docs.datadoghq.com/tracing/other_telemetry/connect_logs_and_traces/opentelemetry/
 */
export function getDatadogTraceAttributes():
  | { dd: { trace_id: string; span_id: string } }
  | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!(spanContext && isSpanContextValid(spanContext))) {
    return undefined;
  }
  return {
    dd: {
      trace_id: BigInt(
        `0x${spanContext.traceId.slice(-DATADOG_TRACE_ID_HEX_LENGTH)}`,
      ).toString(),
      span_id: BigInt(`0x${spanContext.spanId}`).toString(),
    },
  };
}

/**
 * Records the matched route template (e.g. `/v1/chains/:chainId`) on the
 * active HTTP server span, which the HTTP instrumentation then uses for the
 * span name and `http.route`. Without it, every request would be named after
 * its method alone and Datadog could not group them per endpoint.
 */
export function setHttpServerRoute(route: string): void {
  const rpcMetadata = getRPCMetadata(context.active());
  if (rpcMetadata?.type === RPCType.HTTP) {
    rpcMetadata.route = route;
  }
}

/**
 * The SDK tracer provider `src/tracing/tracing.ts` registered, if any.
 */
let tracerProvider: { shutdown: () => Promise<void> } | undefined;

export function setTracerProvider(provider: {
  shutdown: () => Promise<void>;
}): void {
  tracerProvider = provider;
}

/**
 * Exports the spans still buffered and stops the tracer provider; a no-op when
 * tracing was not started.
 */
export async function shutdownTracerProvider(): Promise<void> {
  await tracerProvider?.shutdown();
}
