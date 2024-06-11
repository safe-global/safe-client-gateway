import { campaignPointsBuilder } from '@/domain/community/entities/__tests__/campaign-points.builder';
import { CampaignPointsSchema } from '@/domain/community/entities/campaign-points.entity';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('CampaignPointsSchema', () => {
  it('should validate a valid CampaignPoints', () => {
    const campaignPoints = campaignPointsBuilder().build();

    const result = CampaignPointsSchema.safeParse(campaignPoints);

    expect(result.success).toBe(true);
  });

  it.each(['startDate' as const, 'endDate' as const])(
    `should coerce %s to a Date`,
    (field) => {
      const campaignPoints = campaignPointsBuilder()
        .with(field, faker.date.recent().toISOString() as unknown as Date)
        .build();

      const result = CampaignPointsSchema.safeParse(campaignPoints);

      expect(result.success && result.data[field]).toBeInstanceOf(Date);
    },
  );

  it.each([
    'boost' as const,
    'totalPoints' as const,
    'totalBoostedPoints' as const,
  ])(`should validate a decimal %s`, (field) => {
    const campaignPoints = campaignPointsBuilder()
      .with(field, faker.number.float())
      .build();

    const result = CampaignPointsSchema.safeParse(campaignPoints);

    expect(result.success).toBe(true);
  });

  it.each([
    'boost' as const,
    'totalPoints' as const,
    'totalBoostedPoints' as const,
  ])(`should validate a float %s`, (field) => {
    const campaignPoints = campaignPointsBuilder()
      .with(field, faker.number.float())
      .build();

    const result = CampaignPointsSchema.safeParse(campaignPoints);

    expect(result.success).toBe(true);
  });

  it('should not validate an invalid CampaignPoints', () => {
    const campaignPoints = { invalid: 'campaignPoints' };

    const result = CampaignPointsSchema.safeParse(campaignPoints);

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
