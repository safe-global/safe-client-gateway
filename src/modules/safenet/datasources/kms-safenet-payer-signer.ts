// SPDX-License-Identifier: FSL-1.1-MIT
import {
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
} from '@aws-sdk/client-kms';
import { Inject, Injectable } from '@nestjs/common';
import { secp256k1 } from '@noble/curves/secp256k1';
import {
  type Address,
  bytesToHex,
  type Hex,
  hexToBytes,
  isAddressEqual,
} from 'viem';
import { publicKeyToAddress } from 'viem/utils';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { resolveAwsCredentials } from '#/datasources/common/utils/aws-credentials.utils';
import type * as Signer from '#/modules/safenet/domain/interfaces/safenet-payer-signer.interface';

/** Signs digests with an AWS KMS `ECC_SECG_P256K1` key. The key loads on first use. */
@Injectable()
export class KmsSafenetPayerSigner implements Signer.ISafenetPayerSigner {
  private readonly client: KMSClient;
  private readonly keyId: string;
  private address: Promise<Address> | undefined;

  constructor(@Inject(IConfigurationService) config: IConfigurationService) {
    this.keyId = config.getOrThrow('safenet.payer.kms.keyId');
    const connectionTimeout = config.getOrThrow<number>(
      'safenet.payer.kms.connectionTimeoutMs',
    );
    this.client = new KMSClient({
      maxAttempts: 1, // BullMQ owns retries; an SDK retry would repeat the KMS call.
      credentials: resolveAwsCredentials(
        config.get<string>('safenet.payer.kms.webIdentityTokenFile'),
      ),
      requestHandler: {
        connectionTimeout,
        requestTimeout: config.getOrThrow<number>(
          'safenet.payer.kms.requestTimeoutMs',
        ),
        throwOnRequestTimeout: true,
        socketTimeout: connectionTimeout,
      },
    });
  }

  getAddress(): Promise<Address> {
    this.address ??= this.loadAddress().catch((error: unknown) => {
      this.address = undefined;
      throw error;
    });
    return this.address;
  }

  /** Signs the digest without an Ethereum message prefix. */
  async signHash(hash: Hex): Promise<Hex> {
    const address = await this.getAddress();
    const digest = hexToBytes(hash);
    const { Signature } = await this.client.send(
      new SignCommand({
        KeyId: this.keyId,
        Message: digest,
        MessageType: 'DIGEST',
        SigningAlgorithm: 'ECDSA_SHA_256',
      }),
    );
    if (!Signature) {
      throw new Error('KMS did not return a signature');
    }
    // KMS can return either s; normalise to low-s like standard secp256k1 signers.
    const sig = secp256k1.Signature.fromDER(Signature).normalizeS();
    const recovery = [0, 1].find((bit) => {
      const point = sig.addRecoveryBit(bit).recoverPublicKey(digest);
      return isAddressEqual(
        publicKeyToAddress(`0x${point.toHex(false)}`),
        address,
      );
    });
    if (recovery === undefined) {
      throw new Error('KMS signature does not recover to the KMS key address');
    }
    return `0x${sig.toCompactHex()}${(27 + recovery).toString(16)}`;
  }

  private async loadAddress(): Promise<Address> {
    const key = await this.client.send(
      new GetPublicKeyCommand({ KeyId: this.keyId }),
    );
    if (!key.PublicKey) {
      throw new Error('KMS did not return a public key');
    }
    // The SPKI DER ends with the uncompressed point 04 || X || Y.
    const point = key.PublicKey.slice(-65);
    return publicKeyToAddress(bytesToHex(point));
  }
}
