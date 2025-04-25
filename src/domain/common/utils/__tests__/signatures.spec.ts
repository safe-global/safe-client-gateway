import { faker } from '@faker-js/faker';
import { shuffle } from 'lodash';
import { concat } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getSignature } from '@/domain/common/utils/__tests__/signatures.builder';
import {
  DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH,
  parseSignaturesByType,
  SIGNATURE_HEX_LENGTH,
} from '@/domain/common/utils/signatures';

describe('parseSignaturesByType', () => {
  it.each(Object.values(SignatureType))(
    'should parse a %s signature',
    async (signatureType) => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
      const signature = await getSignature({
        signer,
        hash,
        signatureType,
      });

      const parsedSignatures = parseSignaturesByType(signature);

      expect(parsedSignatures).toStrictEqual([signature]);
    },
  );

  it('should parse concatenated signatures', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signatures = await Promise.all(
      shuffle(Object.values(SignatureType)).map((signatureType) => {
        return getSignature({ signer, hash, signatureType });
      }),
    );

    const parsedSignatures = parseSignaturesByType(concat(signatures));

    expect(parsedSignatures).toStrictEqual(signatures);
  });

  it('should throw if the signature does not start with 0x', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signatureType = faker.helpers.enumValue(SignatureType);
    const signature = await getSignature({
      signer,
      hash,
      signatureType,
    });

    expect(() =>
      parseSignaturesByType(signature.slice(2) as `0x${string}`),
    ).toThrow('Invalid "0x" notated signature');
  });

  it('should throw if the signature length is not even', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signatureType = faker.helpers.enumValue(SignatureType);
    const signature = await getSignature({
      signer,
      hash,
      signatureType,
    });

    expect(() =>
      parseSignaturesByType((signature + '0') as `0x${string}`),
    ).toThrow('Invalid hex bytes length');
  });

  it('should throw if the signature length is less than 65 bytes', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signatureType = faker.helpers.arrayElement([
      // Contract signature cannot be last to test static part length check
      SignatureType.ApprovedHash,
      SignatureType.EthSign,
      SignatureType.Eoa,
    ]);
    const signature = await getSignature({
      signer,
      hash,
      signatureType,
    });

    expect(() =>
      parseSignaturesByType(signature.slice(0, -2) as `0x${string}`),
    ).toThrow('Invalid signature length');
  });

  it('should throw if a concatenated signature is less than 65 bytes', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signatures = await Promise.all(
      [
        // Contract signature cannot be last to test static part length check
        SignatureType.ContractSignature,
        SignatureType.ApprovedHash,
        SignatureType.EthSign,
        SignatureType.Eoa,
      ].map((signatureType) => {
        return getSignature({ signer, hash, signatureType });
      }),
    );
    const concatenatedSignature = concat(signatures);

    expect(() =>
      parseSignaturesByType(
        concatenatedSignature.slice(0, -2) as `0x${string}`,
      ),
    ).toThrow('Insufficient length for static part');
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

    expect(() =>
      parseSignaturesByType(
        signature.slice(
          0,
          SIGNATURE_HEX_LENGTH + DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH - 2,
        ) as `0x${string}`,
      ),
    ).toThrow('Insufficient length for dynamic part length field');
  });

  it('should throw if a concatenated contract signature has insufficient bytes for the dynamic part length field', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signature = await getSignature({
      signer,
      hash,
      signatureType: SignatureType.ContractSignature,
    });

    expect(() =>
      parseSignaturesByType(
        concat([
          signature,
          signature.slice(
            0,
            SIGNATURE_HEX_LENGTH + DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH - 2,
          ) as `0x${string}`,
        ]),
      ),
    ).toThrow('Insufficient length for dynamic part length field');
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

    expect(() =>
      parseSignaturesByType(signature.slice(0, -2) as `0x${string}`),
    ).toThrow('Insufficient length for dynamic part');
  });

  it('should throw if a concatenated contract signature has insufficient bytes for the dynamic part', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signature = await getSignature({
      signer,
      hash,
      signatureType: SignatureType.ContractSignature,
    });

    expect(() =>
      parseSignaturesByType(
        concat([signature, signature]).slice(0, -2) as `0x${string}`,
      ),
    ).toThrow('Insufficient length for dynamic part');
  });
});
