// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { ICosignerSigner } from '@/modules/cloud-cosigner/domain/signers/cosigner-signer.interface';

/**
 * Development signer backed by `CLOUD_COSIGNER_PRIVATE_KEY`. The configuration
 * schema refuses that variable in production and staging.
 */
@Injectable()
export class LocalCosignerSigner implements ICosignerSigner {
  private readonly account: ReturnType<typeof privateKeyToAccount>;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    const privateKey = this.configurationService.getOrThrow<Hex>(
      'cloudCosigner.signer.privateKey',
    );
    this.account = privateKeyToAccount(privateKey);
  }

  public getAddress(): Promise<Address> {
    return Promise.resolve(this.account.address);
  }

  public signHash(hash: Hex): Promise<Hex> {
    return this.account.sign({ hash });
  }
}
