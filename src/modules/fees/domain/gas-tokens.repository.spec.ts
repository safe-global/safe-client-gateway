// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { gasTokenBuilder } from '@/modules/fees/domain/entities/__tests__/gas-token.builder';
import type { GasToken } from '@/modules/fees/domain/entities/gas-token.entity';
import { GasTokensRepository } from '@/modules/fees/domain/gas-tokens.repository';
import { rawify } from '@/validation/entities/raw.entity';

const mockLoggingService = {
  error: vi.fn(),
} as MockedObject<ILoggingService>;
const mockConfigApi = {
  getGasTokens: vi.fn(),
} as MockedObject<IConfigApi>;

describe('GasTokensRepository', () => {
  let target: GasTokensRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new GasTokensRepository(mockLoggingService, mockConfigApi);
  });

  it('should return the gas tokens preserving the config order', async () => {
    const chainId = faker.string.numeric();
    const gasTokens = [
      gasTokenBuilder().build(),
      gasTokenBuilder().build(),
      gasTokenBuilder().build(),
    ];
    const page = pageBuilder<GasToken>()
      .with('results', gasTokens)
      .with('count', gasTokens.length)
      .build();
    mockConfigApi.getGasTokens.mockResolvedValue(rawify(page));

    const result = await target.getGasTokens({ chainId, limit: 20, offset: 0 });

    expect(result.results).toStrictEqual(gasTokens);
    expect(mockConfigApi.getGasTokens).toHaveBeenCalledTimes(1);
    expect(mockConfigApi.getGasTokens).toHaveBeenCalledWith(chainId, {
      limit: 20,
      offset: 0,
    });
    expect(mockLoggingService.error).not.toHaveBeenCalled();
  });

  it('should filter out invalid gas tokens and log an error', async () => {
    const chainId = faker.string.numeric();
    const valid = gasTokenBuilder().build();
    const invalid = { address: 'invalid', symbol: 123 };
    const page = pageBuilder<GasToken>()
      .with('results', [valid, invalid as unknown as GasToken])
      .with('count', 2)
      .build();
    mockConfigApi.getGasTokens.mockResolvedValue(rawify(page));

    const result = await target.getGasTokens({ chainId });

    expect(result.results).toStrictEqual([valid]);
    expect(mockConfigApi.getGasTokens).toHaveBeenCalledWith(chainId, {
      limit: undefined,
      offset: undefined,
    });
    expect(mockLoggingService.error).toHaveBeenCalledWith({
      message: 'Some gas tokens could not be parsed',
      errors: [invalid],
    });
  });
});
