import { ISignaturesRepository } from '@/domain/signatures/signatures.repository.interface';
import { SignaturesRepository } from '@/domain/signatures/signatures.repository';

describe('Signatures Repository tests', () => {
  let target: ISignaturesRepository;

  beforeEach(() => {
    target = new SignaturesRepository();
  });

  it('verify message is successful', async () => {
    const message = 'test message';
    const address = '0x21509ab252a92b180c539e4d84ea1406f0f87fb8';
    const signature =
      '0xb33304b4cf11dd739154245adca598a33e3aac33c5af1d2a6be49bae7572818d1106305c34d6af24be2551a3d7ab958203b372c012177b15bf2bd108efe02a981b';

    const actual = await target.verifySignature({
      address,
      message,
      signature,
    });

    expect(actual).toBeTruthy();
  });

  it('verify message is not successful', async () => {
    const message = 'test message';
    const address = '0x23509ab252a92b180c539e4d84ea1406f0f87fb8';
    const invalidSignature =
      '0xb33304b4cf11dd739154245adca598a33e3aac33c5af1d2a6be49bae7572818d1106305c34d6af24be2551a3d7ab958203b372c012177b15bf2bd108efe02a981b';

    const actual = await target.verifySignature({
      address,
      message,
      signature: invalidSignature,
    });

    expect(actual).toBeFalsy();
  });
});
