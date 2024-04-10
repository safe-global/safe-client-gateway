import { SiweMessage } from '@/domain/siwe/entities/siwe-message.entity';

/**
 * The following adheres to the EIP-4361 (SiWe) standard
 * {@link https://eips.ethereum.org/EIPS/eip-4361}
 */
export function toSignableSiweMessage(message: SiweMessage): string {
  const lines = [];

  const origin = message.scheme
    ? `${message.scheme}://${message.domain}`
    : message.domain;

  lines.push(
    `${origin} wants you to sign in with your Ethereum account:`,
    message.address,
  );

  if (message.statement) {
    // Ensure new line above and below statement
    lines.push('', message.statement, '');
  }

  lines.push(
    `URI: ${message.uri}`,
    `Version: ${message.version}`,
    `Chain ID: ${message.chainId}`,
    `Nonce: ${message.nonce}`,
    `Issued At: ${message.issuedAt}`,
  );

  if (message.expirationTime) {
    lines.push(`Expiration Time: ${message.expirationTime}`);
  }

  if (message.notBefore) {
    lines.push(`Not Before: ${message.notBefore}`);
  }

  if (message.requestId) {
    lines.push(`Request ID: ${message.requestId}`);
  }

  if (Array.isArray(message.resources) && message.resources.length > 0) {
    const resources = message.resources.filter(Boolean);

    if (resources.length > 0) {
      lines.push('Resources:', ...resources.map((resource) => `- ${resource}`));
    }
  }

  return lines.join('\n');
}
