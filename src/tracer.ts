// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Datadog APM tracer initialization.
 *
 * MUST be imported before all other modules in main.ts so that
 * dd-trace can monkey-patch libraries (pg, redis, amqplib, etc.)
 * before they are required.
 *
 * Note: This file reads process.env directly because it runs before
 * NestJS bootstraps. The same DD_* variables are also validated by
 * the Zod schema in configuration.schema.ts and exposed via
 * IConfigurationService under the 'datadog' key.
 *
 * @see https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
 */
import tracer from 'dd-trace';

const isEnabled = process.env.DD_TRACE_ENABLED === 'true';

if (isEnabled) {
  tracer.init({
    service: process.env.DD_SERVICE || 'safe-client-gateway',
    version: process.env.DD_VERSION || process.env.APPLICATION_VERSION,
    logInjection: true,
    runtimeMetrics: process.env.DD_RUNTIME_METRICS_ENABLED !== 'false',
  });
}

export default tracer;
