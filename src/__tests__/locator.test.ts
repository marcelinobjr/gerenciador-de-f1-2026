import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';

describe('Locator test', () => {
  it('finds files', () => {
    const list: string[] = [];
    function walk(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (!full.includes('node_modules') && !full.includes('.git') && !full.includes('dist')) {
            walk(full);
          }
        } else {
          list.push(full);
        }
      }
    }
    walk('src');
    const matches = list.filter(f => /weekend|progression|schedule|sprint/i.test(f));
    throw new Error('FOUND: ' + JSON.stringify(matches));
  });
});
