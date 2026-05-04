// SPDX-License-Identifier: FSL-1.1-MIT
export const IEmailService = Symbol('IEmailService');

export interface IEmailService {
  /**
   * Sends an email to the given recipient.
   *
   * @param args.to - recipient email address
   * @param args.subject - email subject line
   * @param args.htmlBody - HTML content of the email
   * @param args.textBody - optional plain-text fallback
   *
   * @throws {PermanentEmailError} if the email is permanently rejected
   * @throws {TransientEmailError} if the failure is retryable
   */
  send(args: {
    to: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
  }): Promise<void>;
}
