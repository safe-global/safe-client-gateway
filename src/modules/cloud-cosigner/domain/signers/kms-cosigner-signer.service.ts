// SPDX-License-Identifier: FSL-1.1-MIT
import {
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
} from '@aws-sdk/client-kms';
import { Inject, Injectable } from '@nestjs/common';
import { type Address, type Hex, hexToBytes } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { resolveAwsCredentials } from '@/datasources/common/utils/aws-credentials.utils';
import type { ICosignerSigner } from '@/modules/cloud-cosigner/domain/signers/cosigner-signer.interface';
import {
  derToRs,
  spkiToAddress,
  toEoaSignature,
} from '@/modules/cloud-cosigner/domain/signers/kms-signature.utils';

/**
 * Deployed-environment signer: an `ECC_SECG_P256K1` asymmetric KMS key whose
 * private half never leaves KMS. The digest is signed as-is (`MessageType:
 * DIGEST`) since the Safe transaction hash is already a 32-byte keccak.
 */
@Injectable()
export class KmsCosignerSigner implements ICosignerSigner {
  private readonly client: KMSClient;
  private readonly keyId: string;
  private address: Address | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.keyId = this.configurationService.getOrThrow<string>(
      'cloudCosigner.signer.kms.keyId',
    );
    this.client = new KMSClient({
      credentials: resolveAwsCredentials(
        this.configurationService.get<string>(
          'cloudCosigner.signer.kms.webIdentityTokenFile',
        ),
      ),
    });
  }

  public async getAddress(): Promise<Address> {
    if (!this.address) {
      const response = await this.client.send(
        new GetPublicKeyCommand({ KeyId: this.keyId }),
      );
      if (!response.PublicKey) {
        throw new Error('KMS did not return a public key');
      }
      this.address = spkiToAddress(response.PublicKey);
    }
    return this.address;
  }

  public async signHash(hash: Hex): Promise<Hex> {
    const [address, response] = await Promise.all([
      this.getAddress(),
      this.client.send(
        new SignCommand({
          KeyId: this.keyId,
          Message: hexToBytes(hash),
          MessageType: 'DIGEST',
          SigningAlgorithm: 'ECDSA_SHA_256',
        }),
      ),
    ]);
    if (!response.Signature) {
      throw new Error('KMS did not return a signature');
    }
    const { r, s } = derToRs(response.Signature);
    return toEoaSignature({ r, s, hash, expectedSigner: address });
  }
}
