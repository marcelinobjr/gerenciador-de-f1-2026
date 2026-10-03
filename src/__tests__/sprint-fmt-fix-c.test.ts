import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('file inspector', () => {
  it('reads weekend files', () => {
    const pages = fs.readdirSync(path.resolve(__dirname, '../pages'));
    console.log('PAGES:', pages);
  });
});
