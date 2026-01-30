import { campaignRankBuilder } from '@/modules/community/domain/entities/__tests__/campaign-rank.builder';
import { CampaignRankSchema } from '@/modules/community/domain/entities/campaign-rank.entity';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('CampaignRankSchema', () => {
  it('should validate a valid holder', () => {
    const campaignRank = campaignRankBuilder().build();

    const result = CampaignRankSchema.safeParse(campaignRank);

    expect(result.success).toBe(true);
  });

  it('should checksum the holder address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
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

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['holder'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        path: ['position'],
        message: 'Invalid input: expected number, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        path: ['boost'],
        message: 'Invalid input: expected number, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        path: ['totalPoints'],
        message: 'Invalid input: expected number, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        path: ['totalBoostedPoints'],
        message: 'Invalid input: expected number, received undefined',
      },
    ]);
  });
});
