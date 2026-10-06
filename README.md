# Fold / Flight — Paper Plane Lab

An interactive, browser-based paper-plane simulator built with **Three.js 0.186.1
(r186), React 19.3.0, and Vite 8.3.3**. Choose a folded airframe, adjust its release
and environment, replay its 3D trajectory, and compare predicted airtime or horizontal distance.

The eleven configurations include Classic Dart, Nakamura Lock, Wide Glider,
Delta Wing, Condor, Needle, Canard, Swallow, **Suzanne**, **Sky King**, and
**Krstić Dart**. Each has a distinct folded shape, estimated aerodynamic
coefficients, and illustrated folding instructions.
The v2 engine integrates six-degree-of-freedom rigid-body motion, including
quaternion attitude, aerodynamic moments, mass distribution, altitude-dependent
Earth gravity, and a variable atmosphere.

Three entries have documented international achievements and public folding methods:

- **Suzanne**: John Collins and Joe Ayoob’s former 2012 distance record, **69.14 m**.
  [Official history](https://www.guinnessworldrecords.com/news/2026/5/evolution-of-the-paper-plane-flight-and-how-far-its-actually-possible-to-throw-one),
  [designer’s folding tutorial](https://makezine.com/projects/worlds-best-paper-airplane/).
- **Sky King**: Takuo Toda’s former 2009 airtime record, **27.9 s**.
  [Guinness history](https://www.guinnessworldrecords.jp/news/2015/12/paperaircraft),
  [Toda-supervised photographed guide](https://www.honda.co.jp/kids/jiyuu-kenkyu/challenge/c-13/skyking/).
- **Krstić Dart**: Lazar Krstić’s 2022 Red Bull Paper Wings world-final distance
  winner, **61.11 m**. The simulator uses a descriptive name for his published
  championship plane. [Official result](https://www.guinnessworldrecords.com/world-records/729614-farthest-throw-at-the-red-bull-paper-plane-championship),
  [published method and demonstration](https://www.mensjournal.com/entertainment/how-to-make-best-paper-airplane).

These are selected historical champions, not a universal current top-three ranking.
The guides contain original schematic adaptations with links to the original methods.
The simulator standardizes all designs to the same A4 stock without added mass;
Suzanne’s record aircraft used 100 gsm paper and tape, and Krstić’s published method
recommends 100 gsm and an inverted throw. Record results are provenance and do not
enter the solver or optimizer. See [airframe assumptions](docs/airframes.md).

## Run locally

Use Node.js 22.12+ and npm; Node.js 20.19 within the Node 20 release line is also
supported by Vite.

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
  **Paper, wind & altitude** to change paper stock, wind, gust intensity, elevator
  trim, air temperature, relative humidity, sea-level pressure, and ground elevation.
  Choose **Indoor · still air** (the default) for exactly zero wind and gusts,
  or restore the outdoor New Delhi preset. Launch angles extend to 90° and speeds to 25 m/s.
- Open **Fold guide** for illustrated instructions for the selected plane. Each
  step shows the fold line and motion arrows beside the resulting paper shape.
  Use **Next step**, **Previous step**, or the numbered steps to follow along;
  **All steps at a glance** keeps the complete instructions available.
- Launch and inspect the flight using playback, replay, timeline, and camera
  controls. The telemetry shows time, horizontal displacement, height above ground,
  altitude above sea level, and
  ground speed.
- Use **Compare all designs** for eleven flights with the same launch settings and
  environment.
- Use **Find best launches** to give every design the same search: eleven angles
  `[0, 5, 10, 15, 20, 25, 30, 45, 60, 75, 90]°`, nine speeds
  `[4, 5.5, 7, 8.5, 10, 15, 17.5, 20, 25] m/s`, and three trim offsets
  `[-2, 0, 2]°`. This is **297 trials per design, 3,267 trials total** for each objective.
  Paper, release height, weather, temperature, field elevation, gust seed, and
  numerical settings remain shared.
- Replay a leaderboard entry or export the current ranking as CSV.

Choose **Airtime** or **Distance** to rank matched launches and search each design's best completed flight. Airtime measures release to first ground contact; distance is horizontal displacement from the release point, not total path length. The other metric breaks ties. Changing conditions or the objective clears stale search results. Time-capped flights are marked as incomplete observations and
cannot win that search.

Distance champions are not airtime champions. The old 4–10 m/s search also disadvantaged fast darts. Record materials, release attitude and estimated coefficients differ from this standardized comparison; see [the source audit](public/reports/competition-context.md).

## Reproduce an experiment

The default shared configuration is:

| Setting | Default |
| --- | --- |
| Launch speed / elevation | 7 m/s / 12° |
| Release height | 1.8 m above the launch ground |
| Paper stock | A4, 80 g/m²; 4.9896 g per plane |
| Environment | New Delhi indoors; idealized still air |
| Wind / gust intensity | 0 m/s / 0 |
| Air temperature / field elevation | 26°C / 215 m above sea level |
| Relative humidity | 46% |
| Sea-level pressure | 1008.3 hPa (estimated); local ground pressure about 982.9 hPa |
| Additional elevator trim | 0° |
| Gust seed | 42 |
| Integration step | 1/120 s, with internal adaptive substeps |
| Flight time cap | 60 s |

The New Delhi preset uses Safdarjung station elevation and rounded NASA POWER
2001–2020 annual climate means. Its sea-level pressure is estimated from the
climate grid's surface pressure. Indoor wind and gusts are zero; temperature and humidity remain editable representative values, not measured venue conditions. The outdoor option uses a chosen 2 m/s headwind. Walls, ceilings, ventilation and thermals are not modeled.
All weather values are editable, and **Reset conditions** restores indoor defaults.
See [the model and source links](docs/model.md#new-delhi-defaults-and-humidity)
for the reference location and assumptions. The preset does not fetch live weather.

Open **Paper, wind & altitude** to set **Ground elevation** in metres above mean
sea level (−500 to 6,000 m). Flight altitude is ground elevation plus height above
ground: a 2 m release on a 1,500 m field starts at 1,502 m above sea level. Pressure,
density, gravity, lift, and drag use this altitude throughout flight. Landing
occurs at the local ground. Telemetry and exported CSV distinguish the two heights.

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
stability values are estimates. The v2 six-degree-of-freedom model integrates
translational forces and rotational moments using quaternion attitude. Estimated
CG, aerodynamic-center positions, inertias, and damping derivatives determine
the passive pitch, roll, and yaw response.

Earth gravity varies with altitude. The atmosphere uses altitude-dependent
pressure, configured temperature and humidity, and Sutherland's viscosity relation
to obtain moist-air density and Reynolds number. Lift, profile drag, induced drag, and post-stall
effects use air-relative flow and repeatable gusts. The catalog's low-Reynolds-
number force and moment coefficients remain uncalibrated; they are a substantial
source of uncertainty even with a more detailed numerical solver. The simulation
does not run CFD or provide physical validation of a real folded plane.

A long simulated flight is a candidate for a real throw test. Fold precision,
paper stiffness, center of mass, humidity, drafts, and launch technique can change
the result. Numerical convergence checks assess the solver; they do not establish
which real paper airplane flies longest.

Read [the flight model](docs/model.md) for forces, integration, units, and bounds,
and [the airframe assumptions](docs/airframes.md) for catalog geometry and folding
details, coefficient tables, sign conventions, and linked NASA/MIT equation
references. Those sources support the physical framework; the eleven airframes'
parameter values are representative estimates.

## Source map

| File | Role |
| --- | --- |
| `src/App.tsx` | Controls, playback, comparisons, and CSV export. |
| `src/lib/designs.ts` | Eleven airframes, estimated dynamics, and folding instructions. |
| `src/lib/championDesigns.ts` | Three sourced historical champions and independent model estimates. |
| `src/lib/physics.ts` | Deterministic six-degree-of-freedom flight integration and defaults. |
| `src/lib/atmosphere.ts` | Earth gravity, pressure, density, viscosity, and atmospheric settings. |
| `src/lib/environment.ts` | New Delhi preset, reference location, and climate provenance. |
| `src/lib/experiments.ts` | Matched comparisons and equal-budget launch search. |
| `src/lib/scene.ts`, `src/lib/planeMesh.ts` | Three.js scene and folded plane meshes. |
| `scripts/benchmark.ts` | Reproducible reports and integration-step replay. |
| `tests/` | Physics and experiment checks. |
