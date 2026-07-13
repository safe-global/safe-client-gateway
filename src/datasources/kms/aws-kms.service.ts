// SPDX-License-Identifier: FSL-1.1-MIT
import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { resolveAwsCredentials } from '@/datasources/common/utils/aws-credentials.utils';
import type { IKmsService } from '@/datasources/kms/kms.service.interface';

@Injectable()
export class AwsKmsService implements IKmsService {
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
    this.keyId = this.configurationService.get<string>('encryption.kms.keyId');
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

  public async decrypt(args: {
    ciphertext: Buffer;
    encryptionContext?: Record<string, string>;
  }): Promise<Buffer> {
    const { client, keyId } = this.getConfiguredClient();
    const response = await client.send(
      new DecryptCommand({
        KeyId: keyId,
        CiphertextBlob: new Uint8Array(args.ciphertext),
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
        'AWS KMS is not configured: encryption.kms.keyId is required',
      );
    }
    return { client: this.client, keyId: this.keyId };
  }

  private createClient(): KMSClient {
    // Region is not read from config: like AwsSesEmailService, it's left for
    // the AWS SDK to resolve directly from the environment (AWS_REGION),
    // rather than piping it through IConfigurationService.
    const webIdentityTokenFile = this.configurationService.get<string>(
      'encryption.kms.webIdentityTokenFile',
    );
    const credentials = resolveAwsCredentials(webIdentityTokenFile) ?? {
      accessKeyId: this.configurationService.getOrThrow<string>(
        'encryption.kms.accessKeyId',
      ),
      secretAccessKey: this.configurationService.getOrThrow<string>(
        'encryption.kms.secretAccessKey',
      ),
    };

    return new KMSClient({ credentials });
  }
}
