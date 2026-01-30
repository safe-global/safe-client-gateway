import { campaignBuilder } from '@/modules/community/domain/entities/__tests__/campaign.builder';
import { CampaignSchema } from '@/modules/community/domain/entities/campaign.entity';
import { faker } from '@faker-js/faker';

describe('CampaignSchema', () => {
  it('should validate a valid campaign', () => {
    const campaign = campaignBuilder().build();

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success).toBe(true);
  });

  it.each(['startDate' as const, 'endDate' as const, 'lastUpdated' as const])(
    `should coerce %s to a date`,
    (field) => {
      const campaign = campaignBuilder()
        .with(field, faker.date.recent().toISOString() as unknown as Date)
        .build();

      const result = CampaignSchema.safeParse(campaign);

      expect(result.success && result.data[field]).toStrictEqual(
        new Date(campaign[field]!),
      );
    },
  );

  it.each([
    'lastUpdated' as const,
    'activitiesMetadata' as const,
    'rewardValue' as const,
    'rewardText' as const,
    'iconUrl' as const,
    'safeAppUrl' as const,
    'partnerUrl' as const,
  ])('should default %s to null', (key) => {
    const campaign = campaignBuilder().build();
    delete campaign[key];

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success && result.data[key]).toBe(null);
  });

  it.each(['iconUrl' as const, 'safeAppUrl' as const, 'partnerUrl' as const])(
    'should not validate a non-URL %s value',
    (key) => {
      const campaign = campaignBuilder()
        .with(key, faker.string.alphanumeric())
        .build();

      const result = CampaignSchema.safeParse(campaign);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          format: 'url',
          code: 'invalid_format',
          message: 'Invalid URL',
          path: [key],
        },
      ]);
    },
  );

  it('should not validate a non-numerical rewardValue', () => {
    const campaign = campaignBuilder()
      .with('rewardValue', faker.string.alpha())
      .build();

    const result = CampaignSchema.safeParse(campaign);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: ['rewardValue'],
      },
    ]);
  });

  it.each([
    'resourceId' as const,
    'name' as const,
    'description' as const,
    'startDate' as const,
    'endDate' as const,
    'isPromoted' as const,
  ])('should not validate a missing %s', (key) => {
    const campaign = campaignBuilder().build();
    delete campaign[key];

    const result = CampaignSchema.safeParse(campaign);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0].path).toStrictEqual([key]);
  });

  it('should not validate an invalid campaign', () => {
    const campaign = { invalid: 'campaign' };

    const result = CampaignSchema.safeParse(campaign);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['resourceId'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['name'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['description'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        path: ['startDate'],
        message: 'Invalid input: expected date, received Date',
        received: 'Invalid Date',
        expected: 'date',
      },
      {
        code: 'invalid_type',
        path: ['endDate'],
        message: 'Invalid input: expected date, received Date',
        received: 'Invalid Date',
        expected: 'date',
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        path: ['isPromoted'],
        message: 'Invalid input: expected boolean, received undefined',
      },
    ]);
  });
});
