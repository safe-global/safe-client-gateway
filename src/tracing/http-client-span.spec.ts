// SPDX-License-Identifier: FSL-1.1-MIT
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from 'bun:test';
import { faker } from '@faker-js/faker';
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { withHttpClientSpan } from '#/tracing/http-client-span';

describe('withHttpClientSpan', () => {
  const url = (): URL =>
    new URL(
      `${faker.internet.url({ appendSlash: false })}/${faker.word.noun()}?apiKey=${faker.string.alphanumeric(16)}`,
    );

  describe('without a tracer provider', () => {
    it('sends the request options unchanged', async () => {
      const init: RequestInit = {
        method: 'POST',
        headers: { [faker.word.noun()]: faker.word.noun() },
      };
      const response = new Response(null, { status: 204 });
      const send = jest.fn().mockResolvedValue(response);

      await expect(
        withHttpClientSpan({ url: url(), init }, send),
      ).resolves.toBe(response);

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(init);
    });
  });

  describe('with a tracer provider', () => {
    const exporter = new InMemorySpanExporter();
    const tracer = trace.getTracer('test');

    beforeAll(() => {
      new NodeTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      }).register();
    });

    afterEach(() => {
      exporter.reset();
    });

    afterAll(() => {
      trace.disable();
      context.disable();
      propagation.disable();
    });

    it('records a client span and propagates its context to the upstream', async () => {
      const requestUrl = url();
      const headerName = faker.word.noun().toLowerCase();
      const headerValue = faker.word.noun();
      let sentHeaders = new Headers();
      const send = jest.fn((init: RequestInit) => {
        sentHeaders = new Headers(init.headers);
        return Promise.resolve(new Response(null, { status: 200 }));
      });

      await tracer.startActiveSpan('parent', async (parent) => {
        await withHttpClientSpan(
          {
            url: requestUrl,
            init: { headers: { [headerName]: headerValue } },
          },
          send,
        );
        parent.end();
      });

      const [span] = exporter
        .getFinishedSpans()
        .filter((s) => s.kind === SpanKind.CLIENT);
      expect(span.name).toBe('GET');
      expect(span.attributes).toStrictEqual({
        'http.request.method': 'GET',
        // The query string, which can carry API keys, is not recorded.
        'url.full': `${requestUrl.origin}${requestUrl.pathname}`,
        'server.address': requestUrl.hostname,
        'server.port': Number(requestUrl.port) || 443,
        'http.response.status_code': 200,
      });
      expect(span.status.code).toBe(SpanStatusCode.UNSET);
      expect(sentHeaders.get(headerName)).toBe(headerValue);
      expect(sentHeaders.get('traceparent')).toBe(
        `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`,
      );
    });

    it('marks an error response as a failed span', async () => {
      const status = faker.helpers.arrayElement([400, 404, 500, 503]);
      const send = jest.fn().mockResolvedValue(new Response(null, { status }));

      await tracer.startActiveSpan('parent', async (parent) => {
        await withHttpClientSpan({ url: url(), init: {} }, send);
        parent.end();
      });

      const [span] = exporter
        .getFinishedSpans()
        .filter((s) => s.kind === SpanKind.CLIENT);
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.attributes['http.response.status_code']).toBe(status);
      expect(span.attributes['error.type']).toBe(String(status));
    });

    it('marks a failed request as a failed span and rethrows', async () => {
      const error = new TypeError(faker.lorem.sentence());
      const send = jest.fn().mockRejectedValue(error);

      await tracer.startActiveSpan('parent', async (parent) => {
        await expect(
          withHttpClientSpan({ url: url(), init: {} }, send),
        ).rejects.toBe(error);
        parent.end();
      });

      const [span] = exporter
        .getFinishedSpans()
        .filter((s) => s.kind === SpanKind.CLIENT);
      expect(span.status).toStrictEqual({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      expect(span.attributes['error.type']).toBe('TypeError');
    });
  });
});
