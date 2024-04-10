import { toSignableSiweMessage } from '@/datasources/auth-api/utils/to-signable-siwe-message';
import { siweMessageBuilder } from '@/domain/siwe/entities/__tests__/siwe-message.builder';
import { faker } from '@faker-js/faker';

describe('toSignableSiweMessage', () => {
  it('should return a signable message with all fields', () => {
    const message = siweMessageBuilder()
      .with('resources', [
        faker.internet.url(),
        faker.internet.url(),
        faker.internet.url(),
      ])
      .build();

    const result = toSignableSiweMessage(message);

    // Origin is built correctly from scheme and domain
    expect(result)
      .toBe(`${message.scheme}://${message.domain} wants you to sign in with your Ethereum account:
${message.address}

${message.statement}

URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}
Expiration Time: ${message.expirationTime}
Not Before: ${message.notBefore}
Request ID: ${message.requestId}
Resources:
- ${message.resources![0]}
- ${message.resources![1]}
- ${message.resources![2]}`);
  });

  describe('statement', () => {
    it('should add a new line before and after the statement', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', faker.lorem.sentence())
        .with('expirationTime', undefined)
        .with('notBefore', undefined)
        .with('requestId', undefined)
        .with('resources', undefined)
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}

${message.statement}

URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}`);
    });

    it('should not add an empty statement', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', '')
        .with('expirationTime', undefined)
        .with('notBefore', undefined)
        .with('requestId', undefined)
        .with('resources', undefined)
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}`);
    });
  });

  describe('expirationTime', () => {
    it('should add the expirationTime if present', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', faker.date.recent().toISOString())
        .with('notBefore', undefined)
        .with('requestId', undefined)
        .with('resources', undefined)
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}
Expiration Time: ${message.expirationTime}`);
    });

    it('should not add an empty expirationTime', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', '')
        .with('notBefore', undefined)
        .with('requestId', undefined)
        .with('resources', undefined)
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}`);
    });
  });

  describe('notBefore', () => {
    it('should add the notBefore time if present', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', undefined)
        .with('notBefore', faker.date.recent().toISOString())
        .with('requestId', undefined)
        .with('resources', undefined)
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}
Not Before: ${message.notBefore}`);
    });

    it('should not add an empty notBefore', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', undefined)
        .with('notBefore', '')
        .with('requestId', undefined)
        .with('resources', undefined)
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}`);
    });
  });

  describe('requestId', () => {
    it('should add the requestId if present', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', undefined)
        .with('notBefore', undefined)
        .with('requestId', faker.string.uuid())
        .with('resources', undefined)
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}
Request ID: ${message.requestId}`);
    });

    it('should not add an empty requestId', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', undefined)
        .with('notBefore', undefined)
        .with('requestId', '')
        .with('resources', undefined)
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}`);
    });
  });

  describe('resources', () => {
    it('should add each resource on a new line if present', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', undefined)
        .with('notBefore', undefined)
        .with('requestId', undefined)
        .with('resources', [
          faker.internet.url(),
          faker.internet.url(),
          faker.internet.url(),
        ])
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}
Resources:
- ${message.resources![0]}
- ${message.resources![1]}
- ${message.resources![2]}`);
    });

    it('should not add empty resources', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', undefined)
        .with('notBefore', undefined)
        .with('requestId', undefined)
        .with('resources', [])
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}`);
    });

    it('should filter empty resources', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', undefined)
        .with('notBefore', undefined)
        .with('requestId', undefined)
        .with('resources', [''])
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}`);
    });

    it('should filter empty resources', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('statement', undefined)
        .with('expirationTime', undefined)
        .with('notBefore', undefined)
        .with('requestId', undefined)
        .with('resources', [faker.internet.url(), '', faker.internet.url()])
        .build();

      const result = toSignableSiweMessage(message);

      expect(result)
        .toBe(`${message.domain} wants you to sign in with your Ethereum account:
${message.address}
URI: ${message.uri}
Version: ${message.version}
Chain ID: ${message.chainId}
Nonce: ${message.nonce}
Issued At: ${message.issuedAt}
Resources:
- ${message.resources![0]}
- ${message.resources![2]}`);
    });
  });
});
