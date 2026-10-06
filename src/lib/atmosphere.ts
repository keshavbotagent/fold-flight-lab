import type { Atmosphere, LaunchSettings } from './types';

export const STANDARD_GRAVITY = 9.80665;
export const EARTH_RADIUS = 6_371_000;
export const AIR_GAS_CONSTANT = 287.05287;
export const WATER_VAPOR_GAS_CONSTANT = 461.5;
const SEA_LEVEL_PRESSURE = 101_325;
const SEA_LEVEL_TEMPERATURE = 288.15;
const LAPSE_RATE = 0.0065;

/** Buck 1996 saturation vapor pressure over liquid water, in Pa. */
export function saturationVaporPressure(temperatureCelsius: number): number {
  return 611.21 * Math.exp((18.678 - temperatureCelsius / 234.5)
    * temperatureCelsius / (257.14 + temperatureCelsius));
}

/** Field elevation and height above ground combine into mean-sea-level altitude. */
export function getAtmosphere(
  settings: Pick<LaunchSettings, 'airTemperature' | 'fieldElevation'>
    & Partial<Pick<LaunchSettings, 'relativeHumidity' | 'seaLevelPressure'>>,
  height = 0,
): Atmosphere {
  const field = Number.isFinite(settings.fieldElevation)
    ? Math.max(-500, Math.min(10_000, settings.fieldElevation)) : 0;
  const releaseTemperature = Number.isFinite(settings.airTemperature)
    ? Math.max(-60, Math.min(60, settings.airTemperature)) + 273.15 : SEA_LEVEL_TEMPERATURE;
  const relativeHeight = Number.isFinite(height) ? Math.max(-500, Math.min(20_000, height)) : 0;
  const altitude = Math.max(-500, Math.min(20_000, field + relativeHeight));
  const troposphereAltitude = Math.min(altitude, 11_000);
  const standardTemperature = SEA_LEVEL_TEMPERATURE - LAPSE_RATE * troposphereAltitude;
  const seaLevelPressure = Number.isFinite(settings.seaLevelPressure)
    ? Math.max(850, Math.min(1100, settings.seaLevelPressure as number)) * 100 : SEA_LEVEL_PRESSURE;
  let pressure = seaLevelPressure * Math.pow(
    standardTemperature / SEA_LEVEL_TEMPERATURE,
    STANDARD_GRAVITY / (AIR_GAS_CONSTANT * LAPSE_RATE),
  );
  if (altitude > 11_000) {
    pressure *= Math.exp(-STANDARD_GRAVITY * (altitude - 11_000) / (AIR_GAS_CONSTANT * standardTemperature));
  }
  const temperatureKelvin = Math.max(150, releaseTemperature - LAPSE_RATE * (
    troposphereAltitude - Math.min(field, 11_000)));
  const relativeHumidity = Number.isFinite(settings.relativeHumidity)
    ? Math.max(0, Math.min(100, settings.relativeHumidity as number)) : 0;
  const vaporPressure = Math.min(0.99 * pressure,
    relativeHumidity / 100 * saturationVaporPressure(temperatureKelvin - 273.15));
  const density = (pressure - vaporPressure) / (AIR_GAS_CONSTANT * temperatureKelvin)
    + vaporPressure / (WATER_VAPOR_GAS_CONSTANT * temperatureKelvin);
  const dynamicViscosity = 1.716e-5 * Math.pow(temperatureKelvin / 273.15, 1.5)
    * (273.15 + 110.4) / (temperatureKelvin + 110.4);
  const gravity = STANDARD_GRAVITY * Math.pow(EARTH_RADIUS / (EARTH_RADIUS + altitude), 2);
  return { altitudeMSL: altitude, gravity, density, dynamicViscosity, pressure, temperatureKelvin,
    relativeHumidity, vaporPressure };
}
