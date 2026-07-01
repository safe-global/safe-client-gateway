// SPDX-License-Identifier: FSL-1.1-MIT

import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { fromTokenFile } from '@aws-sdk/credential-provider-web-identity';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type {
  IKmsApi,
  KmsDataKey,
} from '@/domain/interfaces/kms-api.interface';

@Injectable()
export class AwsKmsApiService implements IKmsApi {
  // Built lazily: when field encryption is disabled (the default) this service
  // is still instantiated by the DI container, but it must not require any KMS
  // configuration until a KMS call is actually made.
  private client: KMSClient | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  private getKeyId(): string {
    return this.configurationService.getOrThrow<string>(
      'spaces.fieldEncryption.kms.keyId',
    );
  }

  private getClient(): KMSClient {
    if (this.client) {
      return this.client;
    }
    const region = this.configurationService.getOrThrow<string>(
      'spaces.fieldEncryption.kms.region',
    );

    // In EKS the pod credentials are provided via IRSA (web identity token),
    // mirroring the SES datasource; otherwise fall back to static credentials.
    const webIdentityTokenFile = this.configurationService.get<string>(
      'spaces.fieldEncryption.kms.webIdentityTokenFile',
    );
    const credentials = webIdentityTokenFile
      ? fromTokenFile()
      : {
          accessKeyId: this.configurationService.getOrThrow<string>(
            'spaces.fieldEncryption.kms.accessKeyId',
          ),
          secretAccessKey: this.configurationService.getOrThrow<string>(
            'spaces.fieldEncryption.kms.secretAccessKey',
          ),
        };

    this.client = new KMSClient({ region, credentials });
    return this.client;
  }

  async generateDataKey(): Promise<KmsDataKey> {
    const response = await this.getClient().send(
      new GenerateDataKeyCommand({
        KeyId: this.getKeyId(),
        KeySpec: 'AES_256',
      }),
    );
    if (!(response.Plaintext && response.CiphertextBlob)) {
      throw new Error('KMS did not return data key material');
    }
    return {
      plaintext: Buffer.from(response.Plaintext),
      encrypted: Buffer.from(response.CiphertextBlob),
    };
  }

  async encrypt(
    plaintext: Buffer,
    encryptionContext: Record<string, string>,
  ): Promise<Buffer> {
    const response = await this.getClient().send(
      new EncryptCommand({
        KeyId: this.getKeyId(),
        Plaintext: plaintext,
        EncryptionContext: encryptionContext,
      }),
    );
    if (!response.CiphertextBlob) {
      throw new Error('KMS did not return ciphertext');
    }
    return Buffer.from(response.CiphertextBlob);
  }

  async decrypt(
    encrypted: Buffer,
    encryptionContext?: Record<string, string>,
  ): Promise<Buffer> {
    const response = await this.getClient().send(
      new DecryptCommand({
        CiphertextBlob: encrypted,
        KeyId: this.getKeyId(),
        ...(encryptionContext && { EncryptionContext: encryptionContext }),
      }),
    );
    if (!response.Plaintext) {
      throw new Error('KMS did not return decrypted key material');
    }
    return Buffer.from(response.Plaintext);
  }
}
