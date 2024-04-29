import {
  AuthPayload,
  AuthPayloadDto,
  AuthPayloadDtoSchema,
} from '@/domain/auth/entities/auth-payload.entity';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('AuthPayload entity', () => {
  describe('AuthPayload', () => {
    describe('isForChain', () => {
      it("should return true if `chainId` matches `AuthPayload['chain_id']`", () => {
        const chainId = faker.string.numeric({ exclude: ['0'] });
        const authPayloadDto = authPayloadDtoBuilder()
          .with('chain_id', chainId)
          .build();
        const authPayload = new AuthPayload(authPayloadDto);

        const result = authPayload.isForChain(chainId);

        expect(result).toBe(true);
      });

      it('should return false if `chainId` does not match `AuthPayload[chain_id]`', () => {
        const authPayloadDto = authPayloadDtoBuilder().build();
        const chainId = faker.string.numeric({
          exclude: [authPayloadDto.chain_id],
        });
        const authPayload = new AuthPayload(authPayloadDto);

        const result = authPayload.isForChain(chainId);

        expect(result).toBe(false);
      });
    });

    describe('isForSigner', () => {
      describe('should return true if `signerAddress` matches `AuthPayload[signer_address]`', () => {
        it('if both are checksummed', () => {
          const authPayloadDto = authPayloadDtoBuilder()
            .with('signer_address', getAddress(faker.finance.ethereumAddress()))
            .build();
          const authPayload = new AuthPayload(authPayloadDto);

          const result = authPayload.isForSigner(authPayloadDto.signer_address);

          expect(result).toBe(true);
        });

        it('if neither are checksummed', () => {
          const authPayloadDto = authPayloadDtoBuilder()
            .with(
              'signer_address',
              faker.finance.ethereumAddress().toLowerCase() as `0x${string}`,
            )
            .build();
          const authPayload = new AuthPayload(authPayloadDto);

          const result = authPayload.isForSigner(authPayloadDto.signer_address);

          expect(result).toBe(true);
        });

        it('if `signer_address` is checksummed and `signerAddress` is not', () => {
          const authPayloadDto = authPayloadDtoBuilder()
            .with('signer_address', getAddress(faker.finance.ethereumAddress()))
            .build();
          const signerAddress =
            authPayloadDto.signer_address.toLowerCase() as `0x${string}`;
          const authPayload = new AuthPayload(authPayloadDto);

          const result = authPayload.isForSigner(signerAddress);

          expect(result).toBe(true);
        });

        it('if `signer_address` is not checksummed and `signerAddress` is', () => {
          const authPayloadDto = authPayloadDtoBuilder()
            .with(
              'signer_address',
              faker.finance.ethereumAddress().toLowerCase() as `0x${string}`,
            )
            .build();
          const signerAddress = getAddress(authPayloadDto.signer_address);
          const authPayload = new AuthPayload(authPayloadDto);

          const result = authPayload.isForSigner(signerAddress);

          expect(result).toBe(true);
        });
      });

      it('should return false if `signerAddress` does not match `AuthPayload[signer_address]`', () => {
        const authPayloadDto = authPayloadDtoBuilder()
          .with('signer_address', getAddress(faker.finance.ethereumAddress()))
          .build();
        const signerAddress = getAddress(faker.finance.ethereumAddress());
        const authPayload = new AuthPayload(authPayloadDto);

        const result = authPayload.isForSigner(signerAddress);

        expect(result).toBe(false);
      });
    });

    describe('AuthPayloadDtoSchema', () => {
      it('should parse a valid AuthPayloadDto', () => {
        const authPayloadDto = authPayloadDtoBuilder().build();

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success).toBe(true);
        // Address did not checksum as it already way
        expect(result.success && result.data).toStrictEqual(authPayloadDto);
      });

      it('should checksum the signer_address', () => {
        const nonChecksummedAddress = faker.finance
          .ethereumAddress()
          .toLowerCase();
        const authPayloadDto = authPayloadDtoBuilder()
          .with('signer_address', nonChecksummedAddress as `0x${string}`)
          .build();

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success && result.data.signer_address).toBe(
          getAddress(nonChecksummedAddress),
        );
      });

      it('should not allow a non-numeric chain_id', () => {
        const authPayloadDto = authPayloadDtoBuilder()
          .with('chain_id', faker.lorem.word())
          .build();

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success).toBe(false);
        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'custom',
            message: 'Invalid base-10 numeric string',
            path: ['chain_id'],
          },
        ]);
      });

      it('should not allow a non-address signer_address', () => {
        const authPayloadDto = authPayloadDtoBuilder()
          .with('signer_address', faker.lorem.word() as `0x${string}`)
          .build();

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success).toBe(false);
        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'custom',
            message: 'Invalid address',
            path: ['signer_address'],
          },
        ]);
      });

      it('should not parse an invalid AuthPayloadDtoSchema', () => {
        const authPayloadDto = {
          unknown: 'payload',
        };

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success).toBe(false);
        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['chain_id'],
            received: 'undefined',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            message: 'Required',
            path: ['signer_address'],
            received: 'undefined',
          },
        ]);
      });
    });
  });
});
