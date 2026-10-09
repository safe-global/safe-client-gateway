// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { shutdownTracerProvider } from '#/tracing/trace-context';

/**
 * Flushes spans still buffered by the batch span processor before the process
 * exits. A no-op unless `src/tracing/tracing.ts` started tracing.
 */
@Injectable()
class TracingShutdownHook implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTracerProvider();
  }
}

@Module({ providers: [TracingShutdownHook] })
export class TracingModule {}
