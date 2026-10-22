import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RadiusPicker } from './RadiusPicker';

describe('RadiusPicker', () => {
  it('shows the four radius options with the current one pressed', () => {
    render(<RadiusPicker value={25} onChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['10 mi', '25 mi', '50 mi', '100 mi']);
    expect(screen.getByRole('button', { name: '25 mi' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports the radius the user picks', async () => {
    const onChange = vi.fn();
    render(<RadiusPicker value={25} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '50 mi' }));
    expect(onChange).toHaveBeenCalledWith(50);
  });
});
