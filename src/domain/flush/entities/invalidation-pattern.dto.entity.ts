export class InvalidationPatternDetails {
  chainId: string | null;

  constructor(chainId: string | null) {
    this.chainId = chainId;
  }
}

export class InvalidationPatternDto {
  invalidate: string;
  patternDetails: InvalidationPatternDetails | null;

  constructor(
    invalidate: string,
    patternDetails: InvalidationPatternDetails | null,
  ) {
    this.invalidate = invalidate;
    this.patternDetails = patternDetails;
  }
}
