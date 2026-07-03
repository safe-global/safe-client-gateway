// SPDX-License-Identifier: FSL-1.1-MIT
import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { fromTokenFile } from '@aws-sdk/credential-provider-web-identity';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class KmsService {
  // Resolved in the constructor whenever a KMS key is configured, so a
  // partial configuration fails at construction. When field encryption is
  // disabled (the default) no KMS configuration exists, yet the DI container
  // still instantiates this service — it must construct without it and only
  // fail if a KMS call is actually made. The env schema validator guarantees
  // the full configuration whenever field encryption is enabled.
  private readonly client: KMSClient | undefined;
  private readonly keyId: string | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.keyId = this.configurationService.get<string>(
      'spaces.fieldEncryption.kms.keyId',
    );
    if (this.keyId) {
      this.client = this.createClient();
    }
  }

  async encrypt(args: {
    plaintext: Buffer;
    encryptionContext?: Record<string, string>;
  }): Promise<Buffer> {
    const { client, keyId } = this.getConfiguredClient();
    const response = await client.send(
      new EncryptCommand({
        KeyId: keyId,
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
    const { client, keyId } = this.getConfiguredClient();
    const response = await client.send(
      new DecryptCommand({
        CiphertextBlob: new Uint8Array(args.ciphertext),
        KeyId: keyId,
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

  private getConfiguredClient(): { client: KMSClient; keyId: string } {
    if (!(this.client && this.keyId)) {
      throw new Error(
        'AWS KMS is not configured: spaces.fieldEncryption.kms.keyId is required',
      );
    }
    return { client: this.client, keyId: this.keyId };
  }

  private createClient(): KMSClient {
    const region = this.configurationService.getOrThrow<string>(
      'spaces.fieldEncryption.kms.region',
    );

    const webIdentityTokenFile = this.configurationService.get<string>(
      'spaces.fieldEncryption.kms.webIdentityTokenFile',
    );
    const credentials = webIdentityTokenFile
      ? fromTokenFile({ webIdentityTokenFile })
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
