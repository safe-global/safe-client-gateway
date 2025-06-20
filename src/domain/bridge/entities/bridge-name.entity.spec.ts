import {
  BridgeNames,
  BridgeNameSchema,
} from '@/domain/bridge/entities/bridge-name.entity';
import { faker } from '@faker-js/faker';

describe('BridgeStatusSchema', () => {
  it('should allow a valid bridge name', () => {
    const name = faker.helpers.arrayElement(BridgeNames);

    const result = BridgeNameSchema.safeParse(name);

    expect(result.success).toBe(true);
  });

  it('should not allow an unknown bridge name', () => {
    const name = faker.word.noun();

    const result = BridgeNameSchema.safeParse(name);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_enum_value',
        message: `Invalid enum value. Expected 'hop' | 'cbridge' | 'celercircle' | 'hyphen' | 'optimism' | 'polygon' | 'arbitrum' | 'avalanche' | 'across' | 'stargate' | 'gnosis' | 'omni' | 'amarok' | 'lifuel' | 'celerim' | 'symbiosis' | 'thorswap' | 'squid' | 'allbridge' | 'mayan', received '${name}'`,
        options: [
          'hop',
          'cbridge',
          'celercircle',
          'hyphen',
          'optimism',
          'polygon',
          'arbitrum',
          'avalanche',
          'across',
          'stargate',
          'gnosis',
          'omni',
          'amarok',
          'lifuel',
          'celerim',
          'symbiosis',
          'thorswap',
          'squid',
          'allbridge',
          'mayan',
        ],
        path: [],
        received: name,
      },
    ]);
  });
});
