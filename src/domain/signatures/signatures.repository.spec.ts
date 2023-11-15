import { ISignaturesRepository } from '@/domain/signatures/signatures.repository.interface';
import { SignaturesRepository } from '@/domain/signatures/signatures.repository';
import { verifyMessage } from 'viem';

describe('Signatures Repository tests', () => {
  let target: ISignaturesRepository;

  beforeEach(() => {
    target = new SignaturesRepository();
  });

  it('foo', async () => {
    const message = 'hello world';
    const address = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
    const signature =
      '0x66edc32e2ab001213321ab7d959a2207fcef5190cc9abb6da5b0d2a8a9af2d4d2b0700e2c317c4106f337fd934fbbb0bf62efc8811a78603b33a8265d3b8f8cb1c';

    const lol = await verifyMessage({
      address: '0x3FCf42e10CC70Fe75A62EB3aDD6D305Aa840d145',
      message: 'This is a test message for viem!',
      signature:
        '0xefd5fb29a274ea6682673d8b3caa9263e936d48d486e5df68893003e0a76496439594d12245008c6fba1c8e3ef28241cffe1bef27ff6bca487b167f261f329251c',
    });

    const actual = await target.verifySignature({
      address,
      message,
      signature,
    });

    expect(actual).toBeTruthy();
  });
});
