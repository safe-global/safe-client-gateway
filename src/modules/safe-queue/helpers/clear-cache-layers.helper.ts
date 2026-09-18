// SPDX-License-Identifier: FSL-1.1-MIT
import type { ILoggingService } from '@/logging/logging.interface';

// The tx-service and queue caches are independent layers, so a failure in
// one must not skip invalidating the other. Best-effort: catch and log per
// layer instead of failing the whole call.
export async function clearBothCacheLayers(
  loggingService: ILoggingService,
  txServiceClear: Promise<void>,
  queueServiceClear: Promise<void>,
  context: string,
): Promise<void> {
  await Promise.all([
    txServiceClear.catch((error) => {
      loggingService.warn(
        `Failed to clear tx-service ${context}, error=${error}`,
      );
    }),
    queueServiceClear.catch((error) => {
      loggingService.warn(`Failed to clear queue ${context}, error=${error}`);
    }),
  ]);
}
