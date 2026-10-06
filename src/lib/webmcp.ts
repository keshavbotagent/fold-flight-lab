import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { DESIGNS } from './designs';
import { NEW_DELHI_ENVIRONMENT, isNewDelhiEnvironment } from './environment';
import type { LaunchSettings, RankedFlight } from './types';

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
interface ModelContext {
  registerTool: (tool: ToolDefinition, options: { signal: AbortSignal }) => void | Promise<void>;
}
interface LabState {
  selectedId: string;
  settings: LaunchSettings;
  ranking: RankedFlight[];
  comparisonMethod: string;
  playing: boolean;
}

function emptyInput(input: unknown) {
  if (input === undefined) return;
  if (typeof input !== 'object' || input === null || Array.isArray(input) || Object.keys(input).length) {
    throw new TypeError('This tool accepts an empty object. Configure launch conditions in the flight lab.');
  }
}

function scores(ranking: RankedFlight[]) {
  return ranking.map(row => ({
    rank: row.rank, id: row.design.id, name: row.design.name,
    airtimeSeconds: row.flight.duration, distanceMetres: row.flight.distance,
    landed: row.flight.landed, capped: row.flight.truncated,
    physicsModel: row.flight.modelVersion ?? null, massKg: row.flight.mass ?? row.design.mass * row.flight.settings.paperWeight / 80,
    releaseAltitudeMSLMetres: row.flight.settings.fieldElevation + row.flight.settings.height,
    peakAltitudeMSLMetres: row.flight.settings.fieldElevation + row.flight.maxHeight,
    launch: { speed: row.flight.settings.speed, angle: row.flight.settings.angle, trim: row.flight.settings.trim },
    testedConditions: {
      height: row.flight.settings.height, paperWeight: row.flight.settings.paperWeight,
      windSpeed: row.flight.settings.windSpeed, windDirection: row.flight.settings.windDirection,
      turbulence: row.flight.settings.turbulence, seed: row.flight.settings.seed,
      airTemperature: row.flight.settings.airTemperature, fieldElevation: row.flight.settings.fieldElevation,
      relativeHumidity: row.flight.settings.relativeHumidity, seaLevelPressure: row.flight.settings.seaLevelPressure,
      dt: row.flight.settings.dt,
    },
  }));
}

/** Optional browser integration; the ordinary interface works without WebMCP. */
export function useFlightTools(state: LabState, compare: () => RankedFlight[]) {
  const latest = useRef({ state, compare });
  latest.current = { state, compare };
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const schema = { type: 'object', properties: {}, additionalProperties: false };
    const definitions: ToolDefinition[] = [{
      name: 'read_flight_lab',
      title: 'Read flight lab',
      description: 'Read the selected paper plane, current launch conditions and displayed simulated flight ranking. Coefficients are estimates, not measurements.',
      inputSchema: schema,
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        emptyInput(input);
        const current = latest.current.state;
        return { selectedId: current.selectedId, environment: isNewDelhiEnvironment(current.settings) ? NEW_DELHI_ENVIRONMENT.name : 'Custom environment', conditions: { ...current.settings }, physicsModel: current.ranking[0]?.flight.modelVersion ?? null, comparisonMethod: current.comparisonMethod, playing: current.playing, designs: DESIGNS.map(d => ({ id: d.id, name: d.name, category: d.category })), results: scores(current.ranking) };
      },
    }, {
      name: 'compare_current_airframes',
      title: 'Compare current airframes',
      description: 'Run all eight airframes under the current launch conditions, display the matched-launch ranking, and start the synchronized 3D replay. Uses the same action as Compare all designs.',
      inputSchema: schema,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        emptyInput(input);
        let results: RankedFlight[] = [];
        flushSync(() => { results = latest.current.compare(); });
        return { comparisonMethod: 'matched', results: scores(results) };
      },
    }];
    for (const tool of definitions) {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); }
      catch { /* Browser tool support is optional. */ }
    }
    return () => lifecycle.abort();
  }, []);
}
