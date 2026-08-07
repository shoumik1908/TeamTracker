import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardGreeting } from './DashboardGreeting';

describe('DashboardGreeting', () => {
  it('renders a personalized greeting and forwards a custom class', () => {
    const { container } = render(<DashboardGreeting name="Asha" className="test-greeting" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Asha');
    expect(container.firstChild).toHaveClass('test-greeting');
  });
});
