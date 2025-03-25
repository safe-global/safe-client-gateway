import { faker } from '@faker-js/faker';
import { shuffle } from 'lodash';
import * as viem from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { SafeSignature } from '@/domain/common/entities/safe-signature';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getSignature } from '@/domain/common/utils/__tests__/signatures.builder';
import {
  SIGNATURE_HEX_LENGTH,
  DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH,
} from '@/domain/common/utils/signatures';

describe('SafeSignature', () => {
  it('should create an instance', () => {
    const signature = faker.string.hexadecimal({
      length: 130,
    }) as `0x${string}`;
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

    expect(() => new SafeSignature({ signature, hash })).not.toThrow();
  });

  it('should throw if the signature does not start with 0x', () => {
    const signature = faker.string
      .hexadecimal({
        length: 130,
      })
      .slice(2) as `0x${string}`;
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

    expect(() => new SafeSignature({ signature, hash })).toThrow(
      new Error('Invalid "0x" notated signature'),
    );
  });

  it('should throw an error if the signature length is not even', () => {
    const signature = faker.string.hexadecimal({
      length: 129,
    }) as `0x${string}`;
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

    expect(() => new SafeSignature({ signature, hash })).toThrow(
      new Error('Invalid hex bytes length'),
    );
  });

  it('should throw if the signature length is less than 132', () => {
    const signature = faker.string.hexadecimal({
      length: 128,
    }) as `0x${string}`;
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;

    expect(() => new SafeSignature({ signature, hash })).toThrow(
      new Error('Invalid signature length'),
    );
  });

  it('should throw if a contract signature has insufficient bytes for the dynamic part length field', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signature = await getSignature({
      signer,
      hash,
      signatureType: SignatureType.ContractSignature,
    });

    expect(
      () =>
        new SafeSignature({
          signature: signature.slice(
            0,
            SIGNATURE_HEX_LENGTH + DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH - 2,
          ) as `0x${string}`,
          hash,
        }),
    ).toThrow(new Error('Insufficient length for dynamic part length field'));
  });

  it('should throw if a contract signature has insufficient bytes for the dynamic part', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signature = await getSignature({
      signer,
      hash,
      signatureType: SignatureType.ContractSignature,
    });

    expect(
      () =>
        new SafeSignature({
          signature: signature.slice(0, -2) as `0x${string}`,
          hash,
        }),
    ).toThrow(new Error('Insufficient length for dynamic part'));
  });

  it('should throw if providing a concatenated signature', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signatures = await Promise.all(
      shuffle(Object.values(SignatureType)).map((signatureType) => {
        return getSignature({
          signer,
          hash,
          signatureType,
        });
      }),
    );

    expect(
      () =>
        new SafeSignature({
          signature: viem.concat(signatures),
          hash,
        }),
    ).toThrow('Concatenated signatures are not supported');
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
    it('should return ContractSignature if the v is 0', async () => {
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
      const signature = await getSignature({
        signer: privateKeyToAccount(generatePrivateKey()),
        hash,
        signatureType: SignatureType.ContractSignature,
      });

      const safeSignature = new SafeSignature({ signature, hash });

      expect(safeSignature.signatureType).toBe(SignatureType.ContractSignature);
    });

    it('should return ApprovedHash if the v is 1', async () => {
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
      const signature = await getSignature({
        signer: privateKeyToAccount(generatePrivateKey()),
        hash,
        signatureType: SignatureType.ApprovedHash,
      });

      const safeSignature = new SafeSignature({ signature, hash });

      expect(safeSignature.signatureType).toBe(SignatureType.ApprovedHash);
    });

    it('should return EthSign if the v is greater than 30', async () => {
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
      const signature = await getSignature({
        signer: privateKeyToAccount(generatePrivateKey()),
        hash,
        signatureType: SignatureType.EthSign,
      });

      const safeSignature = new SafeSignature({ signature, hash });

      expect(safeSignature.signatureType).toBe(SignatureType.EthSign);
    });

    it('should return Eoa if the v is not any of the above', async () => {
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
      const signature = await getSignature({
        signer: privateKeyToAccount(generatePrivateKey()),
        hash,
        signatureType: SignatureType.Eoa,
      });

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
