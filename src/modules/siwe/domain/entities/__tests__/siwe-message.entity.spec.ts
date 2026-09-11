// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import { buildSiweMessageSchema } from '@/modules/siwe/domain/entities/siwe-message.entity';

describe('buildSiweMessageSchema', () => {
  const SKEW_SECONDS = 30;
  const schema = buildSiweMessageSchema({ clockSkewSeconds: SKEW_SECONDS });

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

      expect(issues(schema, message)).not.toContain('Message not yet issued');
    });

    it('rejects an issuedAt beyond the tolerated skew in the future', () => {
      const message = siweMessageBuilder()
        .with('issuedAt', new Date(Date.now() + (SKEW_SECONDS + 30) * 1_000))
        .build();

      expect(issues(schema, message)).toContain('Message not yet issued');
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

      expect(issues(schema, message)).not.toContain('Message not yet valid');
    });

    it('rejects a notBefore beyond the tolerated skew in the future', () => {
      const message = siweMessageBuilder()
        .with('notBefore', new Date(Date.now() + (SKEW_SECONDS + 30) * 1_000))
        .build();

      expect(issues(schema, message)).toContain('Message not yet valid');
    });

    it('honors the configured skew value', () => {
      // 20s in the future: accepted under a 30s skew, rejected under a 5s skew.
      const message = siweMessageBuilder()
        .with('issuedAt', new Date(Date.now() + 20_000))
        .build();

      expect(
        issues(buildSiweMessageSchema({ clockSkewSeconds: 30 }), message),
      ).not.toContain('Message not yet issued');
      expect(
        issues(buildSiweMessageSchema({ clockSkewSeconds: 5 }), message),
      ).toContain('Message not yet issued');
    });
  });

  // A signature is only meaningful for the origin that requested it, so a
  // message bound to another origin is rejected where the allow list is set.
  describe('domain binding', () => {
    const allowedDomain = faker.internet.domainName();
    const boundSchema = buildSiweMessageSchema({
      clockSkewSeconds: SKEW_SECONDS,
      allowedDomains: [allowedDomain],
    });

    it('accepts a message bound to an allowed domain', () => {
      const message = siweMessageBuilder()
        .with('domain', allowedDomain)
        .with('uri', `https://${allowedDomain}/login`)
        .build();

      expect(boundSchema.safeParse(message).success).toBe(true);
    });

    it('rejects a message bound to another domain', () => {
      const message = siweMessageBuilder().build();

      expect(issues(boundSchema, message)).toContain('Invalid domain');
    });

    it('rejects a URI pointing at another domain', () => {
      const message = siweMessageBuilder()
        .with('domain', allowedDomain)
        .with('uri', faker.internet.url({ appendSlash: false }))
        .build();

      expect(issues(boundSchema, message)).toContain('Invalid URI');
    });

    it('rejects a URI that is not a valid URL', () => {
      const message = siweMessageBuilder()
        .with('domain', allowedDomain)
        .with('uri', faker.string.alphanumeric({ length: 10 }))
        .build();

      expect(issues(boundSchema, message)).toContain('Invalid URI');
    });

    it('does not check the domain when no domain is allow listed', () => {
      const message = siweMessageBuilder().build();

      expect(issues(schema, message)).toHaveLength(0);
    });
  });
});
