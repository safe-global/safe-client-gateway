// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { DataSourceError } from '@/domain/errors/data-source.error';
import {
  erc20TokenBuilder,
  nativeTokenBuilder,
} from '@/modules/tokens/domain/__tests__/token.builder';
import type { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';
import { TokensService } from '@/modules/tokens/routes/tokens.service';

const tokenRepository = {
  getToken: vi.fn(),
  getTokens: vi.fn(),
} as MockedObject<ITokenRepository>;

describe('TokensService', () => {
  const chainId = faker.string.numeric();
  const service = new TokensService(tokenRepository);

  describe('getToken', () => {
    it('delegates to the repository with the same arguments', async () => {
      const token = erc20TokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      await expect(
        service.getToken({ chainId, address: token.address }),
      ).resolves.toStrictEqual(token);
      expect(tokenRepository.getToken).toHaveBeenCalledWith({
        chainId,
        address: token.address,
      });
    });
  });

  describe('getTokens', () => {
    it('returns the tokens in request order', async () => {
      const first = nativeTokenBuilder().build();
      const second = erc20TokenBuilder().build();
      tokenRepository.getToken.mockImplementation(({ address }) =>
        Promise.resolve(address === first.address ? first : second),
      );

      const result = await service.getTokens({
        chainId,
        addresses: [first.address, second.address],
      });

      expect(result).toStrictEqual([first, second]);
    });

    it('skips an address the Transaction Service does not know (404)', async () => {
      const known = erc20TokenBuilder().build();
      const unknown = getAddress(faker.finance.ethereumAddress());
      tokenRepository.getToken.mockImplementation(({ address }) =>
        address === unknown
          ? Promise.reject(
              new DataSourceError('Not found', HttpStatus.NOT_FOUND),
            )
          : Promise.resolve(known),
      );

      const result = await service.getTokens({
        chainId,
        addresses: [unknown, known.address],
      });

      expect(result).toStrictEqual([known]);
    });

    it('returns an empty list when every address is unknown', async () => {
      tokenRepository.getToken.mockRejectedValue(
        new DataSourceError('Not found', HttpStatus.NOT_FOUND),
      );

      await expect(
        service.getTokens({
          chainId,
          addresses: [getAddress(faker.finance.ethereumAddress())],
        }),
      ).resolves.toStrictEqual([]);
    });

    it('propagates the first non-404 failure', async () => {
      const token = erc20TokenBuilder().build();
      const failing = getAddress(faker.finance.ethereumAddress());
      const error = new DataSourceError(
        'Service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      tokenRepository.getToken.mockImplementation(({ address }) =>
        address === failing ? Promise.reject(error) : Promise.resolve(token),
      );

      await expect(
        service.getTokens({ chainId, addresses: [token.address, failing] }),
      ).rejects.toBe(error);
    });

    it('propagates a non-DataSourceError failure as an Error', async () => {
      tokenRepository.getToken.mockRejectedValue(new Error('boom'));

      await expect(
        service.getTokens({
          chainId,
          addresses: [getAddress(faker.finance.ethereumAddress())],
        }),
      ).rejects.toThrow('boom');
    });

    it('collapses case-insensitive duplicates and looks each address up once', async () => {
      const token = erc20TokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      const result = await service.getTokens({
        chainId,
        addresses: [
          token.address,
          token.address.toLowerCase() as typeof token.address,
          token.address,
        ],
      });

      expect(result).toStrictEqual([token]);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
    });
  });
});
