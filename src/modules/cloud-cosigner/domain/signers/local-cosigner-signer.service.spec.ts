// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { keccak256, recoverAddress, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { SafeSignature } from '@/domain/common/entities/safe-signature';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { LocalCosignerSigner } from '@/modules/cloud-cosigner/domain/signers/local-cosigner-signer.service';

describe('LocalCosignerSigner', () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  let signer: LocalCosignerSigner;

  beforeEach(() => {
    const configurationService = new FakeConfigurationService();
    configurationService.set('cloudCosigner.signer.privateKey', privateKey);
    signer = new LocalCosignerSigner(configurationService);
  });

  it('should expose the address of the configured key', async () => {
    await expect(signer.getAddress()).resolves.toBe(account.address);
  });

  it('should produce an EOA signature the Safe verifier recovers', async () => {
    const hash = keccak256(toHex(faker.string.alphanumeric(32)));

    const signature = await signer.signHash(hash);

    await expect(recoverAddress({ hash, signature })).resolves.toBe(
      account.address,
    );
    const safeSignature = new SafeSignature({ signature, hash });
    expect(safeSignature.signatureType).toBe(SignatureType.Eoa);
    expect(safeSignature.owner).toBe(account.address);
  });

  it('should fail to construct without a private key', () => {
    expect(
      () => new LocalCosignerSigner(new FakeConfigurationService()),
    ).toThrow('No value set for key cloudCosigner.signer.privateKey');
  });
});
