import test from 'node:test';
import assert from 'node:assert/strict';
import { getAtmosphere, AIR_GAS_CONSTANT, saturationVaporPressure } from '../src/lib/atmosphere.ts';
import { DEFAULT_SETTINGS, simulateFlight } from '../src/lib/physics.ts';
import { INDOOR_ENVIRONMENT, NEW_DELHI_ENVIRONMENT, isIndoorEnvironment, isNewDelhiEnvironment } from '../src/lib/environment.ts';
import { DESIGNS } from '../src/lib/designs.ts';

test('moist air matches independent vapor-pressure and density references', () => {
  assert.ok(Math.abs(saturationVaporPressure(20) - 2338.34) < 0.1, '20°C water saturation reference in Pa');
  assert.ok(Math.abs(saturationVaporPressure(30) - 4245.13) < 0.2, '30°C water saturation reference in Pa');
  const dry = getAtmosphere({ airTemperature: 20, fieldElevation: 0, relativeHumidity: 0, seaLevelPressure: 1013.25 });
  const moist = getAtmosphere({ airTemperature: 20, fieldElevation: 0, relativeHumidity: 50, seaLevelPressure: 1013.25 });
  assert.equal(dry.density, dry.pressure / (AIR_GAS_CONSTANT * dry.temperatureKelvin), 'exact dry-air limit');
  assert.equal(dry.vaporPressure, 0);
  assert.ok(Math.abs(moist.vaporPressure - 1169.17) < 0.1);
  assert.ok(Math.abs(moist.density - 1.19885436) < 1e-7, '20°C/50%RH reference in kg/m³');
  assert.ok(moist.density < dry.density, 'humidity reduces density at equal pressure and temperature');
  const hot = getAtmosphere({ airTemperature: 30, fieldElevation: 0, relativeHumidity: 80, seaLevelPressure: 1013.25 });
  assert.ok(Math.abs(hot.density - 1.14963438) < 1e-7, '30°C/80%RH reference in kg/m³');
});

test('sea-level pressure is converted from hPa and reduced only once at elevation', () => {
  const low = getAtmosphere({ airTemperature: 26, fieldElevation: 0, relativeHumidity: 46, seaLevelPressure: 1000 });
  assert.equal(low.pressure, 100000);
  const high = getAtmosphere({ airTemperature: 26, fieldElevation: 215, relativeHumidity: 46, seaLevelPressure: 1000 });
  assert.ok(Math.abs(high.pressure - 97476.34) < 1, '215m standard-atmosphere pressure ratio');
  const higherPressure = getAtmosphere({ airTemperature: 26, fieldElevation: 215, relativeHumidity: 46, seaLevelPressure: 1020 });
  assert.ok(Math.abs(higherPressure.pressure / high.pressure - 1.02) < 1e-12);
  assert.ok(higherPressure.density > high.density);
});

test('moist-air bounds keep vapor partial pressure and density physical', () => {
  for (const airTemperature of [-60, 0, 26, 60]) {
    for (const fieldElevation of [-500, 215, 6000, 10000]) {
      for (const relativeHumidity of [-20, 0, 46, 100, 150, NaN]) {
        const air = getAtmosphere({ airTemperature, fieldElevation, relativeHumidity, seaLevelPressure: 850 });
        assert.ok(Number.isFinite(air.density) && air.density > 0);
        assert.ok(air.vaporPressure >= 0 && air.vaporPressure < air.pressure);
        assert.ok(air.relativeHumidity >= 0 && air.relativeHumidity <= 100);
      }
    }
  }
});

test('New Delhi defaults are reproducible and humidity changes aerodynamic flight', () => {
  assert.ok(isIndoorEnvironment(DEFAULT_SETTINGS));
  assert.ok(isNewDelhiEnvironment({ ...DEFAULT_SETTINGS, ...NEW_DELHI_ENVIRONMENT.settings }));
  assert.equal(INDOOR_ENVIRONMENT.settings.windSpeed, 0);
  assert.equal(DEFAULT_SETTINGS.turbulence, 0);
  assert.equal(NEW_DELHI_ENVIRONMENT.settings.fieldElevation, 215);
  assert.equal(DEFAULT_SETTINGS.airTemperature, 26);
  assert.equal(DEFAULT_SETTINGS.relativeHumidity, 46);
  assert.equal(DEFAULT_SETTINGS.seaLevelPressure, 1008.3);
  const dry = simulateFlight(DESIGNS[2], { relativeHumidity: 0 });
  const humid = simulateFlight(DESIGNS[2], { relativeHumidity: 100 });
  assert.ok(humid.samples[0].density! < dry.samples[0].density!);
  assert.notEqual(humid.duration, dry.duration);
  assert.deepEqual(simulateFlight(DESIGNS[2], { relativeHumidity: 100 }), humid);
  const invalid = simulateFlight(DESIGNS[0], { relativeHumidity: NaN, seaLevelPressure: Infinity });
  assert.equal(invalid.settings.relativeHumidity, DEFAULT_SETTINGS.relativeHumidity);
  assert.equal(invalid.settings.seaLevelPressure, DEFAULT_SETTINGS.seaLevelPressure);
});
