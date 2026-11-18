// SPDX-License-Identifier: FSL-1.1-MIT
import type { ILoggingService } from '#/logging/logging.interface';

// The tx-service and queue caches are independent layers, so a failure in
// one must not skip invalidating the other. Best-effort: catch and log per
// layer instead of failing the whole call, and resolve to whether both were
// cleared.
export async function clearBothCacheLayers(
  loggingService: ILoggingService,
  txServiceClear: Promise<void>,
  queueServiceClear: Promise<void>,
  context: string,
): Promise<boolean> {
  const cleared = await Promise.all([
    txServiceClear.then(
      () => true,
      (error) => {
        loggingService.warn(
          `Failed to clear tx-service ${context}, error=${error}`,
        );
        return false;
      },
    ),
    queueServiceClear.then(
      () => true,
      (error) => {
        loggingService.warn(`Failed to clear queue ${context}, error=${error}`);
        return false;
      },
    ),
  ]);
  return cleared.every(Boolean);
}
