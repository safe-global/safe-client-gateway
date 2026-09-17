// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { safeQueueMultisigTransactionBuilder } from '@/modules/safe-queue/entities/__tests__/queue-multisig-transaction.builder';
import { ProposalRoute } from '@/modules/safe-queue/entities/proposal-route.entity';
import { mapSafeQueueToMultisigTransaction } from '@/modules/safe-queue/mappers/transaction.mapper';

describe('mapSafeQueueToMultisigTransaction', () => {
  it('embeds the note into the origin JSON so it can be extracted downstream', () => {
    const note = faker.lorem.sentence();
    const originName = faker.company.name();
    const originUrl = faker.internet.url({ appendSlash: false });
    const tx = safeQueueMultisigTransactionBuilder()
      .with('notes', note)
      .with('originName', originName)
      .with('originUrl', originUrl)
      .build();
    const safe = safeBuilder().build();

    const result = mapSafeQueueToMultisigTransaction(tx, safe);

    expect(result.origin).not.toBeNull();
    expect(JSON.parse(result.origin as string)).toMatchObject({
      name: originName,
      url: originUrl,
      note,
    });
  });

  it('embeds the note even when origin name and url are absent', () => {
    const note = faker.lorem.sentence();
    const tx = safeQueueMultisigTransactionBuilder()
      .with('notes', note)
      .with('originName', null)
      .with('originUrl', null)
      .build();
    const safe = safeBuilder().build();

    const result = mapSafeQueueToMultisigTransaction(tx, safe);

    expect(JSON.parse(result.origin as string)).toMatchObject({ note });
  });

  it('returns a null origin when neither origin fields nor note are present', () => {
    const tx = safeQueueMultisigTransactionBuilder()
      .with('notes', null)
      .with('originName', null)
      .with('originUrl', null)
      .build();
    const safe = safeBuilder().build();

    const result = mapSafeQueueToMultisigTransaction(tx, safe);

    expect(result.origin).toBeNull();
  });

  it('does not leak queue-only fields onto the mapped MultisigTransaction', () => {
    const tx = safeQueueMultisigTransactionBuilder()
      .with('confirmations', [
        {
          owner: faker.finance.ethereumAddress() as `0x${string}`,
          signature: faker.string.hexadecimal({ length: 130 }) as `0x${string}`,
          signatureType: SignatureType.Eoa,
          created: faker.date.recent(),
          modified: faker.date.recent(),
        },
      ])
      .build();
    const safe = safeBuilder().build();

    const result = mapSafeQueueToMultisigTransaction(tx, safe);

    expect(result).not.toHaveProperty('chainId');
    expect(result).not.toHaveProperty('notes');
    expect(result).not.toHaveProperty('originName');
    expect(result).not.toHaveProperty('originUrl');
    expect(result).not.toHaveProperty('txHash');
    expect(result).not.toHaveProperty('proposedBy');
    expect(result).not.toHaveProperty('proposedVia');
    expect(result.confirmations?.[0]).not.toHaveProperty('created');
    expect(result.confirmations?.[0]).not.toHaveProperty('modified');
  });

  describe('proposer fields', () => {
    it('surfaces the signer as proposedByDelegate on the DELEGATE route', () => {
      const delegator = getAddress(faker.finance.ethereumAddress());
      const delegate = getAddress(faker.finance.ethereumAddress());
      const tx = safeQueueMultisigTransactionBuilder()
        .with('proposer', delegator)
        .with('proposedBy', delegate)
        .with('proposedVia', ProposalRoute.Delegate)
        .build();
      const safe = safeBuilder().build();

      const result = mapSafeQueueToMultisigTransaction(tx, safe);

      expect(result.proposer).toBe(delegator);
      expect(result.proposedByDelegate).toBe(delegate);
    });

    it('does not surface the nested owner EOA as a delegate on the NESTED_OWNER route', () => {
      const ownerSafe = getAddress(faker.finance.ethereumAddress());
      const nestedOwner = getAddress(faker.finance.ethereumAddress());
      const tx = safeQueueMultisigTransactionBuilder()
        .with('proposer', ownerSafe)
        .with('proposedBy', nestedOwner)
        .with('proposedVia', ProposalRoute.NestedOwner)
        .build();
      const safe = safeBuilder().build();

      const result = mapSafeQueueToMultisigTransaction(tx, safe);

      expect(result.proposer).toBe(ownerSafe);
      expect(result.proposedByDelegate).toBeNull();
    });

    it('keeps the owner as proposer with no delegate on the OWNER route', () => {
      const owner = getAddress(faker.finance.ethereumAddress());
      const tx = safeQueueMultisigTransactionBuilder()
        .with('proposer', owner)
        .with('proposedBy', null)
        .with('proposedVia', ProposalRoute.Owner)
        .build();
      const safe = safeBuilder().build();

      const result = mapSafeQueueToMultisigTransaction(tx, safe);

      expect(result.proposer).toBe(owner);
      expect(result.proposedByDelegate).toBeNull();
    });

    it('maps a legacy UNKNOWN route to null proposer fields', () => {
      const tx = safeQueueMultisigTransactionBuilder()
        .with('proposer', null)
        .with('proposedBy', null)
        .with('proposedVia', ProposalRoute.Unknown)
        .build();
      const safe = safeBuilder().build();

      const result = mapSafeQueueToMultisigTransaction(tx, safe);

      expect(result.proposer).toBeNull();
      expect(result.proposedByDelegate).toBeNull();
    });
  });
});
