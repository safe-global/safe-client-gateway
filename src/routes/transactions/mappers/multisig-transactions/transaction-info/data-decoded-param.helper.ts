import { Injectable } from '@nestjs/common';
import { DataDecoded } from '../../../../data-decode/entities/data-decoded.entity';

@Injectable()
export class DataDecodedParamHelper {
  private readonly TRANSFER_METHOD = 'transfer';
  private readonly TRANSFER_FROM_METHOD = 'transferFrom';
  private readonly SAFE_TRANSFER_FROM_METHOD = 'safeTransferFrom';

  getFromParam(dataDecoded: DataDecoded, fallback: string): string {
    if (!dataDecoded.parameters) {
      return fallback;
    }

    switch (dataDecoded.method) {
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 0);
        return typeof value === 'string' ? value : fallback;
      }
      case this.TRANSFER_METHOD:
      default:
        return fallback;
    }
  }

  getToParam(dataDecoded: DataDecoded, fallback: string): string {
    if (!dataDecoded.parameters) {
      return fallback;
    }

    switch (dataDecoded.method) {
      case this.TRANSFER_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 0);
        return typeof value === 'string' ? value : fallback;
      }
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 1);
        return typeof value === 'string' ? value : fallback;
      }
      default:
        return fallback;
    }
  }

  getValueParam(dataDecoded: DataDecoded, fallback: string): string {
    if (!dataDecoded.parameters) {
      return fallback;
    }

    switch (dataDecoded.method) {
      case this.TRANSFER_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 1);
        return typeof value === 'string' ? value : fallback;
      }
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 2);
        return typeof value === 'string' ? value : fallback;
      }
      default:
        return fallback;
    }
  }

  getValueAtPosition(dataDecoded: any | null, position: number) {
    if (!dataDecoded.parameters?.length) return null;
    return dataDecoded.parameters[position]?.value ?? null;
  }
}
