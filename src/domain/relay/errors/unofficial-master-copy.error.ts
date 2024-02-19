export class UnofficialMasterCopyError extends Error {
  constructor() {
    super(
      'Safe attempting to relay is not official. Only official Safe singletons are supported.',
    );
  }
}
