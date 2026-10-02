import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('renders an article body', () => {
    const { container } = render(<Markdown source={'## Plant early\n\nOrder **two weeks** ahead.\n\n- Mvule\n- Musizi'} />);
    expect(container.querySelector('h2')).toHaveTextContent('Plant early');
    expect(container.querySelector('strong')).toHaveTextContent('two weeks');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('strips scripts and event handlers an admin might paste in', () => {
    const { container } = render(<Markdown source={'Hello <script>alert(1)</script><img src=x onerror="alert(2)"> [link](javascript:alert(3))'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect(container.innerHTML).not.toContain('javascript:');
  });
});
