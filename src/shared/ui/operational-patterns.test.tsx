/// <reference types="jest" />
import { TamaguiProvider } from 'tamagui';

import { tamaguiConfig } from '../../../tamagui.config';
import { CenterSummaryCard, RecommendationCard, SyncStatePanel } from './operational-patterns';

const ReactTestRenderer = require('react-test-renderer');

function renderTexts(node: React.ReactElement): string[] {
  let tree: { toJSON: () => unknown } | undefined;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {node}
      </TamaguiProvider>,
    );
  });

  return flattenText(tree?.toJSON());
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

describe('operational compound patterns', () => {
  it('renders center summary content used by selected-center mockups', () => {
    const texts = renderTexts(
      <CenterSummaryCard
        name="Center summary"
        type="Work center"
        status={{ tone: 'success', label: 'Active' }}
        confidence="Confidence: high"
        freshness="Data: recent"
        risk="Risk: precaution"
        missing={['3 medics', 'Water']}
        surplus={['Food']}
        roles={[{ label: 'total', value: '12', tone: 'success' }]}
      />,
    );

    expect(texts).toEqual(expect.arrayContaining(['Center summary', 'Missing', 'Surplus', '12']));
  });

  it('renders recommendation card content used by recommendation mockups', () => {
    const texts = renderTexts(
      <RecommendationCard
        tone="success"
        title="Recommendation card"
        reason="Medical gap · Water"
        distance="900 m"
        freshness="Recent data"
        risk="Risk precaution"
        primaryAction="View center"
      />,
    );

    expect(texts).toEqual(expect.arrayContaining(['Recommendation card', 'Recommended', 'View center']));
  });

  it('renders sync state comparison content used by sync-conflict mockups', () => {
    const texts = renderTexts(
      <SyncStatePanel
        local={{ title: 'Local operation', detail: 'Mark resolved', tone: 'success' }}
        network={{ title: 'Network state', detail: 'Still active', tone: 'info' }}
        status={{ tone: 'conflict', label: 'Sync state' }}
        actions={[{ label: 'Coordinator review', tone: 'warning' }]}
      />,
    );

    expect(texts).toEqual(expect.arrayContaining(['Sync conflict', 'Local operation', 'Network state', 'Coordinator review']));
  });
});
