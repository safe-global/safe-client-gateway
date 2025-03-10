import { faker } from '@faker-js/faker';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { MultisigTransactionNoteMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-note.mapper';

const mapper = new MultisigTransactionNoteMapper();

describe('Multisig Transaction note mapper (Unit)', () => {
  it('should parse transaction `origin` and return a note', () => {
    const noteText = faker.lorem.sentence();
    const transaction = multisigTransactionBuilder()
      .with('origin', JSON.stringify({ note: noteText }))
      .build();

    const note = mapper.mapTxNote(transaction);

    expect(note).toBe(noteText);
  });

  it('should parse transaction `origin` and return a valid note', () => {
    const noteText = `<script>document.write('<img src=s onerror=alert("Hello World")>')</script>`;
    const noteText2 = `<script>&#97;&#108;&#101;&#114;&#116;('Hello World')</script>`;
    const transaction = multisigTransactionBuilder()
      .with('origin', JSON.stringify({ note: noteText }))
      .build();
    const transaction2 = multisigTransactionBuilder()
      .with('origin', JSON.stringify({ note: noteText2 }))
      .build();

    const note = mapper.mapTxNote(transaction);
    const note2 = mapper.mapTxNote(transaction2);

    expect(note).toBe('');
    expect(note2).toBe('');
  });

  it('should return undefined if `origin` is not a valid JSON', () => {
    const transaction = multisigTransactionBuilder()
      .with('origin', 'invalid-json')
      .build();

    const note = mapper.mapTxNote(transaction);

    expect(note).toBeNull();
  });

  it('should return undefined if `origin` does not contain a note', () => {
    const transaction = multisigTransactionBuilder()
      .with(
        'origin',
        JSON.stringify({ name: faker.word.noun(), url: faker.internet.url() }),
      )
      .build();

    const note = mapper.mapTxNote(transaction);

    expect(note).toBeNull();
  });

  it('should return undefined if `origin` is null', () => {
    const transaction = multisigTransactionBuilder()
      .with('origin', null)
      .build();

    const note = mapper.mapTxNote(transaction);

    expect(note).toBeNull();
  });
});
