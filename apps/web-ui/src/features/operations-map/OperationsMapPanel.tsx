import { useEffect, useMemo, useState } from 'react';

import type { CountryOption, OperationalMapResponse } from '@zona-cero/contracts';
import { SectionHeader, StatusBadge } from '@zona-cero/ui/web';
import { fetchMapCountries, fetchOperationalMap } from '../../api';
import { CountryFilter } from './CountryFilter';
import { OperationsMap } from './OperationsMap';
import { countMapMarkers, flattenOperationalMapMarkers } from './mapData';

type CountriesState =
  | { status: 'loading' }
  | { status: 'ready'; countries: CountryOption[] }
  | { status: 'error'; message: string };

type MapState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; map: OperationalMapResponse }
  | { status: 'error'; message: string };

export function OperationsMapPanel() {
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
    <div className="operations-map-panel">
      <div className="operations-map-panel__toolbar">
        <SectionHeader
          eyebrow="Operational map"
          title="Map overview"
          titleId="map-title"
          trailing={selectedCountry ? <StatusBadge tone="info" label={`${selectedCountry.markerCount} markers`} /> : null}
        />
        <CountryFilter
          countries={countries}
          selectedCountryCode={selectedCountryCode}
          onChange={setSelectedCountryCode}
          disabled={countriesState.status !== 'ready'}
        />
      </div>

      {countriesState.status === 'loading' ? <p>Loading countries…</p> : null}
      {countriesState.status === 'error' ? <p role="alert">{countriesState.message}</p> : null}
      {countriesState.status === 'ready' && countries.length === 0 ? (
        <p role="status">No countries with operational map data yet.</p>
      ) : null}

      {countries.length > 0 ? <MapStateView state={mapState} /> : null}
    </div>
  );
}

function MapStateView({ state }: { state: MapState }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return <p>Loading operational map…</p>;
    case 'error':
      return <p role="alert">{state.message}</p>;
    case 'ready':
      return <OperationalMapReadyView map={state.map} />;
  }
}

function OperationalMapReadyView({ map }: { map: OperationalMapResponse }) {
  const markers = useMemo(() => flattenOperationalMapMarkers(map), [map]);
  const markerCount = countMapMarkers(map);

  return (
    <div className="operations-map-panel__content">
      <div className="map-summary" aria-label="Operational map counts">
        <StatusBadge tone="info" label={`${map.counts.incidents} incidents`} />
        <StatusBadge tone="success" label={`${map.counts.workCenters} work centers`} />
        <StatusBadge tone={map.counts.sosAlerts > 0 ? 'sos' : 'info'} label={`${map.counts.sosAlerts} SOS alerts`} />
        <StatusBadge tone={map.counts.withoutLocation > 0 ? 'warning' : 'success'} label={`${map.counts.withoutLocation} without location`} />
      </div>

      {markerCount === 0 ? (
        <p role="status">No public geolocated map items for {map.countryName} yet.</p>
      ) : (
        <>
          <OperationsMap map={map} />
          <section className="map-accessible-list" aria-labelledby="map-list-title">
            <h3 id="map-list-title">Map items</h3>
            <ul>
              {markers.map((marker) => (
                <li key={marker.id}>
                  <strong>{marker.label}</strong>
                  <span>{marker.kind.replace('_', ' ')} · {marker.status}</span>
                  <span>{marker.detail}</span>
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
