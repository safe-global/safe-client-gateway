// SPDX-License-Identifier: FSL-1.1-MIT
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import { buildSiweMessageSchema } from '@/modules/siwe/domain/entities/siwe-message.entity';

describe('buildSiweMessageSchema', () => {
  const SKEW_SECONDS = 30;
  const schema = buildSiweMessageSchema(SKEW_SECONDS);

  function issues(s: typeof schema, message: unknown): Array<string> {
    const result = s.safeParse(message);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  }

  it('validates a well-formed message', () => {
    const message = siweMessageBuilder().build();

    expect(schema.safeParse(message).success).toBe(true);
  });

  // The schema tolerates the configured clock skew between the client that
  // signed the message and this server, so legitimate messages are not rejected
  // when the two wall clocks are slightly out of sync.
  describe('clock-skew tolerance on time bounds', () => {
    it('accepts an issuedAt within the tolerated skew in the future', () => {
      const message = siweMessageBuilder()
        .with('issuedAt', new Date(Date.now() + (SKEW_SECONDS - 5) * 1_000))
        .build();

      expect(issues(schema, message)).not.toContain('Message yet issued');
    });

    it('rejects an issuedAt beyond the tolerated skew in the future', () => {
      const message = siweMessageBuilder()
        .with('issuedAt', new Date(Date.now() + (SKEW_SECONDS + 30) * 1_000))
        .build();

      expect(issues(schema, message)).toContain('Message yet issued');
    });

    it('accepts an expirationTime that lapsed within the tolerated skew', () => {
      const message = siweMessageBuilder()
        .with(
          'expirationTime',
          new Date(Date.now() - (SKEW_SECONDS - 5) * 1_000),
        )
        .build();

      expect(issues(schema, message)).not.toContain('Message has expired');
    });

    it('rejects an expirationTime beyond the tolerated skew in the past', () => {
      const message = siweMessageBuilder()
        .with(
          'expirationTime',
          new Date(Date.now() - (SKEW_SECONDS + 30) * 1_000),
        )
        .build();

      expect(issues(schema, message)).toContain('Message has expired');
    });

    it('accepts a notBefore within the tolerated skew in the future', () => {
      const message = siweMessageBuilder()
        .with('notBefore', new Date(Date.now() + (SKEW_SECONDS - 5) * 1_000))
        .build();

      expect(issues(schema, message)).not.toContain('Message yet valid');
    });

    it('rejects a notBefore beyond the tolerated skew in the future', () => {
      const message = siweMessageBuilder()
        .with('notBefore', new Date(Date.now() + (SKEW_SECONDS + 30) * 1_000))
        .build();

      expect(issues(schema, message)).toContain('Message yet valid');
    });

    it('honors the configured skew value', () => {
      // 20s in the future: accepted under a 30s skew, rejected under a 5s skew.
      const message = siweMessageBuilder()
        .with('issuedAt', new Date(Date.now() + 20_000))
        .build();

      expect(issues(buildSiweMessageSchema(30), message)).not.toContain(
        'Message yet issued',
      );
      expect(issues(buildSiweMessageSchema(5), message)).toContain(
        'Message yet issued',
      );
    });
  });
});
