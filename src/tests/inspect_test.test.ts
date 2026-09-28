import { test, expect } from 'vitest';
import fs from 'node:fs';

test('inspect files', () => {
  const content = fs.readFileSync('src/components/race/CanonicalQualifyingView.tsx', 'utf-8');
  expect(content).toBe('TRIGGER_FAIL');
});
