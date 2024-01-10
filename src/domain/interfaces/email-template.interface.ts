export const IEmailTemplate = Symbol('IEmailTemplate');

/**
 * Templates are required (but used sparingly) as some providers don't support
 * JavaScript or arrays passed as substitution variables
 */
export interface IEmailTemplate {
  /**
   * Checksums and formats address to be displayed in email
   * @param chainId - chain ID of the address
   * @param address - address to be converted
   */
  addressToHtml(args: { chainId: string; address: string }): Promise<string>;

  /**
   * Checksums and formats addresses to be displayed in email as list
   * @param chainId - chain ID of the addresses
   * @param addresses - addresses to be converted
   */
  addressListToHtml(args: {
    chainId: string;
    addresses: Array<string>;
  }): Promise<string>;

  /**
   * Gets the URL of the Safe on the web app
   * @param chainId - chain ID of the Safe
   * @param safeAddress - address of the Safe
   */
  getSafeWebAppUrl(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<string>;
}
