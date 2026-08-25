// SPDX-License-Identifier: FSL-1.1-MIT
import { QuotaExceededExceptionFilter } from '@/modules/entitlements/domain/exception-filters/quota-exceeded.exception-filter';
import { SafeSeatsGuard } from '@/modules/entitlements/routes/guards/safe-seats.guard';
import { SpaceSafesController } from '@/modules/spaces/routes/safes/space-safes.controller';

/** Nest's metadata keys as literals, like `check-guard.ts` uses. */
const GUARDS_METADATA = '__guards__';
const EXCEPTION_FILTERS_METADATA = '__exceptionFilters__';

/**
 * `checkGuardIsApplied` cannot serve here: it asserts *every* guard on the
 * route equals the expected one, so it fails on a route carrying two.
 */
function appliedNames(
  metadataKey: string,
  handler: (...args: Array<never>) => unknown,
): Array<string> {
  const enhancers: Array<{ name: string }> =
    Reflect.getMetadata(metadataKey, handler) ?? [];
  return enhancers.map((enhancer) => enhancer.name);
}

describe('SpaceSafesController', () => {
  describe('POST /v1/spaces/:spaceId/safes', () => {
    it('gates the route on the Safe seat quota', () => {
      expect(
        appliedNames(GUARDS_METADATA, SpaceSafesController.prototype.create),
      ).toContain(SafeSeatsGuard.name);
    });

    it('answers a quota rejection with its typed body', () => {
      expect(
        appliedNames(
          EXCEPTION_FILTERS_METADATA,
          SpaceSafesController.prototype.create,
        ),
      ).toContain(QuotaExceededExceptionFilter.name);
    });
  });

  // A plan limit only ever blocks taking a seat, never reading or freeing one.
  it.each([
    ['GET', SpaceSafesController.prototype.get],
    ['DELETE', SpaceSafesController.prototype.delete],
  ] as const)('does not gate %s on the seat quota', (_method, handler) => {
    expect(appliedNames(GUARDS_METADATA, handler)).not.toContain(
      SafeSeatsGuard.name,
    );
  });
});
