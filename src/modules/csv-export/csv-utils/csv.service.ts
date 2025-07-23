import { Injectable } from '@nestjs/common';
import { Options, stringify } from 'csv-stringify';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';

export interface CsvOptions extends Options {
  header?: boolean;
  columns?: Array<string>;
}

@Injectable()
export class CsvService {
  /**
   * Exports data to CSV format and writes it to the provided writable stream.
   * @param {Array<T>} data - Array of objects to be exported
   * @param {Writable} writable - Writable stream where the CSV data will be written
   * @param {CsvOptions} options - Options for CSV formatting.
   * @returns {Promise<void>} A promise that resolves when the export is complete.
   */
  async toCsv<T extends Record<string, unknown>>(
    data: Array<T>,
    writable: Writable,
    options: CsvOptions = {},
  ): Promise<void> {
    const columns = this.resolveColumns(data, options.columns);

    const readable = Readable.from(data);
    const stringifier = stringify({
      ...options,
      header: options.header ?? true,
      columns,
    });

    await pipeline(readable, stringifier, writable);
  }

  private resolveColumns<T extends Record<string, unknown>>(
    data: Array<T>,
    optColumns?: Array<string>,
  ): Array<string> {
    if (optColumns?.length) return optColumns;
    return Object.keys(data?.[0] ?? {});
  }
}
