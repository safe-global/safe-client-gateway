import { campaignRankBuilder } from '@/domain/community/entities/__tests__/campaign-rank.builder';
import { CampaignRankSchema } from '@/domain/community/entities/campaign-rank.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('CampaignRankSchema', () => {
  it('should validate a valid holder', () => {
    const campaignRank = campaignRankBuilder().build();

    const result = CampaignRankSchema.safeParse(campaignRank);

    expect(result.success).toBe(true);
  });

  it('should checksum the holder address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const campaignRank = campaignRankBuilder()
      .with('holder', nonChecksummedAddress)
      .build();

    const result = CampaignRankSchema.safeParse(campaignRank);

    expect(result.success && result.data.holder).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not validate an invalid holder', () => {
    const campaignRank = { invalid: 'campaignRank' };

    const result = CampaignRankSchema.safeParse(campaignRank);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['holder'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['position'],
          message: 'Required',
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
