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
    const { header = true, columns: optColumns } = options;
    // If no columns are provided or it's an empty array, derive them from the first object in the data
    // or use an empty object to avoid errors when data is empty.
    const columns = optColumns?.length
      ? optColumns
      : Object.keys(data?.[0] ?? {});

    const readable = Readable.from(data);
    const stringifier = stringify({ ...options, header, columns });

    await pipeline(readable, stringifier, writable);
  }
}
