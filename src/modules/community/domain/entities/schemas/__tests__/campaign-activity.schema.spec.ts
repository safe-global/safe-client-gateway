import { campaignActivityBuilder } from '@/modules/community/domain/entities/__tests__/campaign-activity.builder';
import { CampaignActivitySchema } from '@/modules/community/domain/entities/campaign-activity.entity';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('CampaignActivitySchema', () => {
  it('should validate a valid CampaignActivity', () => {
    const campaignActivity = campaignActivityBuilder().build();

    const result = CampaignActivitySchema.safeParse(campaignActivity);

    expect(result.success).toBe(true);
  });

  it('should checksum the holder', () => {
    const campaignActivity = campaignActivityBuilder().build();
    campaignActivity.holder = campaignActivity.holder.toLowerCase() as Address;

    const result = CampaignActivitySchema.safeParse(campaignActivity);

    expect(result.success && result.data.holder).toBe(
      getAddress(campaignActivity.holder),
    );
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
      .with(field, faker.number.int().toString())
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
      .with(field, faker.number.float().toString())
      .build();

    const result = CampaignActivitySchema.safeParse(campaignActivity);

    expect(result.success).toBe(true);
  });

  it('should not validate an invalid CampaignActivity', () => {
    const campaignActivity = { invalid: 'campaignActivity' };

    const result = CampaignActivitySchema.safeParse(campaignActivity);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        path: ['startDate'],
        message: 'Invalid input: expected date, received Date',
        expected: 'date',
        received: 'Invalid Date',
      },
      {
        code: 'invalid_type',
        path: ['endDate'],
        message: 'Invalid input: expected date, received Date',
        expected: 'date',
        received: 'Invalid Date',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['holder'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['boost'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['totalPoints'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['totalBoostedPoints'],
        message: 'Invalid input: expected string, received undefined',
      },
    ]);
  });
});
