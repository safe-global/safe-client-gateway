// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * OpenTelemetry bootstrap, loaded with `bun --preload ./src/tracing/tracing.ts`
 * so the instrumented libraries are patched before the application imports
 * them. Traces are exported over OTLP/HTTP, by default to the node-local
 * Datadog Agent's OTLP receiver (see `tracing` in configuration.ts).
 *
 * This replaces dd-trace, which Datadog does not support on Bun. Verified on
 * Bun 1.4.2: the HTTP server (Fastify loads `node:http` with `require`, so the
 * HTTP instrumentation patches it), PostgreSQL (`pg`, used by TypeORM), Redis
 * (`redis`, and `ioredis` under BullMQ) and RabbitMQ (`amqplib`) produce spans
 * through the standard instrumentations. Bun's native `fetch` cannot be
 * patched, so outbound HTTP spans are created by the network module itself.
 */

import { IncomingMessage } from 'node:http';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import {
  defaultResource,
  detectResources,
  envDetector,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
} from '@opentelemetry/sdk-trace-node';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_URL_QUERY,
} from '@opentelemetry/semantic-conventions';
import configuration from '#/config/entities/configuration';
import { setTracerProvider } from '#/tracing/trace-context';

/**
 * Health probes run every few seconds per pod; tracing them only adds noise.
 */
const UNTRACED_PATHS = new Set(['/health/live', '/health/ready']);

/**
 * Keeps an incoming query string's parameter names but none of its values,
 * which can carry credentials (e.g. the OIDC callback's `code` and `state`).
 */
function redactQueryValues(query: string): string {
  return Array.from(
    new URLSearchParams(query).keys(),
    (key) => `${encodeURIComponent(key)}=REDACTED`,
  ).join('&');
}

const { tracing } = configuration();

if (tracing.enabled) {
  const provider = new NodeTracerProvider({
    // OTEL_SERVICE_NAME/OTEL_RESOURCE_ATTRIBUTES (envDetector) win over the
    // Datadog unified service tags.
    resource: defaultResource()
      .merge(
        resourceFromAttributes({
          [ATTR_SERVICE_NAME]: tracing.service,
          [ATTR_SERVICE_VERSION]: tracing.version,
          [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: tracing.env,
        }),
      )
      .merge(detectResources({ detectors: [envDetector] })),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: tracing.exporterUrl }),
      ),
    ],
  });

  setTracerProvider(provider);
  provider.register({
    propagator: new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
      ],
    }),
  });

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request): boolean =>
          UNTRACED_PATHS.has(request.url?.split('?')[0] ?? ''),
        requestHook: (span, request): void => {
          if (request instanceof IncomingMessage) {
            const query = request.url?.split('?')[1];
            if (query) {
              span.setAttribute(ATTR_URL_QUERY, redactQueryValues(query));
            }
          }
        },
      }),
      // Database and cache calls are traced within a request or job only:
      // standalone they are mostly the health probes' checks.
      new PgInstrumentation({ requireParentSpan: true }),
      new RedisInstrumentation({ requireParentSpan: true }),
      new IORedisInstrumentation({ requireParentSpan: true }),
      new AmqplibInstrumentation(),
    ],
  });
}
