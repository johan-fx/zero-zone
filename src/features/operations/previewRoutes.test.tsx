/// <reference types="jest" />

import { render } from '@testing-library/react-native';
import { Theme, TamaguiProvider } from 'tamagui';

import DesignSystemScreen from '@/app/design-system';
import VisualAuditRoute from '@/app/visual-audit';
import { OperationalThemeProvider } from '@/shared/theme';
import { tamaguiConfig } from '../../../tamagui.config';
import { centerSummary, recommendationRows } from './mockData';
import { OperationalScreensGallery } from './screens';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ screen: 'selected-center', theme: 'day' }),
  useRouter: () => ({ push: jest.fn() }),
}));

async function renderPreview(node: React.ReactElement) {
  return render(
    <OperationalThemeProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name="light">{node}</Theme>
      </TamaguiProvider>
    </OperationalThemeProvider>,
  );
}

describe('mock-backed preview and audit routes', () => {
  it('keeps the design-system route explicitly mock-backed', async () => {
    const screen = await renderPreview(<DesignSystemScreen />);

    expect(screen.getByText('Design system preview')).toBeTruthy();
    expect(screen.getByText('Mock-backed preview')).toBeTruthy();
    expect(screen.getByText('Center summary')).toBeTruthy();
    expect(screen.queryByText('Live operational entry')).toBeNull();
  });

  it('keeps the visual-audit route on the mock selected-center fixture', async () => {
    const screen = await renderPreview(<VisualAuditRoute />);

    expect(await screen.findByText('Visual audit: mock-backed selected-center')).toBeTruthy();
    expect(screen.getByText('Escuela Norte')).toBeTruthy();
    expect(screen.queryByText('North triage point')).toBeNull();
  });

  it('keeps preview gallery components tied to operations mock data', async () => {
    const screen = await renderPreview(<OperationalScreensGallery />);

    expect(screen.getByText('Mock-backed operations gallery')).toBeTruthy();
    expect(screen.getAllByText(centerSummary.name).length).toBeGreaterThan(0);
    expect(screen.getByText(recommendationRows[0].detail)).toBeTruthy();
  });

  it('keeps the operations mock fixture separate from live local operation names', () => {
    expect(centerSummary.name).toBe('Escuela Norte');
    expect(centerSummary.name).not.toBe('North triage point');
    expect(recommendationRows.map((row) => row.title)).toEqual(['Escuela Norte', 'Depot West', 'Plaza Sur']);
  });
});
