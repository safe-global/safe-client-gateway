// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { queueMultisigTransactionBuilder } from '@/modules/queue/entities/__tests__/queue-multisig-transaction.builder';
import { mapQueueToMultisigTransaction } from '@/modules/queue/mappers/transaction.mapper';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';

describe('mapQueueToMultisigTransaction', () => {
  it('embeds the note into the origin JSON so it can be extracted downstream', () => {
    const note = faker.lorem.sentence();
    const originName = faker.company.name();
    const originUrl = faker.internet.url({ appendSlash: false });
    const tx = queueMultisigTransactionBuilder()
      .with('notes', note)
      .with('originName', originName)
      .with('originUrl', originUrl)
      .build();
    const safe = safeBuilder().build();

    const result = mapQueueToMultisigTransaction(tx, safe);

    expect(result.origin).not.toBeNull();
    expect(JSON.parse(result.origin as string)).toMatchObject({
      name: originName,
      url: originUrl,
      note,
    });
  });

  it('embeds the note even when origin name and url are absent', () => {
    const note = faker.lorem.sentence();
    const tx = queueMultisigTransactionBuilder()
      .with('notes', note)
      .with('originName', null)
      .with('originUrl', null)
      .build();
    const safe = safeBuilder().build();

    const result = mapQueueToMultisigTransaction(tx, safe);

    expect(JSON.parse(result.origin as string)).toMatchObject({ note });
  });

  it('returns a null origin when neither origin fields nor note are present', () => {
    const tx = queueMultisigTransactionBuilder()
      .with('notes', null)
      .with('originName', null)
      .with('originUrl', null)
      .build();
    const safe = safeBuilder().build();

    const result = mapQueueToMultisigTransaction(tx, safe);

    expect(result.origin).toBeNull();
  });
});
