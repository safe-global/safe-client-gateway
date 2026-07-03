// SPDX-License-Identifier: FSL-1.1-MIT

import {
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
} from '@aws-sdk/client-kms';
import { fromTokenFile } from '@aws-sdk/credential-provider-web-identity';
import type { IKmsSigner } from '@/datasources/kms/kms-signer.interface';

export interface KmsSignerConfig {
  keyId: string;
  webIdentityTokenFile?: string;
}

function resolveCredentials(
  config: KmsSignerConfig,
): ReturnType<typeof fromTokenFile> | undefined {
  // EKS provides pod credentials via IRSA (web identity token). Otherwise fall
  // back to the default AWS provider chain (env keys).
  return config.webIdentityTokenFile ? fromTokenFile() : undefined;
}

/**
 * Signs billing webhook tokens with an asymmetric AWS KMS key
 * (`ECC_NIST_P256`, `ECDSA_SHA_256`). The private key never leaves KMS.
 *
 * Used only by the provisioning CLI, so it is a plain class (no NestJS DI).
 */
export class AwsKmsSignerService implements IKmsSigner {
  private readonly client: KMSClient;

  constructor(private readonly config: KmsSignerConfig) {
    this.client = new KMSClient({ credentials: resolveCredentials(config) });
  }

  async sign(message: Buffer): Promise<Buffer> {
    const response = await this.client.send(
      new SignCommand({
        KeyId: this.config.keyId,
        Message: message,
        // RAW: KMS applies SHA-256. The JWS signing input is well under the
        // 4 KB raw-message limit.
        MessageType: 'RAW',
        SigningAlgorithm: 'ECDSA_SHA_256',
      }),
    );
    if (!response.Signature) {
      throw new Error('KMS did not return a signature');
    }
    return Buffer.from(response.Signature);
  }

  async getPublicKey(): Promise<Buffer> {
    const response = await this.client.send(
      new GetPublicKeyCommand({ KeyId: this.config.keyId }),
    );
    if (!response.PublicKey) {
      throw new Error('KMS did not return a public key');
    }
    return Buffer.from(response.PublicKey);
  }
}
