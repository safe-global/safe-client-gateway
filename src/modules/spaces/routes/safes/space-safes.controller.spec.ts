// SPDX-License-Identifier: FSL-1.1-MIT
import { QuotaExceededExceptionFilter } from '@/modules/entitlements/domain/exception-filters/quota-exceeded.exception-filter';
import { SpaceSafesController } from '@/modules/spaces/routes/safes/space-safes.controller';

/** Nest's metadata key as a literal, like `check-guard.ts` uses. */
const EXCEPTION_FILTERS_METADATA = '__exceptionFilters__';

function filterNames(
  handler: (...args: Array<never>) => unknown,
): Array<string> {
  const filters: Array<{ name: string }> =
    Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, handler) ?? [];
  return filters.map((filter) => filter.name);
}

describe('SpaceSafesController', () => {
  /**
   * The seat verdict is the write path's own, taken under its lock: what the
   * payload consumes depends on which of its addresses the Workspace already
   * holds, and no route-level guard can know that. All the route declares is
   * how the rejection is rendered.
   */
  describe('POST /v1/spaces/:spaceId/safes', () => {
    it('answers a quota rejection with its typed body', () => {
      expect(filterNames(SpaceSafesController.prototype.create)).toContain(
        QuotaExceededExceptionFilter.name,
      );
    });
  });
});
