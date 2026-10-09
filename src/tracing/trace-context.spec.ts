// SPDX-License-Identifier: FSL-1.1-MIT
import { afterAll, beforeAll, describe, expect, it, jest } from 'bun:test';
import { faker } from '@faker-js/faker';
import { context, propagation, trace } from '@opentelemetry/api';
import { RPCType, setRPCMetadata } from '@opentelemetry/core';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  getDatadogTraceAttributes,
  setHttpServerRoute,
  setTracerProvider,
  shutdownTracerProvider,
} from '#/tracing/trace-context';

describe('trace-context', () => {
  const tracer = trace.getTracer('test');

  beforeAll(() => {
    new NodeTracerProvider().register();
  });

  afterAll(() => {
    trace.disable();
    context.disable();
    propagation.disable();
  });

  describe('getDatadogTraceAttributes', () => {
    it('returns nothing outside a trace', () => {
      expect(getDatadogTraceAttributes()).toBeUndefined();
    });

    it('returns the low 64 bits of the trace ID and the span ID as decimals', () => {
      tracer.startActiveSpan(faker.word.noun(), (span) => {
        const { traceId, spanId } = span.spanContext();

        expect(getDatadogTraceAttributes()).toStrictEqual({
          dd: {
            trace_id: BigInt(`0x${traceId.slice(16)}`).toString(),
            span_id: BigInt(`0x${spanId}`).toString(),
          },
        });
        span.end();
      });
    });
  });

  describe('setHttpServerRoute', () => {
    it('records the route on the HTTP server span metadata', () => {
      const route = `/v1/${faker.word.noun()}/:${faker.word.noun()}`;
      const rpcMetadata = {
        type: RPCType.HTTP as const,
        span: trace.wrapSpanContext({
          traceId: faker.string.hexadecimal({ length: 32, prefix: '' }),
          spanId: faker.string.hexadecimal({ length: 16, prefix: '' }),
          traceFlags: 1,
        }),
      };

      context.with(setRPCMetadata(context.active(), rpcMetadata), () => {
        setHttpServerRoute(route);
      });

      expect(rpcMetadata).toHaveProperty('route', route);
    });

    it('does nothing outside an HTTP server span', () => {
      expect(() => setHttpServerRoute(faker.word.noun())).not.toThrow();
    });
  });

  describe('shutdownTracerProvider', () => {
    it('shuts down the registered provider', async () => {
      const provider = { shutdown: jest.fn().mockResolvedValue(undefined) };
      setTracerProvider(provider);

      await shutdownTracerProvider();

      expect(provider.shutdown).toHaveBeenCalledTimes(1);
    });
  });
});
