// SPDX-License-Identifier: FSL-1.1-MIT
import { nameBuilder } from '#/domain/common/entities/name.builder';
import { UpdateSpaceSchema } from '#/modules/spaces/routes/entities/update-space.dto.entity';

describe('UpdateSpaceSchema', () => {
  it('does not add experimentalFeatures when only the name is sent', () => {
    const result = UpdateSpaceSchema.parse({ name: nameBuilder() });

    expect(result).not.toHaveProperty('experimentalFeatures');
  });

  it('does not add experimentalFeatures to an empty body', () => {
    expect(UpdateSpaceSchema.parse({})).toStrictEqual({});
  });

  it('accepts and dedupes experimentalFeatures', () => {
    const result = UpdateSpaceSchema.parse({
      experimentalFeatures: ['recipientAllowlist', 'recipientAllowlist'],
    });

    expect(result).toStrictEqual({
      experimentalFeatures: ['recipientAllowlist'],
    });
  });

  it('accepts an empty array to opt out of everything', () => {
    expect(UpdateSpaceSchema.parse({ experimentalFeatures: [] })).toStrictEqual(
      { experimentalFeatures: [] },
    );
  });

  it('rejects an unknown feature', () => {
    expect(
      UpdateSpaceSchema.safeParse({ experimentalFeatures: ['notAFeature'] })
        .success,
    ).toBe(false);
  });
});
