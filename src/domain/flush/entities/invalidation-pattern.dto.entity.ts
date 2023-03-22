class InvalidationPatternDetails {
  chain_id?: string;
}

export class InvalidationPatternDto {
  invalidate: string;
  patternDetails: InvalidationPatternDetails;

  constructor(invalidate: string, patternDetails: InvalidationPatternDetails) {
    this.invalidate = invalidate;
    this.patternDetails = patternDetails;
  }
}
