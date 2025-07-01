import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';

export interface CsvOptions {
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
    let columns = optColumns;

    //default columns to the keys of the first object in data if not provided
    if (!columns && data.length && typeof data[0] === 'object') {
      columns = Object.keys(data[0]);
    }

    const readable = Readable.from(data);
    const stringifier = stringify({ header, columns });

    await pipeline(readable, stringifier, writable);
  }
}
