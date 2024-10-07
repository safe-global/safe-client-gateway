import { AccountsRepository } from '@/domain/accounts/accounts.repository';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { faker } from '@faker-js/faker/.';
import { UnauthorizedException } from '@nestjs/common';
import { getAddress } from 'viem';

const mockAccountsDatasource = {
  createAccount: jest.fn(),
} as jest.MockedObjectDeep<IAccountsDatasource>;

describe('AccountsRepository', () => {
  let target: AccountsRepository;

  beforeEach(() => {
    jest.resetAllMocks();

    target = new AccountsRepository(mockAccountsDatasource);
  });

  /**
   * This is tested here instead of the controller as it is currently
   * not possible to remove the IP from a request in supertest.
   */
  describe('createAccount', () => {
    it('should throw an UnauthorizedException if there is no IP present in the request', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);

      await expect(
        target.createAccount({
          authPayload,
          address: signerAddress,
          clientIp: undefined,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
