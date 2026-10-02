import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PROBE', () => {
  it('probe files', () => {
    const root = process.cwd();
    const files = fs.readdirSync(path.join(root, 'src', 'services'));
    console.log('SERVICES:', files.filter(f => f.toLowerCase().includes('quali') || f.toLowerCase().includes('race')));
  });
});
