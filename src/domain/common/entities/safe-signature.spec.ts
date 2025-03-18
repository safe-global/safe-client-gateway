import { faker } from '@faker-js/faker';
import * as viem from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { SafeSignature } from '@/domain/common/entities/safe-signature';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getSignature } from '@/domain/common/utils/__tests__/signatures.builder';

describe('SafeSignature', () => {
  it('should create an instance', () => {
    const signature = faker.string.hexadecimal({
      length: 130,
    }) as `0x${string}`;
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

    expect(() => new SafeSignature({ signature, hash })).not.toThrow();
  });

  it('should throw an error if the signature length is invalid', () => {
    const signature = faker.string.hexadecimal({
      length: 130 + 1,
    }) as `0x${string}`;
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

    expect(() => new SafeSignature({ signature, hash })).toThrow(
      new Error('Invalid signature length'),
    );
  });

  it('should return the r value', () => {
    const signature = faker.string.hexadecimal({
      length: 130,
    }) as `0x${string}`;
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

    const safeSignature = new SafeSignature({
      signature,
      hash,
    });

    expect(safeSignature.r).toBe(signature.slice(0, 66));
  });

  it('should return the s value', () => {
    const signature = faker.string.hexadecimal({
      length: 130,
    }) as `0x${string}`;
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

    const safeSignature = new SafeSignature({
      signature,
      hash,
    });

    expect(safeSignature.s).toBe(`0x${signature.slice(66, 130)}`);
  });

  it('should return the v value', () => {
    const signature = faker.string.hexadecimal({
      length: 130,
    }) as `0x${string}`;
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

    const safeSignature = new SafeSignature({
      signature,
      hash,
    });

    expect(safeSignature.v).toBe(parseInt(signature.slice(-2), 16));
  });

  describe('signatureType', () => {
    it('should return ContractSignature if the v is 0', () => {
      const signature = (faker.string.hexadecimal({
        length: 128,
      }) + '00') as `0x${string}`;
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

      const safeSignature = new SafeSignature({ signature, hash });

      expect(safeSignature.signatureType).toBe(SignatureType.ContractSignature);
    });

    it('should return ApprovedHash if the v is 1', () => {
      const signature = (faker.string.hexadecimal({
        length: 128,
      }) + '01') as `0x${string}`;
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

      const safeSignature = new SafeSignature({ signature, hash });

      expect(safeSignature.signatureType).toBe(SignatureType.ApprovedHash);
    });

    it('should return EthSign if the v is greater than 30', () => {
      const signature = (faker.string.hexadecimal({
        length: 128,
      }) + faker.helpers.arrayElement([31, 32]).toString(16)) as `0x${string}`;
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

      const safeSignature = new SafeSignature({ signature, hash });

      expect(safeSignature.signatureType).toBe(SignatureType.EthSign);
    });

    it('should return Eoa if the v is not any of the above', () => {
      const signature = (faker.string.hexadecimal({
        length: 128,
      }) + faker.helpers.arrayElement([27, 28]).toString(16)) as `0x${string}`;
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

      const safeSignature = new SafeSignature({ signature, hash });

      expect(safeSignature.signatureType).toBe(SignatureType.Eoa);
    });
  });

  describe('owner', () => {
    it.each(Object.values(SignatureType))(
      'should recover the address of a %s signature',
      async (signatureType) => {
        const privateKey = generatePrivateKey();
        const signer = privateKeyToAccount(privateKey);
        const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
        const signature = await getSignature({
          signer,
          hash,
          signatureType,
        });

        const safeSignature = new SafeSignature({ signature, hash });

        expect(safeSignature.owner).toBe(signer.address);
      },
    );

    it('should memoize the owner', async () => {
      const getAddressSpy = jest.spyOn(viem, 'getAddress');

      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
      // Recovered via getAddress
      const signatureType = faker.helpers.arrayElement([
        SignatureType.ApprovedHash,
        SignatureType.ContractSignature,
      ]);
      const signature = await getSignature({
        signer,
        hash,
        signatureType,
      });

      const safeSignature = new SafeSignature({ signature, hash });

      expect(safeSignature.owner).toBe(signer.address);
      expect(getAddressSpy).toHaveBeenCalledTimes(1);

      expect(safeSignature.owner).toBe(signer.address);
      expect(getAddressSpy).toHaveBeenCalledTimes(1);

      const newPrivateKey = generatePrivateKey();
      const newSigner = privateKeyToAccount(newPrivateKey);
      safeSignature.signature = await getSignature({
        signer: newSigner,
        hash,
        signatureType,
      });

      expect(safeSignature.owner).toBe(newSigner.address);
      expect(getAddressSpy).toHaveBeenCalledTimes(2);

      expect(safeSignature.owner).toBe(newSigner.address);
      expect(getAddressSpy).toHaveBeenCalledTimes(2);
    });
  });
});
