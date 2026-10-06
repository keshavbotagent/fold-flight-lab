import type { LaunchSettings } from './types';

type EnvironmentSettings = Pick<LaunchSettings,
  'airTemperature' | 'fieldElevation' | 'relativeHumidity' | 'seaLevelPressure'
  | 'windSpeed' | 'windDirection' | 'turbulence'>;

/** Rounded representative conditions, not a current weather observation. */
export const NEW_DELHI_ENVIRONMENT = Object.freeze({
  name: 'New Delhi, India',
  reference: 'Safdarjung',
  latitude: 28.585,
  longitude: 77.206,
  timezone: 'Asia/Kolkata',
  climatePeriod: '2001–2020',
  settings: Object.freeze({
    airTemperature: 26,
    fieldElevation: 215,
    relativeHumidity: 46,
    seaLevelPressure: 1008.3,
    windSpeed: 2,
    windDirection: 180,
    turbulence: 0,
  } satisfies EnvironmentSettings),
  sources: {
    elevation: 'https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv',
    climate: 'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,RH2M,WS2M,PS&community=AG&longitude=77.202&latitude=28.583&format=JSON',
  },
  notes: 'Temperature, humidity and wind speed are rounded NASA POWER 2001–2020 gridded annual means near Safdarjung. Elevation rounds the NOAA station metadata value of 214.9 m. Sea-level pressure is an ISA estimate from the climate grid surface pressure, not a station measurement. Headwind direction is a simulation choice.',
});

export function isNewDelhiEnvironment(settings: LaunchSettings): boolean {
  return (Object.keys(NEW_DELHI_ENVIRONMENT.settings) as (keyof EnvironmentSettings)[])
    .every(key => Math.abs(settings[key] - NEW_DELHI_ENVIRONMENT.settings[key]) < 1e-9);
}
