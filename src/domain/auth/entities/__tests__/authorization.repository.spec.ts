import { AuthorizationRepository } from '@/domain/auth/authorization.repository';
import { authPayloadBuilder } from '@/domain/auth/entities/__tests__/auth-payload.entity.builder';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { getAddress } from 'viem';

const safeRepository = {
  isOwner: jest.fn(),
} as jest.MockedObjectDeep<ISafeRepository>;
const safeRepositoryMocked = jest.mocked(safeRepository);

describe('AuthorizationRepository', () => {
  let target: AuthorizationRepository;

  beforeEach(async () => {
    jest.resetAllMocks();
    target = new AuthorizationRepository(safeRepositoryMocked);
  });

  describe('assertChainAndSigner', () => {
    it('should not throw if the chainId and signerAddress match that of the AuthPayload', () => {
      const chainId = faker.string.numeric();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const authPayload = authPayloadBuilder()
        .with('chain_id', chainId)
        .with('signer_address', signerAddress)
        .build();

      expect(() =>
        target.assertChainAndSigner({
          chainId,
          signerAddress,
          authPayload,
        }),
      ).not.toThrow();
    });

    it('should throw if there is no AuthPayload provided', () => {
      const chainId = faker.string.numeric();
      const signerAddress = getAddress(faker.finance.ethereumAddress());

      expect(() =>
        target.assertChainAndSigner({
          chainId,
          signerAddress,
          authPayload: undefined,
        }),
      ).toThrow(new UnauthorizedException());
    });

    it("should throw if the chainId and AuthPayload['chain_id'] don't match", () => {
      const chainId = faker.string.numeric();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const authPayload = authPayloadBuilder()
        .with('chain_id', faker.string.numeric({ exclude: [chainId] }))
        .with('signer_address', signerAddress)
        .build();

      expect(() =>
        target.assertChainAndSigner({
          chainId,
          signerAddress,
          authPayload,
        }),
      ).toThrow(new UnauthorizedException());
    });

    describe("should throw if the signerAddress and AuthPayload['signer_address'] don't match", () => {
      it('when both are not checksummed', () => {
        const chainId = faker.string.numeric();
        const signerAddress = faker.finance
          .ethereumAddress()
          .toLowerCase() as `0x${string}`;
        const authPayload = authPayloadBuilder()
          .with('chain_id', chainId)
          .with(
            'signer_address',
            faker.finance.ethereumAddress().toLowerCase() as `0x${string}`,
          )
          .build();

        expect(() =>
          target.assertChainAndSigner({
            chainId,
            signerAddress,
            authPayload,
          }),
        ).toThrow(new UnauthorizedException());
      });

      it('when both are checksummed', () => {
        const chainId = faker.string.numeric();
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const authPayload = authPayloadBuilder()
          .with('chain_id', chainId)
          .with('signer_address', getAddress(faker.finance.ethereumAddress()))
          .build();

        expect(() =>
          target.assertChainAndSigner({
            chainId,
            signerAddress,
            authPayload,
          }),
        ).toThrow(new UnauthorizedException());
      });

      it("when signerAddress is checksummed and AuthPayload['signer_address'] is not", () => {
        const chainId = faker.string.numeric();
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const authPayload = authPayloadBuilder()
          .with('chain_id', chainId)
          .with(
            'signer_address',
            faker.finance.ethereumAddress().toLowerCase() as `0x${string}`,
          )
          .build();

        expect(() =>
          target.assertChainAndSigner({
            chainId,
            signerAddress,
            authPayload,
          }),
        ).toThrow(new UnauthorizedException());
      });

      it("when signerAddress is not checksummed and AuthPayload['signer_address'] is", () => {
        const chainId = faker.string.numeric();
        const signerAddress = faker.finance.ethereumAddress() as `0x${string}`;
        const authPayload = authPayloadBuilder()
          .with('chain_id', chainId)
          .with('signer_address', getAddress(faker.finance.ethereumAddress()))
          .build();

        expect(() =>
          target.assertChainAndSigner({
            chainId,
            signerAddress,
            authPayload,
          }),
        ).toThrow(new UnauthorizedException());
      });
    });
  });

  describe('assertSafeOwner', () => {
    it('should not throw if the signer is an owner of the Safe', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const authPayload = authPayloadBuilder().build();
      safeRepositoryMocked.isOwner.mockResolvedValue(true);

      await expect(
        target.assertSafeOwner({
          safeAddress,
          authPayload,
        }),
      ).resolves.toBe(undefined);
    });

    it('should throw if there is no AuthPayload provided', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await expect(
        target.assertSafeOwner({
          safeAddress,
          authPayload: undefined,
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(safeRepositoryMocked.isOwner).not.toHaveBeenCalled();
    });

    it('should throw if the signer is not an owner of the Safe', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const authPayload = authPayloadBuilder().build();
      safeRepositoryMocked.isOwner.mockResolvedValue(false);

      await expect(
        target.assertSafeOwner({
          safeAddress,
          authPayload,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if the isOwner call throws an error', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const authPayload = authPayloadBuilder().build();
      safeRepositoryMocked.isOwner.mockRejectedValue(new Error());

      await expect(
        target.assertSafeOwner({
          safeAddress,
          authPayload,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
