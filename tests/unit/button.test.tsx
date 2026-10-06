import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../../packages/ui/src/Button/Button';

describe('Button', () => {
  it('renders label', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button').textContent).toBe('Click');
  });
});
