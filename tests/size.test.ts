import { describe, expect, it } from 'vitest';

import { formatBytes, parseSize } from '../src/core/size.js';

describe('size helpers', () => {
  it('formats binary sizes for people', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(10 * 1024 ** 3)).toBe('10 GB');
  });

  it('parses Docker-style decimal sizes', () => {
    expect(parseSize('1.5GB')).toBe(1_500_000_000);
    expect(parseSize('420 MB')).toBe(420_000_000);
    expect(parseSize('unknown')).toBe(0);
  });
});
