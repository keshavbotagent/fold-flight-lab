# Paper-plane flight experiment

**Wide Glider has the longest completed flight in this search: 13.329 s**, covering 30.238 m at 25 m/s, a 20° launch angle, and 2° trim. This is a simulation prediction, not a physical endurance record.

## Documented competition designs

The catalogue includes three designs with documented international achievements and public folding methods. These are selected historical champions, not a current universal top-three ranking. Every simulated variant uses the same A4 paper and estimated geometry, inertia and coefficients; historical results are provenance only and never enter the flight equations or optimizer.

| Design | Documented achievement | Historical result | Source |
| --- | --- | --- | --- |
| Suzanne | Former distance world record | 69.14 m · 2012-02-26 | [Official result](https://www.guinnessworldrecords.com/news/2026/5/evolution-of-the-paper-plane-flight-and-how-far-its-actually-possible-to-throw-one) · [Folding method](https://makezine.com/projects/worlds-best-paper-airplane/) |
| Sky King | Former airtime world record | 27.9 s · 2009-04 | [Official result](https://www.guinnessworldrecords.jp/news/2015/12/paperaircraft) · [Folding method](https://www.honda.co.jp/kids/jiyuu-kenkyu/challenge/c-13/skyking/) |
| Krstić Dart | 2022 world-final distance winner | 61.11 m · 2022-05-14 | [Official result](https://www.guinnessworldrecords.com/world-records/729614-farthest-throw-at-the-red-bull-paper-plane-championship) · [Folding method](https://www.mensjournal.com/entertainment/how-to-make-best-paper-airplane) |

The leader remains Wide Glider at all 3 distinct tested integration steps, including independent complete equal-budget searches. Maximum airtime change between the finest two steps is 0.000263% for selected-launch replay and 0.000263% for grid optima; both satisfy the declared 1% numerical tolerance.

## Model revision comparison

The previous 1.0-aerodynamic-relaxation predictions are included alongside the current predictions in `benchmark.json`. This run uses **2.2.0-indoor-guide**, with rigid-body force/torque, quaternion attitude, atmospheric conditions, and revised estimated coefficients. The shared conditions or grid also differ; changes cannot be attributed solely to the model revision. These are before/after model predictions, not a physical accuracy comparison.

| Rank | Prior model design | Prior airtime (s) | Current model design | Current airtime (s) |
| ---: | --- | ---: | --- | ---: |
| 1 | Wide Glider | 6.856 | Wide Glider | 13.329 |
| 2 | Condor | 6.710 | Condor | 12.045 |
| 3 | Nakamura Lock | 6.459 | Suzanne | 9.108 |

With one identical release for every airframe, Condor leads at 3.548 s.

## Fair comparison settings

Default environment: **New Delhi, India · indoors**: wind and gusts are exactly zero. Temperature and humidity retain representative 2001–2020 Delhi climate values; the 215 m ground elevation comes from Safdarjung metadata. Sea-level pressure is estimated. These are editable defaults, not indoor observations. Walls, ceilings, ventilation and thermals are not modeled.

Relative humidity is 46%; sea-level-reduced pressure is 1008.3 hPa. These remain identical for every trial. Local pressure and moist-air density are recomputed at the plane's altitude.

All 11 airframes use 80 gsm paper, a 1.8 m release height, 0 m/s wind at 0°, turbulence 0, gust seed 42, maximum integration step 0.008333333333333333 s, and a 60 s time cap. Air temperature is 26 °C at field elevation 215 m. A4 paper area and stock determine mass consistently across all designs.

At release, gravity is 9.80598261 m/s², density 1.13756317 kg/m³, dynamic viscosity 1.84183606e-5 Pa·s, pressure 98265.102 Pa, and temperature 299.138 K. Ground reference values and SI unit definitions are recorded in JSON.

The baseline release uses 7 m/s speed, 12° elevation, and 0° additional trim. Rankings compare airtime first, then distance.
Distance is final horizontal displacement from launch.

| Rank | Design | Airtime (s) | Distance (m) | Peak height (m) | Status |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Condor | 3.548 | 7.458 | 2.695 | Landed |
| 2 | Wide Glider | 3.436 | 8.970 | 2.823 | Landed |
| 3 | Suzanne | 3.002 | 10.109 | 2.738 | Landed |
| 4 | Delta Wing | 2.856 | 9.848 | 2.948 | Landed |
| 5 | Nakamura Lock | 2.788 | 9.147 | 3.055 | Landed |
| 6 | Sky King | 2.623 | 7.991 | 2.836 | Landed |
| 7 | Canard | 2.574 | 7.802 | 2.952 | Landed |
| 8 | Classic Dart | 2.510 | 10.906 | 2.647 | Landed |
| 9 | Needle | 2.274 | 11.011 | 2.400 | Landed |
| 10 | Swallow | 2.215 | 6.230 | 2.963 | Landed |
| 11 | Krstić Dart | 1.145 | 6.753 | 1.939 | Landed |

## Equal-budget launch and trim search

Each design receives exactly 297 trials (3267 total): angles [0, 5, 10, 15, 20, 25, 30, 45, 60, 75, 90]°, speeds [4, 5.5, 7, 8.5, 10, 15, 17.5, 20, 25] m/s, and additional trim [-2, 0, 2]°. Only these three variables vary. Environment, paper, release height, seed, air temperature, and field elevation remain fixed. Each reported flight preserves its actual simulated settings.

Completed landings are eligible to win. Time-capped trajectories are censored observations: their duration is a lower bound and they are excluded from winner selection. If every trial of an airframe is capped, its marked fallback appears after completed flights.

| Rank | Design | Airtime (s) | Distance (m) | Speed (m/s) | Angle (°) | Trim (°) | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Wide Glider | 13.329 | 30.238 | 25 | 20 | 2 | Landed |
| 2 | Condor | 12.045 | 22.272 | 25 | 30 | 2 | Landed |
| 3 | Suzanne | 9.108 | 33.151 | 25 | 15 | 2 | Landed |
| 4 | Nakamura Lock | 8.557 | 25.903 | 15 | 10 | 2 | Landed |
| 5 | Sky King | 8.343 | 28.570 | 25 | 0 | 2 | Landed |
| 6 | Delta Wing | 8.111 | 32.342 | 25 | 10 | 0 | Landed |
| 7 | Canard | 6.730 | 21.747 | 20 | 15 | 0 | Landed |
| 8 | Classic Dart | 6.582 | 21.204 | 25 | 0 | 2 | Landed |
| 9 | Krstić Dart | 6.037 | 13.092 | 25 | 75 | 0 | Landed |
| 10 | Swallow | 5.343 | 12.312 | 25 | 20 | 0 | Landed |
| 11 | Needle | 5.023 | 37.343 | 25 | 10 | -2 | Landed |

## Distance objective

The same grid is independently searched for greatest horizontal displacement among completed landings; airtime breaks distance ties. This is the appropriate metric for Suzanne and Krstić’s documented distance events. Launch speeds are candidate inputs, not measurements of record throws. Fourfold finer-step replays satisfy a 1% distance tolerance; that checks numerical sensitivity, not physical accuracy.

| Rank | Design | Airtime (s) | Distance (m) | Speed (m/s) | Angle (°) | Trim (°) | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Krstić Dart | 4.705 | 64.444 | 25 | 15 | 0 | Landed |
| 2 | Needle | 4.925 | 40.751 | 25 | 0 | -2 | Landed |
| 3 | Suzanne | 9.019 | 33.999 | 25 | 10 | 2 | Landed |
| 4 | Delta Wing | 7.997 | 32.902 | 25 | 5 | 0 | Landed |
| 5 | Sky King | 7.941 | 30.500 | 25 | 15 | 0 | Landed |
| 6 | Wide Glider | 13.329 | 30.238 | 25 | 20 | 2 | Landed |
| 7 | Nakamura Lock | 8.437 | 30.017 | 20 | 10 | 0 | Landed |
| 8 | Classic Dart | 4.225 | 27.709 | 25 | 0 | -2 | Landed |
| 9 | Condor | 12.045 | 22.272 | 25 | 30 | 2 | Landed |
| 10 | Canard | 6.666 | 22.226 | 20 | 10 | 0 | Landed |
| 11 | Swallow | 5.230 | 14.180 | 25 | 10 | 0 | Landed |

## Why champion predictions differ from records

The former domain stopped at 10 m/s and 30° and scored only airtime. A still-air audit found that extending angles alone did not improve Suzanne or Sky King’s best airtime under the old speed cap; faster releases were responsible for their modeled gains. The new grid includes vertical releases and higher speeds equally for all designs. Standardized paper stock, upright zero-spin releases and estimated aerodynamic coefficients differ from the historical flights. See [the primary-source audit](competition-context.md).

## Integration-step sensitivity

The best launch settings selected above are replayed at 3 requested integration steps without retuning. Agreement checks numerical sensitivity of this model; it does not validate real-world aerodynamics. Repeated actual steps caused by sanitization count only once.

| Step (s) | Leading design | Leading airtime (s) | Original winner airtime (s) |
| ---: | --- | ---: | ---: |
| 0.00833 | Wide Glider | 13.32912 | 13.32912 |
| 0.00417 | Wide Glider | 13.32914 | 13.32914 |
| 0.00208 | Wide Glider | 13.32915 | 13.32915 |

The complete 3267-trial grid is also repeated independently at each finer step, giving 9801 grid-search trials in total. Every design receives the same search budget at each step.

| Step (s) | Trials | Grid winner | Airtime (s) | Speed (m/s) | Angle (°) | Trim (°) |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 0.00833 | 3267 | Wide Glider | 13.32912 | 25 | 20 | 2 |
| 0.00417 | 3267 | Wide Glider | 13.32914 | 25 | 20 | 2 |
| 0.00208 | 3267 | Wide Glider | 13.32915 | 25 | 20 | 2 |

Numerical check: **passes** at a declared 1% airtime tolerance between the finest two distinct steps. The leader must remain the same in both replay and complete-grid searches, and landing/cap status must stay consistent.

| Design | Replay change (%) | Grid optimum change (%) | Default-to-finest replay change (%) | Landing/cap status |
| --- | ---: | ---: | ---: | --- |
| Classic Dart | 0.000008 | 0.000008 | 0.000091 | Consistent |
| Nakamura Lock | 0.000202 | 0.000202 | 0.000342 | Consistent |
| Wide Glider | 0.000102 | 0.000102 | 0.000227 | Consistent |
| Delta Wing | 0.000111 | 0.000111 | 0.000715 | Consistent |
| Condor | 0.000004 | 0.000004 | 0.000143 | Consistent |
| Needle | 0.000000 | 0.000000 | 0.000000 | Consistent |
| Canard | 0.000263 | 0.000263 | 0.000315 | Consistent |
| Swallow | 0.000052 | 0.000052 | 0.000133 | Consistent |
| Suzanne | 0.000026 | 0.000026 | 0.000319 | Consistent |
| Sky King | 0.000203 | 0.000203 | 0.000799 | Consistent |
| Krstić Dart | 0.000006 | 0.000006 | 0.000024 | Consistent |

## Execution performance

The primary 3267-trial search took 17.871 s wall time and 17.841 s process CPU time on this execution machine. Maximum observed progress interval was 74.576 ms, with at most 12 trials between checkpoints. Browser optimization yields after 12 trials or 16 ms elapsed, whichever occurs first; a single flight simulation remains synchronous. Browser timing depends on hardware and scheduling.

## Interpretation and reproduction

This model integrates translational and rotational motion with aerodynamic forces/torques and a quaternion attitude. Gravity, moist-air density, pressure, viscosity, and Reynolds effects are calculated from atmospheric assumptions. Humidity changes air density; its effects on paper mass, stiffness and deformation are not modeled. Airframe geometry, aerodynamic coefficients, center-of-mass/aerodynamic-center positions, damping derivatives, efficiency, and inertia distribution remain estimates. Flexible-paper deformation, detailed fold CFD, and measured calibration are outside this model. Its numerical checks do not establish physical accuracy. The winner is the longest predicted completed flight within the finite launch/trim grid and these assumptions.

Source notes and coefficient assumptions are described in `docs/model.md` in the source bundle. Sources support the equations and atmospheric constants; they do not validate the estimated paper-plane coefficients.

- https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv
- https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,RH2M,WS2M,PS&community=AG&longitude=77.202&latitude=28.583&format=JSON
- https://cires1.colorado.edu/~voemel/vp.html
- https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/
- https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/induced-drag-coefficient/
- https://www.grc.nasa.gov/www/k-12/airplane/viscosity.html
- https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html
- https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/pages/lecture-notes/
- https://www.guinnessworldrecords.com/news/2026/5/evolution-of-the-paper-plane-flight-and-how-far-its-actually-possible-to-throw-one
- https://makezine.com/projects/worlds-best-paper-airplane/
- https://www.guinnessworldrecords.jp/news/2015/12/paperaircraft
- https://www.honda.co.jp/kids/jiyuu-kenkyu/challenge/c-13/skyking/
- https://www.guinnessworldrecords.com/world-records/729614-farthest-throw-at-the-red-bull-paper-plane-championship
- https://www.mensjournal.com/entertainment/how-to-make-best-paper-airplane


Run `npm run benchmark -- --seed 42` from the project directory to reproduce the metrics. `--output-dir <path>` changes the destination. All reported rows are generated from the shared physics engine used by the interactive simulator.

- `benchmark.json`: settings, airframe coefficients, full-precision metrics, search ranges, and step-sensitivity results.
- `benchmark.csv`: full-precision baseline, optimized, and independently refined-grid results for spreadsheets.

Software: fold-flight-lab 1.0.0; Three.js 0.186.1.
