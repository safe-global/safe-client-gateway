import { campaignBuilder } from '@/domain/community/entities/__tests__/campaign.builder';
import { CampaignSchema } from '@/domain/community/entities/campaign.entity';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('CampaignSchema', () => {
  it('should validate a valid campaign', () => {
    const campaign = campaignBuilder().build();

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success).toBe(true);
  });

  it.each(['startDate' as const, 'endDate' as const])(
    `should coerce %s to a date`,
    (field) => {
      const campaign = campaignBuilder()
        .with(field, faker.date.recent().toISOString() as unknown as Date)
        .build();

      const result = CampaignSchema.safeParse(campaign);

      expect(result.success && result.data[field]).toStrictEqual(
        new Date(campaign[field]),
      );
    },
  );

  it('should default lastUpdated to null', () => {
    const campaign = campaignBuilder()
      .with('lastUpdated', faker.date.recent())
      .build();
    // @ts-expect-error - inferred types don't allow optional fields
    delete campaign.lastUpdated;

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success && result.data.lastUpdated).toBe(null);
  });

  it('should coerce lastUpdated to a date', () => {
    const lastUpdated = faker.date.recent().toISOString();
    const campaign = campaignBuilder()
      .with('lastUpdated', lastUpdated as unknown as Date)
      .build();

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success && result.data.lastUpdated).toStrictEqual(
      new Date(lastUpdated),
    );
  });

  it('should not validate an invalid campaign', () => {
    const campaign = { invalid: 'campaign' };

    const result = CampaignSchema.safeParse(campaign);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['resourceId'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['name'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['description'],
          message: 'Required',
        },
        {
          code: 'invalid_date',
          path: ['startDate'],
          message: 'Invalid date',
        },
        {
          code: 'invalid_date',
          path: ['endDate'],
          message: 'Invalid date',
        },
      ]),
    );
  });
});
