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
      case this.SAFE_TRANSFER_FROM_METHOD:
        return typeof dataDecoded.parameters[0]?.value === 'string'
          ? dataDecoded.parameters[0]?.value
          : fallback;
      case this.TRANSFER_METHOD:
      default:
        return fallback;
    }
  }

  getToParam(dataDecoded: DataDecoded, fallback: string): string {
    if (!dataDecoded?.parameters) {
      return fallback;
    }

    switch (dataDecoded.method) {
      case this.TRANSFER_METHOD:
        return typeof dataDecoded.parameters[0]?.value === 'string'
          ? dataDecoded.parameters[0]?.value
          : fallback;
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD:
        return typeof dataDecoded.parameters[1]?.value === 'string'
          ? dataDecoded.parameters[1]?.value
          : fallback;
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
        const value = dataDecoded.parameters[1]?.value;
        return typeof value === 'string' ? value : fallback;
      }
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD: {
        const value = dataDecoded.parameters[2]?.value;
        return typeof value === 'string' ? value : fallback;
      }
      default:
        return fallback;
    }
  }
}
