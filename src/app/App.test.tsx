import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App scaffold', () => {
  it('provides the application main landmark', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Finding distinctive faces…' }),
    ).toBeInTheDocument();
  });
});
