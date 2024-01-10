import { Chain } from '@/routes/chains/entities/chain.entity';

export const IEmailTemplate = Symbol('IEmailTemplate');

/**
 * Templates are required (but used sparingly) as some providers don't support
 * JavaScript or arrays passed as substitution variables
 */
export interface IEmailTemplate {
  /**
   * Checksums and formats address to be displayed in email
   * @param chain - chain of the address
   * @param address - address to be converted
   */
  addressToHtml(args: { chain: Chain; address: string }): string;

  /**
   * Checksums and formats addresses to be displayed in email as list
   * @param chain - chain of the addresses
   * @param addresses - addresses to be converted
   */
  addressListToHtml(args: { chain: Chain; addresses: Array<string> }): string;

  /**
   * Gets the URL of the Safe on the web app
   * @param chain - chain of the Safe
   * @param safeAddress - address of the Safe
   */
  getSafeWebAppUrl(args: { chain: Chain; safeAddress: string }): string;
}
