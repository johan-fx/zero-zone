/// <reference types="jest" />
import { TamaguiProvider } from 'tamagui';

import { tamaguiConfig } from '../../../tamagui.config';
import { ActionButton, StatusBadge, resolveActionButtonMinHeight } from './operational';

const ReactTestRenderer = require('react-test-renderer');

function renderTree(node: React.ReactElement) {
  let tree: { toJSON: () => unknown } | undefined;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {node}
      </TamaguiProvider>,
    );
  });

  return tree?.toJSON();
}

function flattenText(node: unknown): string[] {
  if (node == null || typeof node === 'boolean') {
    return [];
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap(flattenText);
  }

  if (typeof node === 'object' && 'children' in node) {
    return flattenText((node as { children?: unknown }).children);
  }

  return [];
}

describe('operational components visual contracts', () => {
  it('uses compact height for secondary actions and critical height for primary or SOS actions', () => {
    expect(resolveActionButtonMinHeight('info')).toBe('$action');
    expect(resolveActionButtonMinHeight('success')).toBe('$action');
    expect(resolveActionButtonMinHeight('primary')).toBe('$criticalAction');
    expect(resolveActionButtonMinHeight('sos')).toBe('$criticalAction');
  });

  it('lets explicit priority override the tone-derived action height', () => {
    expect(resolveActionButtonMinHeight('info', 'critical')).toBe('$criticalAction');
    expect(resolveActionButtonMinHeight('primary', 'normal')).toBe('$action');
  });

  it('renders status badge marker and label together', () => {
    const texts = flattenText(renderTree(<StatusBadge tone="warning" label="Warning" />));

    expect(texts).toContain('!');
    expect(texts).toContain('Warning');
  });

  it('renders action button labels through the design-system component', () => {
    const texts = flattenText(renderTree(<ActionButton label="Save signed report" tone="success" />));

    expect(texts).toContain('Save signed report');
  });
});
