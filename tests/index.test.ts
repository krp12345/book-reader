import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index';

describe('package smoke test', () => {
  it('exposes a version string', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
