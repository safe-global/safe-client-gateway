import { FullAppDataSchema } from '@/domain/swaps/entities/full-app-data.entity';

describe('FullAppDataSchema', () => {
  it.each([
    '[]',
    '{}',
    'null',
    '{\n  "version": "0.1.0",\n  "appCode": "Yearn",\n  "metadata": {\n    "referrer": {\n      "version": "0.1.0",\n      "address": "0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52"\n    }\n  }\n}\n',
  ])('%s is valid', (fullAppData) => {
    const data = {
      fullAppData,
    };

    const result = FullAppDataSchema.safeParse(data);

    expect(result.success).toBe(true);
  });

  it.each(['a', 'a : b', '{', '['])('%s is not valid', (fullAppData) => {
    const data = {
      fullAppData,
    };

    const result = FullAppDataSchema.safeParse(data);

    expect(result.success).toBe(false);
  });
});
