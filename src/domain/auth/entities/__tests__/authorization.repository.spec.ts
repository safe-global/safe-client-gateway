import { AuthorizationRepository } from '@/domain/auth/authorization.repository';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { getAddress } from 'viem';

describe('AuthorizationRepository', () => {
  const target = new AuthorizationRepository();

  describe('assertChainAndSigner', () => {
    it('should not throw if the chainId and signerAddress match that of the AuthPayload', () => {
      const chainId = faker.string.numeric();
      const signerAddress = getAddress(faker.finance.ethereumAddress());

      expect(() =>
        target.assertChainAndSigner({
          chainId,
          signerAddress,
          authPayload: {
            chain_id: chainId,
            signer_address: signerAddress,
          },
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
      const chain_id = faker.string.numeric({ exclude: [chainId] });
      const signerAddress = getAddress(faker.finance.ethereumAddress());

      expect(() =>
        target.assertChainAndSigner({
          chainId,
          signerAddress,
          authPayload: {
            chain_id,
            signer_address: signerAddress,
          },
        }),
      ).toThrow(new UnauthorizedException());
    });

    describe("should throw if the signerAddress and AuthPayload['signer_address'] don't match", () => {
      it('when both are not checksummed', () => {
        const chainId = faker.string.numeric();
        const signerAddress = faker.finance
          .ethereumAddress()
          .toLowerCase() as `0x${string}`;
        const signer_address = faker.finance
          .ethereumAddress()
          .toLowerCase() as `0x${string}`;

        expect(() =>
          target.assertChainAndSigner({
            chainId,
            signerAddress,
            authPayload: {
              chain_id: chainId,
              signer_address,
            },
          }),
        ).toThrow(new UnauthorizedException());
      });

      it('when both are checksummed', () => {
        const chainId = faker.string.numeric();
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const signer_address = getAddress(faker.finance.ethereumAddress());

        expect(() =>
          target.assertChainAndSigner({
            chainId,
            signerAddress,
            authPayload: {
              chain_id: chainId,
              signer_address,
            },
          }),
        ).toThrow(new UnauthorizedException());
      });

      it("when signerAddress is checksummed and AuthPayload['signer_address'] is not", () => {
        const chainId = faker.string.numeric();
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const signer_address = faker.finance
          .ethereumAddress()
          .toLowerCase() as `0x${string}`;

        expect(() =>
          target.assertChainAndSigner({
            chainId,
            signerAddress,
            authPayload: {
              chain_id: chainId,
              signer_address,
            },
          }),
        ).toThrow(new UnauthorizedException());
      });

      it("when signerAddress is not checksummed and AuthPayload['signer_address'] is", () => {
        const chainId = faker.string.numeric();
        const signerAddress = faker.finance.ethereumAddress() as `0x${string}`;
        const signer_address = getAddress(faker.finance.ethereumAddress());

        expect(() =>
          target.assertChainAndSigner({
            chainId,
            signerAddress,
            authPayload: {
              chain_id: chainId,
              signer_address,
            },
          }),
        ).toThrow(new UnauthorizedException());
      });
    });
  });
});
