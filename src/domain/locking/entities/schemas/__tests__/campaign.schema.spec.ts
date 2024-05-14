import { campaignBuilder } from '@/domain/locking/entities/__tests__/campaign.builder';
import { CampaignSchema } from '@/domain/locking/entities/schemas/campaign.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('CampaignSchema', () => {
  it('should validate a valid campaign', () => {
    const campaign = campaignBuilder().build();

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success).toBe(true);
  });

  it('should coerce periodStart to a date', () => {
    const periodStart = faker.date.recent();
    const campaign = campaignBuilder()
      .with('periodStart', periodStart.toISOString() as unknown as Date)
      .build();

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success && result.data.periodStart).toBeInstanceOf(Date);
  });

  it('should coerce periodEnd to a date', () => {
    const periodEnd = faker.date.recent();
    const campaign = campaignBuilder()
      .with('periodEnd', periodEnd.toISOString() as unknown as Date)
      .build();

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success && result.data.periodEnd).toBeInstanceOf(Date);
  });

  it('should coerce lastUpdated to a date', () => {
    const lastUpdated = faker.date.recent();
    const campaign = campaignBuilder()
      .with('lastUpdated', lastUpdated.toISOString() as unknown as Date)
      .build();

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success && result.data.lastUpdated).toBeInstanceOf(Date);
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
          path: ['campaignId'],
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
          path: ['periodStart'],
          message: 'Invalid date',
        },
        {
          code: 'invalid_date',
          path: ['periodEnd'],
          message: 'Invalid date',
        },
        {
          code: 'invalid_date',
          path: ['lastUpdated'],
          message: 'Invalid date',
        },
      ]),
    );
  });
});
