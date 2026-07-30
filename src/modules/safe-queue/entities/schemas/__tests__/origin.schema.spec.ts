// SPDX-License-Identifier: FSL-1.1-MIT

import { safeQueueMultisigTransactionBuilder } from '@/modules/safe-queue/entities/__tests__/queue-multisig-transaction.builder';
import { SafeQueueMultisigTransactionListSchema } from '@/modules/safe-queue/entities/multisig-transaction.entity';
import {
  OriginNameSchema,
  OriginUrlSchema,
} from '@/modules/safe-queue/entities/schemas/origin.schema';

describe('OriginNameSchema', () => {
  it('accepts a normal string', () => {
    expect(OriginNameSchema.parse('Uniswap')).toBe('Uniswap');
  });

  it('defaults to null when missing', () => {
    expect(OriginNameSchema.parse(undefined)).toBeNull();
  });

  it('coerces an oversized name to null', () => {
    const oversized = 'a'.repeat(257);
    expect(OriginNameSchema.parse(oversized)).toBeNull();
  });

  it('coerces a non-string value to null', () => {
    expect(OriginNameSchema.parse(123 as unknown)).toBeNull();
  });
});

describe('OriginUrlSchema', () => {
  it('accepts an https URL', () => {
    expect(OriginUrlSchema.parse('https://app.example.com')).toBe(
      'https://app.example.com',
    );
  });

  it('defaults to null when missing', () => {
    expect(OriginUrlSchema.parse(undefined)).toBeNull();
  });

  it('coerces a javascript: URL to null', () => {
    expect(OriginUrlSchema.parse('javascript:alert(1)')).toBeNull();
  });

  it('coerces a data: URL to null', () => {
    expect(
      OriginUrlSchema.parse('data:text/html,<script>1</script>'),
    ).toBeNull();
  });

  it('coerces a non-URL string to null', () => {
    expect(OriginUrlSchema.parse('not a url')).toBeNull();
  });

  it('accepts an http URL', () => {
    expect(OriginUrlSchema.parse('http://app.example.com')).toBe(
      'http://app.example.com',
    );
  });

  it('coerces an oversized URL to null', () => {
    const oversized = `https://example.com/${'a'.repeat(2048)}`;
    expect(OriginUrlSchema.parse(oversized)).toBeNull();
  });
});

describe('queue entity parsing with bad origin fields', () => {
  it('keeps a row but coerces its bad origin URL to null without poisoning the batch', () => {
    const good = safeQueueMultisigTransactionBuilder()
      .with('originName', 'AppOk')
      .with('originUrl', 'https://ok.example')
      .build();
    const bad = safeQueueMultisigTransactionBuilder()
      .with('originName', 'AppBad')
      .with('originUrl', 'javascript:alert(1)' as unknown as string)
      .build();

    const parsed = SafeQueueMultisigTransactionListSchema.parse([good, bad]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].originUrl).toBe('https://ok.example');
    expect(parsed[1].originUrl).toBeNull();
    expect(parsed[1].originName).toBe('AppBad');
  });
});
