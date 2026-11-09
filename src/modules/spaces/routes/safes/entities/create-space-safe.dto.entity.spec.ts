// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { spaceSafeBuilder } from '#/modules/spaces/datasources/safes/entities/__tests__/space-safes.entity.db.builder';
import { addressBookItemBuilder } from '#/modules/spaces/domain/address-books/entities/__tests__/address-book-item.db.builder';
import { CreateSpaceSafesSchema } from '#/modules/spaces/routes/safes/entities/create-space-safe.dto.entity';

describe('CreateSpaceSafesSchema', () => {
  it('should drop tags from addressBookItems, as only PUT /address-book sets them', () => {
    const { chainId, address } = spaceSafeBuilder().build();
    const { name, chainIds } = addressBookItemBuilder().build();

    const result = CreateSpaceSafesSchema.safeParse({
      safes: [{ chainId, address }],
      addressBookItems: [
        { name, address, chainIds, tags: [faker.string.alpha({ length: 8 })] },
      ],
    });

    expect(result.success && result.data.addressBookItems).toStrictEqual([
      { name, address, chainIds },
    ]);
  });
});
