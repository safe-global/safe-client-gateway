import {
  BridgeNames,
  BridgeNameSchema,
} from '@/modules/bridge/domain/entities/bridge-name.entity';
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_value',
        path: [],
        values: [...Object.values(BridgeNames)],
      }),
    ]);
  });
});
