// SPDX-License-Identifier: FSL-1.1-MIT
import {
  context,
  isSpanContextValid,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_FULL,
} from '@opentelemetry/semantic-conventions';

const tracer = trace.getTracer('safe-client-gateway');

/**
 * Lowest status an HTTP client span reports as an error (4xx and 5xx).
 * @see https://opentelemetry.io/docs/specs/semconv/http/http-spans/#status
 */
const MIN_ERROR_STATUS_CODE = 400;

const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 };

/**
 * Sends an outbound HTTP request inside an HTTP client span and propagates the
 * trace context to the upstream (`traceparent`). Bun's native `fetch` cannot be
 * patched by an instrumentation, so the network module traces its requests
 * through this instead.
 *
 * Outside a trace (and whenever tracing is disabled) `send` receives `init`
 * unchanged. The span ends once the response headers arrive.
 *
 * @param args.url - the request URL; only its origin and path are recorded,
 *   since query strings can carry upstream API keys
 * @param args.init - the request options, given back to `send` with the trace
 *   context headers added
 * @param send - performs the request
 */
export async function withHttpClientSpan(
  args: { url: URL; init: RequestInit },
  send: (init: RequestInit) => Promise<Response>,
): Promise<Response> {
  const method = args.init.method?.toUpperCase() ?? 'GET';
  const span = tracer.startSpan(method, {
    kind: SpanKind.CLIENT,
    attributes: {
      [ATTR_HTTP_REQUEST_METHOD]: method,
      [ATTR_URL_FULL]: `${args.url.origin}${args.url.pathname}`,
      [ATTR_SERVER_ADDRESS]: args.url.hostname,
      [ATTR_SERVER_PORT]:
        Number(args.url.port) || DEFAULT_PORTS[args.url.protocol],
    },
  });
  if (!isSpanContextValid(span.spanContext())) {
    span.end();
    return send(args.init);
  }

  const spanContext = trace.setSpan(context.active(), span);
  const headers = new Headers(args.init.headers);
  propagation.inject(spanContext, headers, {
    set: (carrier, key, value): void => carrier.set(key, value),
  });

  try {
    const response = await context.with(spanContext, () =>
      send({ ...args.init, headers }),
    );
    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);
    if (response.status >= MIN_ERROR_STATUS_CODE) {
      span.setAttribute(ATTR_ERROR_TYPE, String(response.status));
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    return response;
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    span.setAttribute(ATTR_ERROR_TYPE, name);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    span.end();
  }
}
