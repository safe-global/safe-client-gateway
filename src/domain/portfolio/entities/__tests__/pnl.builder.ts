import type { PnL } from '@/domain/portfolio/entities/pnl.entity';

export class PnLBuilder {
  private realizedGain = 1000;
  private unrealizedGain = 500;
  private totalFee = 25.5;
  private netInvested = 5000;
  private receivedExternal = 2000;
  private sentExternal = 1000;
  private sentForNfts = 100;
  private receivedForNfts = 50;

  withRealizedGain(value: number): PnLBuilder {
    this.realizedGain = value;
    return this;
  }

  withUnrealizedGain(value: number): PnLBuilder {
    this.unrealizedGain = value;
    return this;
  }

  withTotalFee(value: number): PnLBuilder {
    this.totalFee = value;
    return this;
  }

  withNetInvested(value: number): PnLBuilder {
    this.netInvested = value;
    return this;
  }

  withReceivedExternal(value: number): PnLBuilder {
    this.receivedExternal = value;
    return this;
  }

  withSentExternal(value: number): PnLBuilder {
    this.sentExternal = value;
    return this;
  }

  withSentForNfts(value: number): PnLBuilder {
    this.sentForNfts = value;
    return this;
  }

  withReceivedForNfts(value: number): PnLBuilder {
    this.receivedForNfts = value;
    return this;
  }

  build(): PnL {
    return {
      realizedGain: this.realizedGain,
      unrealizedGain: this.unrealizedGain,
      totalFee: this.totalFee,
      netInvested: this.netInvested,
      receivedExternal: this.receivedExternal,
      sentExternal: this.sentExternal,
      sentForNfts: this.sentForNfts,
      receivedForNfts: this.receivedForNfts,
    };
  }
}
