// SPDX-License-Identifier: FSL-1.1-MIT
export const IEmailService = Symbol('IEmailService');

export interface IEmailService {
  send(args: {
    to: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
  }): Promise<void>;
}
