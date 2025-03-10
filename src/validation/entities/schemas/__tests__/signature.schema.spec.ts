import { faker } from '@faker-js/faker';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';
import {
  getApprovedHashSignature,
  getContractSignature,
  getEoaSignature,
  getEthSignSignature,
  getSignature,
} from '@/domain/common/utils/__tests__/signatures.builder';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { concat, getAddress } from 'viem';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import {
  SIGNATURE_HEX_LENGTH,
  DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH,
} from '@/domain/common/utils/signatures';

describe('SignatureSchema', () => {
  it('should validate an approved hash', () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const signature = getApprovedHashSignature(address);

    const result = SignatureSchema.safeParse(signature);

    expect(result.success).toBe(true);
  });

  it('should validate a contract signature', () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const signature = getContractSignature(address);

    const result = SignatureSchema.safeParse(signature);

    expect(result.success).toBe(true);
  });

  it('should validate an eth_sign signature', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signature = await getEthSignSignature({
      signer,
      hash,
    });

    const result = SignatureSchema.safeParse(signature);

    expect(result.success).toBe(true);
  });

  it('should validate an EOA signature', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signature = await getEoaSignature({
      signer,
      hash,
    });

    const result = SignatureSchema.safeParse(signature);

    expect(result.success).toBe(true);
  });

  it('should validate a concatenated signature', async () => {
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signatures = await Promise.all(
      Array.from(
        { length: faker.number.int({ min: 5, max: 10 }) },
        async () => {
          const privateKey = generatePrivateKey();
          const signer = privateKeyToAccount(privateKey);
          const signatureType = faker.helpers.enumValue(SignatureType);
          return getSignature({
            signer,
            hash,
            signatureType,
          });
        },
      ),
    );
    const signature = concat(signatures);

    const result = SignatureSchema.safeParse(signature);

    expect(result.success).toBe(true);
  });

  it('should not validate a non-hex signature', () => {
    const signature = faker.string.alphanumeric() as `0x${string}`;

    const result = SignatureSchema.safeParse(signature);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: [],
      },
      {
        code: 'custom',
        message: 'Invalid hex bytes',
        path: [],
      },
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });

  it('should not validate a non-even length signature', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signatureType = faker.helpers.enumValue(SignatureType);
    const signature = await getSignature({
      signer,
      hash,
      signatureType,
    });

    const result = SignatureSchema.safeParse(signature + '0');

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid hex bytes',
        path: [],
      },
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });

  it('should not validate a signature with a length less thatn 65 bytes', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signatureType = faker.helpers.enumValue(SignatureType);
    const signature = await getSignature({
      signer,
      hash,
      signatureType,
    });

    const result = SignatureSchema.safeParse(signature.slice(0, -2));

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });

  it('should not validate a concatenated signature with a length less than 65 bytes', async () => {
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

    const result = SignatureSchema.safeParse(concat(signatures).slice(0, -2));

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });

  it('should not validate a contract signature that has insufficient bytes for the dynamic part length field', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({ length: 66 }) as `0x${string}`;
    const signature = await getSignature({
      signer,
      hash,
      signatureType: SignatureType.ContractSignature,
    });

    const result = SignatureSchema.safeParse(
      signature.slice(
        0,
        SIGNATURE_HEX_LENGTH + DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH - 2,
      ),
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });

  it('should not validate a concatenated contract signature that has insufficient bytes for the dynamic part length field', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({
      length: 66,
    }) as `0x${string}`;
    const signature = await getSignature({
      signer,
      hash,
      signatureType: SignatureType.ContractSignature,
    });

    const result = SignatureSchema.safeParse(
      concat([
        signature,
        signature.slice(
          0,
          SIGNATURE_HEX_LENGTH + DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH - 2,
        ) as `0x${string}`,
      ]),
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });

  it('should not validate a contract signature that has insufficient bytes for the dynamic part', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({
      length: 66,
    }) as `0x${string}`;
    const signature = await getSignature({
      signer,
      hash,
      signatureType: SignatureType.ContractSignature,
    });

    const result = SignatureSchema.safeParse(signature.slice(0, -2));

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });

  it('should not validate a concatenated contract signature that has insufficient bytes for the dynamic part', async () => {
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const hash = faker.string.hexadecimal({
      length: 66,
    }) as `0x${string}`;
    const signature = await getSignature({
      signer,
      hash,
      signatureType: SignatureType.ContractSignature,
    });

    const result = SignatureSchema.safeParse(
      concat([signature, signature]).slice(0, -2),
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });

  it('should not validate a incorrect length signature', () => {
    const signature = faker.string.hexadecimal({
      length: 129,
    }) as `0x${string}`;

    const result = SignatureSchema.safeParse(signature);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid hex bytes',
        path: [],
      },
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });
});
