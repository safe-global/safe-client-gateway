// SPDX-License-Identifier: FSL-1.1-MIT
export class TransientEmailError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'TransientEmailError';
  }
}

export class PermanentEmailError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'PermanentEmailError';
  }
}
