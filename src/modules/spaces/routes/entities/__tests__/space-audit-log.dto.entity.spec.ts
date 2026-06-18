// SPDX-License-Identifier: FSL-1.1-MIT
import { SpaceAuditEventTypesQuerySchema } from '@/modules/spaces/routes/entities/space-audit-log.dto.entity';

describe('SpaceAuditEventTypesQuerySchema', () => {
  it('parses a comma-separated list of event types', () => {
    expect(
      SpaceAuditEventTypesQuerySchema.parse(
        'ADDRESS_BOOK_UPSERTED,ADDRESS_BOOK_DELETED',
      ),
    ).toStrictEqual(['ADDRESS_BOOK_UPSERTED', 'ADDRESS_BOOK_DELETED']);
  });

  it('treats an empty param like an omitted one', () => {
    expect(SpaceAuditEventTypesQuerySchema.parse('')).toStrictEqual([]);
    expect(SpaceAuditEventTypesQuerySchema.parse(undefined)).toBeUndefined();
  });

  it('rejects unknown event types', () => {
    const result = SpaceAuditEventTypesQuerySchema.safeParse('NOT_A_TYPE');
    expect(result.success).toBe(false);
  });
});
