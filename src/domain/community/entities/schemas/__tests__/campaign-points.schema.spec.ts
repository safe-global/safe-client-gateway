import { campaignActivityBuilder } from '@/domain/community/entities/__tests__/campaign-points.builder';
import { CampaignActivitySchema } from '@/domain/community/entities/campaign-activity.entity';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('CampaignActivitySchema', () => {
  it('should validate a valid CampaignActivity', () => {
    const campaignActivity = campaignActivityBuilder().build();

    const result = CampaignActivitySchema.safeParse(campaignActivity);

    expect(result.success).toBe(true);
  });

  it.each(['startDate' as const, 'endDate' as const])(
    `should coerce %s to a Date`,
    (field) => {
      const campaignActivity = campaignActivityBuilder()
        .with(field, faker.date.recent().toISOString() as unknown as Date)
        .build();

      const result = CampaignActivitySchema.safeParse(campaignActivity);

      expect(result.success && result.data[field]).toBeInstanceOf(Date);
    },
  );

  it.each([
    'boost' as const,
    'totalPoints' as const,
    'totalBoostedPoints' as const,
  ])(`should validate a decimal %s`, (field) => {
    const campaignActivity = campaignActivityBuilder()
      .with(field, faker.number.float())
      .build();

    const result = CampaignActivitySchema.safeParse(campaignActivity);

    expect(result.success).toBe(true);
  });

  it.each([
    'boost' as const,
    'totalPoints' as const,
    'totalBoostedPoints' as const,
  ])(`should validate a float %s`, (field) => {
    const campaignActivity = campaignActivityBuilder()
      .with(field, faker.number.float())
      .build();

    const result = CampaignActivitySchema.safeParse(campaignActivity);

    expect(result.success).toBe(true);
  });

  it('should not validate an invalid CampaignActivity', () => {
    const campaignActivity = { invalid: 'campaignActivity' };

    const result = CampaignActivitySchema.safeParse(campaignActivity);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
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
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['boost'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['totalPoints'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['totalBoostedPoints'],
          message: 'Required',
        },
      ]),
    );
  });
});
