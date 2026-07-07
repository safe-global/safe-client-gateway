// SPDX-License-Identifier: FSL-1.1-MIT

import {
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
} from '@aws-sdk/client-kms';
import { faker } from '@faker-js/faker';
import { mockClient } from 'aws-sdk-client-mock';
import { AwsKmsSignerService } from '@/datasources/kms/aws-kms-signer.service';

const kmsMock = mockClient(KMSClient);

describe('AwsKmsSignerService', () => {
  const keyId = faker.string.uuid();

  beforeEach(() => {
    kmsMock.reset();
  });

  function createSigner(): AwsKmsSignerService {
    return new AwsKmsSignerService({ keyId });
  }

  describe('sign', () => {
    it('sends an ES256 SignCommand and returns the DER signature', async () => {
      const signature = Buffer.from(faker.string.hexadecimal({ length: 140 }));
      kmsMock.on(SignCommand).resolves({ Signature: signature });

      const message = Buffer.from(faker.string.alphanumeric(64));
      const result = await createSigner().sign(message);

      expect(result).toEqual(signature);
      expect(
        kmsMock.commandCalls(SignCommand, {
          KeyId: keyId,
          Message: message,
          MessageType: 'RAW',
          SigningAlgorithm: 'ECDSA_SHA_256',
        }),
      ).toHaveLength(1);
    });

    it('throws when KMS returns no signature', async () => {
      kmsMock.on(SignCommand).resolves({});

      await expect(
        createSigner().sign(Buffer.from(faker.string.alphanumeric(16))),
      ).rejects.toThrow('KMS did not return a signature');
    });
  });

  describe('getPublicKey', () => {
    it('sends a GetPublicKeyCommand and returns the SPKI DER key', async () => {
      const publicKey = Buffer.from(faker.string.hexadecimal({ length: 182 }));
      kmsMock.on(GetPublicKeyCommand).resolves({ PublicKey: publicKey });

      const result = await createSigner().getPublicKey();

      expect(result).toEqual(publicKey);
      expect(
        kmsMock.commandCalls(GetPublicKeyCommand, { KeyId: keyId }),
      ).toHaveLength(1);
    });

    it('throws when KMS returns no public key', async () => {
      kmsMock.on(GetPublicKeyCommand).resolves({});

      await expect(createSigner().getPublicKey()).rejects.toThrow(
        'KMS did not return a public key',
      );
    });
  });
});
