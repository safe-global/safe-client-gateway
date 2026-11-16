// SPDX-License-Identifier: FSL-1.1-MIT

/** Nothing this call broadcast can have paid the fee; any other error may follow a paid fee. */
export class SafenetPayerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SafenetPayerError';
  }
}
