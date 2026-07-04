import { useEffect, useId, useMemo, useState } from 'react';

import type { CountryOption, OperationalMapResponse } from '@zona-cero/contracts';
import { SectionHeader, StatusBadge } from '@zona-cero/ui/web';
import { fetchMapCountries, fetchOperationalMap } from '../../api';
import { CountryFilter } from './CountryFilter';
import { OperationsMap, type OperationsMapMarkerDescription, type OperationsMapStyleName } from './OperationsMap';
import { countMapMarkers, flattenOperationalMapMarkers, type OperationalMapMarker } from './mapData';

type CountriesState =
  | { status: 'loading' }
  | { status: 'ready'; countries: CountryOption[] }
  | { status: 'error'; message: string };

type MapState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; map: OperationalMapResponse }
  | { status: 'error'; message: string };

export type OperationsMapPanelCopy = {
  eyebrow: string;
  title: string;
  summary?: string;
  markerCountLabel(count: number): string;
  loadingCountries: string;
  emptyCountries: string;
  loadingMap: string;
  countsAriaLabel: string;
  incidentsLabel(count: number): string;
  workCentersLabel(count: number): string;
  sosAlertsLabel(count: number): string;
  withoutLocationLabel(count: number): string;
  emptyMapItems(countryName: string): string;
  listTitle: string;
  mapAriaLabel(countryName: string): string;
  markerLabel?(marker: OperationalMapMarker): string;
  markerMetadata(marker: OperationalMapMarker): string;
  markerDetail(marker: OperationalMapMarker): string;
};

const operationalMapCopy: OperationsMapPanelCopy = {
  eyebrow: 'Operational map',
  title: 'Map overview',
  markerCountLabel: (count) => `${count} markers`,
  loadingCountries: 'Loading countries…',
  emptyCountries: 'No countries with operational map data yet.',
  loadingMap: 'Loading operational map…',
  countsAriaLabel: 'Operational map counts',
  incidentsLabel: (count) => `${count} incidents`,
  workCentersLabel: (count) => `${count} work centers`,
  sosAlertsLabel: (count) => `${count} SOS alerts`,
  withoutLocationLabel: (count) => `${count} without location`,
  emptyMapItems: (countryName) => `No public geolocated map items for ${countryName} yet.`,
  listTitle: 'Map items',
  mapAriaLabel: (countryName) => `Operational map for ${countryName}`,
  markerMetadata: (marker) => `${marker.kind.replace('_', ' ')} · ${marker.status}`,
  markerDetail: (marker) => marker.detail,
};

export function OperationsMapPanel({
  styleName,
  copy = operationalMapCopy,
}: {
  styleName: OperationsMapStyleName;
  copy?: OperationsMapPanelCopy;
}) {
  const mapTitleId = useId();
  const [countriesState, setCountriesState] = useState<CountriesState>({ status: 'loading' });
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [mapState, setMapState] = useState<MapState>({ status: 'idle' });

  useEffect(() => {
    let active = true;

    fetchMapCountries()
      .then((response) => {
        if (!active) return;
        setCountriesState({ status: 'ready', countries: response.countries });
        setSelectedCountryCode((current) => current || response.countries[0]?.countryCode || '');
      })
      .catch((error: unknown) => {
        if (active) setCountriesState({ status: 'error', message: errorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCountryCode) {
      setMapState({ status: 'idle' });
      return;
    }

    let active = true;
    setMapState({ status: 'loading' });

    fetchOperationalMap(selectedCountryCode)
      .then((map) => {
        if (active) setMapState({ status: 'ready', map });
      })
      .catch((error: unknown) => {
        if (active) setMapState({ status: 'error', message: errorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [selectedCountryCode]);

  const countries = countriesState.status === 'ready' ? countriesState.countries : [];
  const selectedCountry = countries.find((country) => country.countryCode === selectedCountryCode);

  return (
    <div className="operations-map-panel" role="region" aria-labelledby={mapTitleId} data-testid="operations-map-panel">
      <div className="operations-map-panel__toolbar">
        <SectionHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          titleId={mapTitleId}
          trailing={selectedCountry ? <StatusBadge tone="info" label={copy.markerCountLabel(selectedCountry.markerCount)} /> : null}
        />
        <CountryFilter
          countries={countries}
          selectedCountryCode={selectedCountryCode}
          onChange={setSelectedCountryCode}
          disabled={countriesState.status !== 'ready'}
        />
        {copy.summary ? <p className="operations-map-panel__summary">{copy.summary}</p> : null}
      </div>

      {countriesState.status === 'loading' ? <p>{copy.loadingCountries}</p> : null}
      {countriesState.status === 'error' ? <p role="alert">{countriesState.message}</p> : null}
      {countriesState.status === 'ready' && countries.length === 0 ? (
        <p role="status">{copy.emptyCountries}</p>
      ) : null}

      {countries.length > 0 ? <MapStateView state={mapState} styleName={styleName} copy={copy} /> : null}
    </div>
  );
}

function MapStateView({ state, styleName, copy }: { state: MapState; styleName: OperationsMapStyleName; copy: OperationsMapPanelCopy }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return <p>{copy.loadingMap}</p>;
    case 'error':
      return <p role="alert">{state.message}</p>;
    case 'ready':
      return <OperationalMapReadyView map={state.map} styleName={styleName} copy={copy} />;
  }
}

function OperationalMapReadyView({ map, styleName, copy }: { map: OperationalMapResponse; styleName: OperationsMapStyleName; copy: OperationsMapPanelCopy }) {
  const mapListTitleId = useId();
  const markers = useMemo(() => flattenOperationalMapMarkers(map), [map]);
  const markerCount = countMapMarkers(map);
  const describeMarker = useMemo(
    () =>
      (marker: OperationalMapMarker): OperationsMapMarkerDescription => ({
        label: copy.markerLabel?.(marker),
        metadata: copy.markerMetadata(marker),
        detail: copy.markerDetail(marker),
      }),
    [copy],
  );

  return (
    <div className="operations-map-panel__content">
      <div className="map-summary" aria-label={copy.countsAriaLabel}>
        <StatusBadge tone="info" label={copy.incidentsLabel(map.counts.incidents)} />
        <StatusBadge tone="success" label={copy.workCentersLabel(map.counts.workCenters)} />
        <StatusBadge tone={map.counts.sosAlerts > 0 ? 'sos' : 'info'} label={copy.sosAlertsLabel(map.counts.sosAlerts)} />
        <StatusBadge tone={map.counts.withoutLocation > 0 ? 'warning' : 'success'} label={copy.withoutLocationLabel(map.counts.withoutLocation)} />
      </div>

      {markerCount === 0 ? (
        <p role="status">{copy.emptyMapItems(map.countryName)}</p>
      ) : (
        <>
          <OperationsMap
            map={map}
            styleName={styleName}
            ariaLabel={copy.mapAriaLabel(map.countryName)}
            describeMarker={describeMarker}
          />
          <section className="map-accessible-list" aria-labelledby={mapListTitleId}>
            <h3 id={mapListTitleId}>{copy.listTitle}</h3>
            <ul>
              {markers.map((marker) => (
                <li key={marker.id}>
                  <strong>{marker.label}</strong>
                  <span>{copy.markerMetadata(marker)}</span>
                  <span>{copy.markerDetail(marker)}</span>
                  <span>{marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected map error';
}
