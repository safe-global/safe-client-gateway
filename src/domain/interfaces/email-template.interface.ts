export const IEmailTemplate = Symbol('IEmailTemplate');

/**
 * Templates are required (but used sparingly) as some providers don't support
 * JavaScript or arrays passed as substitution variables
 */
export interface IEmailTemplate {
  /**
   * Checksums and formats address to be displayed in email
   * @param address - address to be converted
   */
  addressToHtml(address: string): string;

  /**
   * Checksums and formats addresses to be displayed in email as list
   * @param addresses - addresses to be converted
   */
  addressListToHtml(addresses: Array<string>): string;
}
