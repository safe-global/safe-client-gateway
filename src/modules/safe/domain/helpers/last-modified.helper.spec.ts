// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { getLastModified } from '@/modules/safe/domain/helpers/last-modified.helper';

describe('getLastModified', () => {
  it('should return the modified date when it is newer than every confirmation', () => {
    const modified = faker.date.recent();
    const transaction = multisigTransactionBuilder()
      .with('modified', modified)
      .with('confirmations', [
        confirmationBuilder()
          .with('submissionDate', faker.date.past({ refDate: modified }))
          .build(),
      ])
      .build();

    expect(getLastModified(transaction)).toEqual(modified);
  });

  it('should return the newest confirmation submission date when it is newer than modified', () => {
    const modified = faker.date.past();
    const newest = faker.date.future({ refDate: modified });
    const transaction = multisigTransactionBuilder()
      .with('modified', modified)
      .with('confirmations', [
        confirmationBuilder()
          .with(
            'submissionDate',
            faker.date.between({ from: modified, to: newest }),
          )
          .build(),
        confirmationBuilder().with('submissionDate', newest).build(),
      ])
      .build();

    expect(getLastModified(transaction)).toEqual(newest);
  });

  it('should fall back to the confirmations when modified is null', () => {
    const submissionDate = faker.date.recent();
    const transaction = multisigTransactionBuilder()
      .with('modified', null)
      .with('confirmations', [
        confirmationBuilder().with('submissionDate', submissionDate).build(),
      ])
      .build();

    expect(getLastModified(transaction)).toEqual(submissionDate);
  });

  it('should return null when there is neither a modified date nor a confirmation', () => {
    const transaction = multisigTransactionBuilder()
      .with('modified', null)
      .with('confirmations', null)
      .build();

    expect(getLastModified(transaction)).toBeNull();
  });
});
