import { Injectable } from '@nestjs/common';
import { Options, stringify } from 'csv-stringify';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';

export interface CsvOptions extends Options {
  header?: boolean;
  columns?: Array<string>;
}

@Injectable()
export class CsvExportService {
  async exportToCsv<T extends Record<string, unknown>>(
    data: Array<T>,
    writable: Writable,
    options: CsvOptions = {},
  ): Promise<void> {
    const columns = this.resolveColumns(data, options.columns);
    const { header = true, ...csvOptions } = options;

    // Convert array to generator for memory-efficient streaming
    const iterable = (function* (): Generator<T> {
      yield* data;
    })();

    const readable = Readable.from(iterable);
    const stringifier = stringify({
      ...csvOptions,
      header,
      columns,
    });
    await pipeline(readable, stringifier, writable);
  }

  private resolveColumns<T extends Record<string, unknown>>(
    data: Array<T>,
    optColumns?: Array<string>,
  ): Array<string> {
    if (optColumns?.length) return optColumns;
    return Object.keys(data[0] ?? {});
  }
}
