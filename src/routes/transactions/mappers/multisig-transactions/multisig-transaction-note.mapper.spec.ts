import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { MultisigTransactionNoteMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-note.mapper';

const mapper = new MultisigTransactionNoteMapper();

describe('Multisig Transaction note mapper (Unit)', () => {
  it('should parse transaction `origin` and return a note', () => {
    const transaction = multisigTransactionBuilder()
      .with('origin', '{"name":"{\\"note\\":\\"This is a note\\"}"}')
      .build();

    const note = mapper.mapTxNote(transaction);

    expect(note).toBe('This is a note');
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
