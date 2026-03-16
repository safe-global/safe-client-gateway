// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Datadog APM tracer initialization.
 *
 * MUST be imported before all other modules in main.ts so that
 * dd-trace can monkey-patch libraries (pg, redis, amqplib, etc.)
 * before they are required.
 *
 * Configuration is handled via DD_* environment variables:
 *  - DD_TRACE_ENABLED: enable/disable tracing (default: false)
 *  - DD_ENV: environment tag (e.g., 'production', 'staging')
 *  - DD_SERVICE: service name (defaults to 'safe-client-nest')
 *  - DD_VERSION: version tag (falls back to APPLICATION_VERSION)
 *  - DD_AGENT_HOST: Datadog agent host (default: 'localhost')
 *  - DD_TRACE_SAMPLE_RATE: sampling rate 0.0–1.0 (default: 1.0)
 *  - DD_RUNTIME_METRICS_ENABLED: enable runtime metrics (default: true when tracing is enabled)
 *  - DD_DBM_PROPAGATION_MODE: database monitoring propagation mode
 *
 * @see https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/
 */
import tracer from 'dd-trace';

const isEnabled = process.env.DD_TRACE_ENABLED === 'true';

if (isEnabled) {
  tracer.init({
    service: process.env.DD_SERVICE || 'safe-client-nest',
    version: process.env.DD_VERSION || process.env.APPLICATION_VERSION,
    logInjection: true,
    runtimeMetrics: process.env.DD_RUNTIME_METRICS_ENABLED !== 'false',
  });
}

export default tracer;
