import { AccountsRepository } from '@/domain/accounts/accounts.repository';
import { createAccountDtoBuilder } from '@/domain/accounts/entities/__tests__/create-account.dto.builder';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { UnauthorizedException } from '@nestjs/common';

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
      const createAccountDto = createAccountDtoBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', createAccountDto.address)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);

      await expect(
        target.createAccount({
          authPayload,
          createAccountDto,
          clientIp: undefined,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
