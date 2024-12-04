import { z } from 'zod';

export const EncryptedBlobSchema = z.object({
  encryptedData: z.instanceof(Buffer),
  encryptedDataKey: z.instanceof(Buffer),
  iv: z.instanceof(Buffer),
});

export class EncryptedBlob {
  encryptedData: Buffer;
  encryptedDataKey: Buffer;
  iv: Buffer;

  constructor(props: EncryptedBlob) {
    this.encryptedData = props.encryptedData;
    this.encryptedDataKey = props.encryptedDataKey;
    this.iv = props.iv;
  }
}
