import {
  AuthMethod,
  AuthPayload,
  AuthPayloadDtoSchema,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import {
  authPayloadDtoBuilder,
  oidcAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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

      it('should return false for OIDC payloads', () => {
        const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
        const authPayload = new AuthPayload(authPayloadDto);

        const result = authPayload.isForChain('1');

        expect(result).toBe(false);
      });
    });

    describe('isForSigner', () => {
      describe('should return true if `signerAddress` matches `AuthPayload[signer_address]`', () => {
        it('if both are checksummed', () => {
          const authPayloadDto = authPayloadDtoBuilder()
            .with(
              'signer_address',
              getAddress(faker.finance.ethereumAddress()),
            )
            .build();
          const authPayload = new AuthPayload(authPayloadDto);

          const result = authPayload.isForSigner(
            authPayloadDto.signer_address,
          );

          expect(result).toBe(true);
        });

        it('if neither are checksummed', () => {
          const authPayloadDto = authPayloadDtoBuilder()
            .with(
              'signer_address',
              faker.finance.ethereumAddress().toLowerCase() as Address,
            )
            .build();
          const authPayload = new AuthPayload(authPayloadDto);

          const result = authPayload.isForSigner(
            authPayloadDto.signer_address,
          );

          expect(result).toBe(true);
        });

        it('if `signer_address` is checksummed and `signerAddress` is not', () => {
          const authPayloadDto = authPayloadDtoBuilder()
            .with(
              'signer_address',
              getAddress(faker.finance.ethereumAddress()),
            )
            .build();
          const signerAddress =
            authPayloadDto.signer_address.toLowerCase() as Address;
          const authPayload = new AuthPayload(authPayloadDto);

          const result = authPayload.isForSigner(signerAddress);

          expect(result).toBe(true);
        });

        it('if `signer_address` is not checksummed and `signerAddress` is', () => {
          const authPayloadDto = authPayloadDtoBuilder()
            .with(
              'signer_address',
              faker.finance.ethereumAddress().toLowerCase() as Address,
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

      it('should return false for OIDC payloads', () => {
        const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
        const authPayload = new AuthPayload(authPayloadDto);

        const result = authPayload.isForSigner(
          getAddress(faker.finance.ethereumAddress()),
        );

        expect(result).toBe(false);
      });
    });

    describe('getUserId', () => {
      it('should return sub for SIWE payloads', () => {
        const sub = faker.string.numeric({ exclude: ['0'] });
        const authPayloadDto = authPayloadDtoBuilder()
          .with('sub', sub)
          .build();
        const authPayload = new AuthPayload(authPayloadDto);

        expect(authPayload.getUserId()).toBe(sub);
      });

      it('should return sub for OIDC payloads', () => {
        const sub = faker.string.numeric({ exclude: ['0'] });
        const authPayloadDto = oidcAuthPayloadDtoBuilder()
          .with('sub', sub)
          .build();
        const authPayload = new AuthPayload(authPayloadDto);

        expect(authPayload.getUserId()).toBe(sub);
      });

      it('should return undefined when no payload is provided', () => {
        const authPayload = new AuthPayload();

        expect(authPayload.getUserId()).toBeUndefined();
      });
    });

    describe('isSiwe', () => {
      it('should return true for SIWE payloads', () => {
        const authPayloadDto = authPayloadDtoBuilder().build();
        const authPayload = new AuthPayload(authPayloadDto);

        expect(authPayload.isSiwe()).toBe(true);
      });

      it('should return false for OIDC payloads', () => {
        const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
        const authPayload = new AuthPayload(authPayloadDto);

        expect(authPayload.isSiwe()).toBe(false);
      });
    });

    describe('isOidc', () => {
      it('should return true for OIDC payloads', () => {
        const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
        const authPayload = new AuthPayload(authPayloadDto);

        expect(authPayload.isOidc()).toBe(true);
      });

      it('should return false for SIWE payloads', () => {
        const authPayloadDto = authPayloadDtoBuilder().build();
        const authPayload = new AuthPayload(authPayloadDto);

        expect(authPayload.isOidc()).toBe(false);
      });
    });

    describe('AuthPayloadDtoSchema', () => {
      it('should parse a valid SIWE AuthPayloadDto', () => {
        const authPayloadDto = authPayloadDtoBuilder().build();

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success).toBe(true);
        expect(result.success && result.data).toStrictEqual(authPayloadDto);
      });

      it('should parse a valid OIDC AuthPayloadDto', () => {
        const authPayloadDto = oidcAuthPayloadDtoBuilder().build();

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success).toBe(true);
        expect(result.success && result.data).toStrictEqual(authPayloadDto);
      });

      it('should checksum the signer_address', () => {
        const nonChecksummedAddress = faker.finance
          .ethereumAddress()
          .toLowerCase();
        const authPayloadDto = authPayloadDtoBuilder()
          .with('signer_address', nonChecksummedAddress as Address)
          .build();

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(
          result.success &&
            result.data.auth_method === AuthMethod.Siwe &&
            result.data.signer_address,
        ).toBe(getAddress(nonChecksummedAddress));
      });

      it('should not allow a non-numeric chain_id', () => {
        const authPayloadDto = authPayloadDtoBuilder()
          .with('chain_id', faker.lorem.word())
          .build();

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success).toBe(false);
      });

      it('should not allow a non-address signer_address', () => {
        const authPayloadDto = authPayloadDtoBuilder()
          .with('signer_address', faker.lorem.word() as Address)
          .build();

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success).toBe(false);
      });

      it('should not parse a payload without auth_method', () => {
        const payload = {
          sub: faker.string.numeric({ exclude: ['0'] }),
          chain_id: faker.string.numeric({ exclude: ['0'] }),
          signer_address: getAddress(faker.finance.ethereumAddress()),
        };

        const result = AuthPayloadDtoSchema.safeParse(payload);

        expect(result.success).toBe(false);
      });

      it('should not parse a payload without sub', () => {
        const payload = {
          auth_method: AuthMethod.Siwe,
          chain_id: faker.string.numeric({ exclude: ['0'] }),
          signer_address: getAddress(faker.finance.ethereumAddress()),
        };

        const result = AuthPayloadDtoSchema.safeParse(payload);

        expect(result.success).toBe(false);
      });

      it('should not parse an invalid AuthPayloadDtoSchema', () => {
        const authPayloadDto = {
          unknown: 'payload',
        };

        const result = AuthPayloadDtoSchema.safeParse(authPayloadDto);

        expect(result.success).toBe(false);
      });
    });
  });
});
