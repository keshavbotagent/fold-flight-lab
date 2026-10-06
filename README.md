# Fold / Flight — Paper Plane Lab

An interactive, browser-based paper-plane simulator built with **Three.js 0.186.1
(r186), React 19.3.0, and Vite 8.3.3**. Choose a folded airframe, adjust its release
and environment, replay its 3D trajectory, and compare predicted flight duration.

The eight representative configurations are Classic Dart, Nakamura Lock, Wide
Glider, Delta Wing, Condor, Needle, Canard, and Swallow. Each has a distinct folded
shape, estimated aerodynamic coefficients, and practical folding instructions.

## Run locally

Use Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The application runs entirely in the browser; it
requires no backend, account, or external physics service.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Type-check and create the production site in `dist/`. |
| `npm test` | Run the flight-physics and experiment tests. |
| `npm run benchmark` | Generate baseline, optimized, and integration-step reports. |

Serve the contents of `dist/` over HTTP with a static website host to deploy the
production build.

## Use the lab

- Select an airframe and adjust launch speed, angle, and release height. Expand
  **Paper, wind & trim** to change paper stock, wind, gust intensity, and elevator
  trim.
- Launch and inspect the flight using playback, replay, timeline, and camera
  controls. The telemetry shows time, horizontal displacement, altitude, and
  ground speed.
- Use **Compare all designs** for eight flights with the same launch settings and
  environment.
- Use **Find best launches** to give every design the same search: seven angles
  `[0, 5, 10, 15, 20, 25, 30]°`, five speeds `[4, 5.5, 7, 8.5, 10] m/s`, and three
  trim offsets `[-2, 0, 2]°`. This is **105 trials per design, 840 trials total**.
  Paper, release height, weather, gust seed, and numerical settings remain shared.
- Replay a leaderboard entry or export the current ranking as CSV.

The objective is duration from release to first ground contact. Horizontal
displacement from the release point breaks duration ties; distance is not the
trajectory's total path length. The optimization retains each design's longest
completed landing. Time-capped flights are marked as incomplete observations and
cannot win that search.

## Reproduce an experiment

The default shared configuration is:

| Setting | Default |
| --- | --- |
| Launch speed / elevation | 7 m/s / 12° |
| Release height | 1.8 m |
| Paper stock | A4, 80 g/m²; 4.9896 g per plane |
| Wind / gust intensity | 0 m/s / 0 |
| Additional elevator trim | 0° |
| Gust seed | 42 |
| Integration step | 1/120 s, reduced internally for rapid aerodynamic turning |
| Flight time cap | 60 s |

Run the shared browser physics engine from the command line:

```sh
npm run benchmark -- --seed 42
```

The command writes [the readable report](artifacts/benchmark.md),
[full-precision JSON](artifacts/benchmark.json), and
[spreadsheet-ready CSV](artifacts/benchmark.csv). The JSON includes the actual
settings, airframe coefficients, search grid, and integration-step sensitivity
results. Use `--output-dir <path>` to change the destination. Repeat the same
model, settings, and seed to reproduce flight metrics; generation timestamps
will differ.

The report computes its leading design from the current engine. Regenerate it
after changing the integrator or airframe coefficients, and inspect its
integration-step checks before relying on a close ranking. The finite search
identifies the best tested launch under its assumptions.

## Model assumptions

All airframes use the same uncut A4 sheet and paper stock. Paper weight scales
mass equally across the catalog. Wing geometry, lift, drag, stall, trim, and
stability values are estimates. The simulation includes gravity, air-relative
lift and drag, passive attitude response, and repeatable gusts. It does not run
CFD or provide physical validation of a real folded plane.

A long simulated flight is a candidate for a real throw test. Fold precision,
paper stiffness, center of mass, humidity, drafts, and launch technique can change
the result. Numerical convergence checks assess the solver; they do not establish
which real paper airplane flies longest.

Read [the flight model](docs/model.md) for forces, integration, units, and bounds,
and [the airframe assumptions](docs/airframes.md) for catalog geometry and folding
details.

## Source map

| File | Role |
| --- | --- |
| `src/App.tsx` | Controls, playback, comparisons, and CSV export. |
| `src/lib/designs.ts` | Eight airframes, coefficients, and folding instructions. |
| `src/lib/physics.ts` | Deterministic flight simulation and default settings. |
| `src/lib/experiments.ts` | Matched comparisons and equal-budget launch search. |
| `src/lib/scene.ts`, `src/lib/planeMesh.ts` | Three.js scene and folded plane meshes. |
| `scripts/benchmark.ts` | Reproducible reports and integration-step replay. |
| `tests/` | Physics and experiment checks. |
