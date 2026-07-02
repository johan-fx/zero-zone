import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from './Card';
import { MetaRow } from './MetaRow';
import { SectionHeader } from './SectionHeader';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the default label and marker for a tone', () => {
    render(<StatusBadge tone="success" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('lets callers override the label with domain-specific copy', () => {
    render(<StatusBadge tone="risk" label="Critical shortage" />);
    expect(screen.getByText('Critical shortage')).toBeInTheDocument();
  });

  it('applies the tone class so styling stays data-driven', () => {
    const { container } = render(<StatusBadge tone="stale" />);
    expect(container.querySelector('.zc-status-badge--stale')).not.toBeNull();
  });
});

describe('Card', () => {
  it('renders as an article by default with tone-accented class', () => {
    const { container } = render(<Card tone="warning">content</Card>);
    const card = container.querySelector('article.zc-card.zc-card--warning');
    expect(card).not.toBeNull();
    expect(card?.textContent).toBe('content');
  });

  it('supports rendering as a different element', () => {
    const { container } = render(<Card as="li">item</Card>);
    expect(container.querySelector('li.zc-card')).not.toBeNull();
  });
});

describe('SectionHeader', () => {
  it('renders eyebrow, title, and trailing content', () => {
    render(<SectionHeader eyebrow="Incident inc-1" title="Work centers" trailing={<strong>3 online</strong>} />);
    expect(screen.getByText('Incident inc-1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Work centers' })).toBeInTheDocument();
    expect(screen.getByText('3 online')).toBeInTheDocument();
  });
});

describe('MetaRow', () => {
  it('renders a label/value pair per item with optional tone tint', () => {
    const { container } = render(
      <MetaRow
        items={[
          { label: 'Freshness', value: 'Fresh', tone: 'success' },
          { label: 'Risk', value: 'Critical', tone: 'sos' },
        ]}
      />,
    );
    expect(screen.getByText('Freshness')).toBeInTheDocument();
    expect(screen.getByText('Fresh')).toBeInTheDocument();
    expect(container.querySelector('.zc-meta-row__item--sos')).not.toBeNull();
  });
});
