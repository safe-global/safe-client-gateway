// SPDX-License-Identifier: FSL-1.1-MIT
import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { fromTokenFile } from '@aws-sdk/credential-provider-web-identity';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class KmsService {
  private client: KMSClient;
  private keyId: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.keyId = this.configurationService.getOrThrow<string>(
      'spaces.fieldEncryption.kms.keyId',
    );
    this.client = this.createClient();
  }

  async encrypt(args: {
    plaintext: Buffer;
    encryptionContext?: Record<string, string>;
  }): Promise<Buffer> {
    const response = await this.client.send(
      new EncryptCommand({
        KeyId: this.keyId,
        Plaintext: new Uint8Array(args.plaintext),
        ...(args.encryptionContext && {
          EncryptionContext: args.encryptionContext,
        }),
      }),
    );
    if (!response.CiphertextBlob) {
      throw new Error('Could not encrypt data');
    }
    return Buffer.from(response.CiphertextBlob);
  }

  /** Reverse of {@link encrypt}: decrypts a raw KMS ciphertext blob. */
  public async decrypt(args: {
    ciphertext: Buffer;
    encryptionContext?: Record<string, string>;
  }): Promise<Buffer> {
    const response = await this.client.send(
      new DecryptCommand({
        CiphertextBlob: new Uint8Array(args.ciphertext),
        KeyId: this.keyId,
        ...(args.encryptionContext && {
          EncryptionContext: args.encryptionContext,
        }),
      }),
    );
    if (!response.Plaintext) {
      throw new Error('Could not decrypt data');
    }
    return Buffer.from(response.Plaintext);
  }

  private createClient(): KMSClient {
    const region = this.configurationService.getOrThrow<string>(
      'spaces.fieldEncryption.kms.region',
    );

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

    return new KMSClient({ region, credentials });
  }
}
