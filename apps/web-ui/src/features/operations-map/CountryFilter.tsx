import type { CountryOption } from '@zona-cero/contracts';

export function CountryFilter({
  countries,
  selectedCountryCode,
  onChange,
  disabled = false,
}: {
  countries: CountryOption[];
  selectedCountryCode: string;
  onChange: (countryCode: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="country-filter">
      Country
      <select
        name="countryCode"
        value={selectedCountryCode}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled || countries.length === 0}
      >
        {countries.map((country) => (
          <option key={country.countryCode} value={country.countryCode}>
            {country.countryName} ({country.markerCount} markers)
          </option>
        ))}
      </select>
    </label>
  );
}
