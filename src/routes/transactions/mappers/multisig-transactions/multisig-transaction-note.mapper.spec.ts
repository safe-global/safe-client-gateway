import { faker } from '@faker-js/faker';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { MultisigTransactionNoteMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-note.mapper';

const mapper = new MultisigTransactionNoteMapper();

describe('Multisig Transaction note mapper (Unit)', () => {
  it('should parse transaction `origin` and return a note', () => {
    const noteText = faker.lorem.sentence();
    const transaction = multisigTransactionBuilder()
      .with(
        'origin',
        JSON.stringify({ name: JSON.stringify({ note: noteText }) }),
      )
      .build();

    const note = mapper.mapTxNote(transaction);

    expect(note).toBe(noteText);
  });

  it('should return undefined if `origin` is not a valid JSON', () => {
    const transaction = multisigTransactionBuilder()
      .with('origin', 'invalid-json')
      .build();

    const note = mapper.mapTxNote(transaction);

    expect(note).toBeUndefined();
  });

  it('should return undefined if `origin` does not contain a note', () => {
    const transaction = multisigTransactionBuilder()
      .with('origin', '{"url":"uniswap.org","name":"Uniswap"}')
      .build();

    const note = mapper.mapTxNote(transaction);

    expect(note).toBeUndefined();
  });

  it('should return undefined if `origin` is null', () => {
    const transaction = multisigTransactionBuilder()
      .with('origin', null)
      .build();

    const note = mapper.mapTxNote(transaction);

    expect(note).toBeUndefined();
  });
});
