import { describe, it } from 'vitest';
import * as fs from 'node:fs';

describe('probe fs', () => {
  it('reads src directory', () => {
    const files = fs.readdirSync('src');
    expect(files.length).toBeGreaterThan(0);
    // Find all files matching sprint or progression or weekend
    const findFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let results: string[] = [];
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          results = results.concat(findFiles(full));
        } else {
          results.push(full);
        }
      }
      return results;
    };
    const all = findFiles('src');
    const matched = all.filter(f => f.includes('sprint') || f.includes('weekend') || f.includes('progression') || f.includes('stepper') || f.includes('Weekend'));
    console.log('MATCHED_FILES:', JSON.stringify(matched));
  });
});
