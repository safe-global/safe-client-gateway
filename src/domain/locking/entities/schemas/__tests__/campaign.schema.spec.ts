import { campaignBuilder } from '@/domain/locking/entities/__tests__/campaign.builder';
import { CampaignSchema } from '@/domain/locking/entities/campaign.entity';
import { ZodError } from 'zod';

describe('CampaignSchema', () => {
  it('should validate a valid campaign', () => {
    const campaign = campaignBuilder().build();

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success).toBe(true);
  });

  it.each([
    'periodStart' as const,
    'periodEnd' as const,
    'lastUpdated' as const,
  ])(`should coerce %s to a date`, (field) => {
    const campaign = campaignBuilder().build();

    const result = CampaignSchema.safeParse(campaign);

    expect(result.success && result.data[field]).toStrictEqual(
      new Date(campaign[field]),
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
