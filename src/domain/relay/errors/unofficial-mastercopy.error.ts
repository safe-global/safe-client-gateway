export class UnofficialMastercopyError extends Error {
  constructor() {
    super(
      'Safe attempting to relay is not official. Only official Safe mastercopies are supported.',
    );
  }
}
