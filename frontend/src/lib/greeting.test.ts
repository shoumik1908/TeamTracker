import { describe, expect, it } from 'vitest';
import { Coffee, Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import { getTimeBasedGreeting } from './greeting';

describe('getTimeBasedGreeting', () => {
  it.each([
    [6, Sunrise],
    [9, Sun],
    [12, Coffee],
    [15, Sun],
    [19, Sunset],
    [23, Moon],
    [2, Moon],
  ])('chooses the expected icon for hour %i', (hour, Icon) => {
    const result = getTimeBasedGreeting('Asha', new Date(2026, 7, 7, hour));

    expect(result.Icon).toBe(Icon);
    expect(result.text).toContain('Asha');
  });

  it('returns the same greeting for the same person and day', () => {
    const date = new Date(2026, 7, 7, 9);
    expect(getTimeBasedGreeting('Asha', date).text).toBe(getTimeBasedGreeting('Asha', date).text);
  });
});
