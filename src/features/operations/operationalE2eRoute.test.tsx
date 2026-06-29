/// <reference types="jest" />

import { render, waitFor } from '@testing-library/react-native';
import { Theme, TamaguiProvider } from 'tamagui';

import OperationalE2ERoute from '@/app/operational-e2e';
import { OperationalThemeProvider } from '@/shared/theme';
import { tamaguiConfig } from '../../../tamagui.config';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ scenario: 'missing-local-data' }),
}));

describe('operational E2E route', () => {
  it('passes the requested dev scenario into the live operational entry', async () => {
    const screen = await render(
      <OperationalThemeProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <Theme name="light">
            <OperationalE2ERoute />
          </Theme>
        </TamaguiProvider>
      </OperationalThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText('Incident incident-missing is not available locally for offline use.')).toBeTruthy());
    expect(screen.getByTestId('live-operational-entry')).toBeTruthy();
  });
});
