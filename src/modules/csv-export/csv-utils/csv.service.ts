import { Injectable } from '@nestjs/common';
import { type ColumnOption, type Options, stringify } from 'csv-stringify';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';

export interface CsvOptions extends Options {
  columns: Array<ColumnOption>;
  header?: boolean;
}

@Injectable()
export class CsvService {
  /**
   * Exports data to CSV format and writes it to the provided writable stream.
   * @param {Readable} readable - Readable stream where the CSV data will be read from
   * @param {Writable} writable - Writable stream where the CSV data will be written
   * @param {CsvOptions} options - Options for CSV formatting
   * @returns {Promise<void>} A promise that resolves when the export is complete.
   */
  async toCsv(
    readable: Readable,
    writable: Writable,
    options: CsvOptions,
  ): Promise<void> {
    const stringifier = stringify({
      ...options,
      header: options.header ?? true,
    });

    await pipeline(readable, stringifier, writable);
  }
}
