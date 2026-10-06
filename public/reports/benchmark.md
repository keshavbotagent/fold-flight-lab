# Paper-plane flight experiment

**Condor has the longest completed flight in this search: 7.972 s**, covering 4.346 m at 10 m/s, a 25° launch angle, and 2° trim. This is a simulation prediction, not a physical endurance record.

The leader remains Condor at all 3 distinct tested integration steps, including independent complete equal-budget searches. Maximum airtime change between the finest two steps is 0.000751% for selected-launch replay and 0.000751% for grid optima; both satisfy the declared 1% numerical tolerance.

## Model revision comparison

The previous 1.0-aerodynamic-relaxation predictions are included alongside the current predictions in `benchmark.json`. This run uses **2.1.0-moist-air**, with rigid-body force/torque, quaternion attitude, atmospheric conditions, and revised estimated coefficients. The shared conditions or grid also differ; changes cannot be attributed solely to the model revision. These are before/after model predictions, not a physical accuracy comparison.

| Rank | Prior model design | Prior airtime (s) | Current model design | Current airtime (s) |
| ---: | --- | ---: | --- | ---: |
| 1 | Wide Glider | 6.856 | Condor | 7.972 |
| 2 | Condor | 6.710 | Wide Glider | 7.579 |
| 3 | Nakamura Lock | 6.459 | Nakamura Lock | 6.748 |

With one identical release for every airframe, Condor leads at 4.230 s.

## Fair comparison settings

Default environment: **New Delhi, India**, Safdarjung reference at 28.585° N, 77.206° E. Temperature, humidity and wind speed are rounded 2001–2020 NASA POWER annual gridded means. NOAA metadata supplies the rounded 215 m elevation. Sea-level pressure is an ISA estimate from the climate grid surface pressure; headwind direction is a simulation choice. This is a reproducible representative preset, not current weather.

Relative humidity is 46%; sea-level-reduced pressure is 1008.3 hPa. These remain identical for every trial. Local pressure and moist-air density are recomputed at the plane's altitude.

All 8 airframes use 80 gsm paper, a 1.8 m release height, 2 m/s wind at 180°, turbulence 0, gust seed 42, maximum integration step 0.008333333333333333 s, and a 60 s time cap. Air temperature is 26 °C at field elevation 215 m. A4 paper area and stock determine mass consistently across all designs.

At release, gravity is 9.80598261 m/s², density 1.13756317 kg/m³, dynamic viscosity 1.84183606e-5 Pa·s, pressure 98265.102 Pa, and temperature 299.138 K. Ground reference values and SI unit definitions are recorded in JSON.

The baseline release uses 7 m/s speed, 12° elevation, and 0° additional trim. Rankings compare airtime first, then distance.
Distance is final horizontal displacement from launch.

| Rank | Design | Airtime (s) | Distance (m) | Peak height (m) | Status |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Condor | 4.230 | 5.039 | 3.648 | Landed |
| 2 | Wide Glider | 3.492 | 4.931 | 3.655 | Landed |
| 3 | Nakamura Lock | 3.004 | 4.358 | 3.811 | Landed |
| 4 | Classic Dart | 2.977 | 7.469 | 3.558 | Landed |
| 5 | Delta Wing | 2.879 | 4.284 | 3.734 | Landed |
| 6 | Needle | 2.868 | 9.202 | 3.138 | Landed |
| 7 | Canard | 2.745 | 3.140 | 3.608 | Landed |
| 8 | Swallow | 2.333 | 1.561 | 3.660 | Landed |

## Equal-budget launch and trim search

Each design receives exactly 105 trials (840 total): angles [0, 5, 10, 15, 20, 25, 30]°, speeds [4, 5.5, 7, 8.5, 10] m/s, and additional trim [-2, 0, 2]°. Only these three variables vary. Environment, paper, release height, seed, air temperature, and field elevation remain fixed. Each reported flight preserves its actual simulated settings.

Completed landings are eligible to win. Time-capped trajectories are censored observations: their duration is a lower bound and they are excluded from winner selection. If every trial of an airframe is capped, its marked fallback appears after completed flights.

| Rank | Design | Airtime (s) | Distance (m) | Speed (m/s) | Angle (°) | Trim (°) | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Condor | 7.972 | 4.346 | 10 | 25 | 2 | Landed |
| 2 | Wide Glider | 7.579 | 5.109 | 10 | 30 | 2 | Landed |
| 3 | Nakamura Lock | 6.748 | 6.341 | 10 | 25 | 2 | Landed |
| 4 | Canard | 5.594 | 3.779 | 10 | 30 | 2 | Landed |
| 5 | Delta Wing | 5.581 | 6.393 | 10 | 30 | 2 | Landed |
| 6 | Needle | 3.595 | 14.457 | 10 | 0 | 0 | Landed |
| 7 | Classic Dart | 3.473 | 10.519 | 10 | 0 | 0 | Landed |
| 8 | Swallow | 2.984 | 1.996 | 10 | 15 | 2 | Landed |

## Integration-step sensitivity

The best launch settings selected above are replayed at 3 requested integration steps without retuning. Agreement checks numerical sensitivity of this model; it does not validate real-world aerodynamics. Repeated actual steps caused by sanitization count only once.

| Step (s) | Leading design | Leading airtime (s) | Original winner airtime (s) |
| ---: | --- | ---: | ---: |
| 0.00833 | Condor | 7.97225 | 7.97225 |
| 0.00417 | Condor | 7.97210 | 7.97210 |
| 0.00208 | Condor | 7.97215 | 7.97215 |

The complete 840-trial grid is also repeated independently at each finer step, giving 2520 grid-search trials in total. Every design receives the same search budget at each step.

| Step (s) | Trials | Grid winner | Airtime (s) | Speed (m/s) | Angle (°) | Trim (°) |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 0.00833 | 840 | Condor | 7.97225 | 10 | 25 | 2 |
| 0.00417 | 840 | Condor | 7.97210 | 10 | 25 | 2 |
| 0.00208 | 840 | Condor | 7.97215 | 10 | 25 | 2 |

Numerical check: **passes** at a declared 1% airtime tolerance between the finest two distinct steps. The leader must remain the same in both replay and complete-grid searches, and landing/cap status must stay consistent.

| Design | Replay change (%) | Grid optimum change (%) | Default-to-finest replay change (%) | Landing/cap status |
| --- | ---: | ---: | ---: | --- |
| Classic Dart | 0.000008 | 0.000008 | 0.000083 | Consistent |
| Nakamura Lock | 0.000751 | 0.000751 | 0.001657 | Consistent |
| Wide Glider | 0.000348 | 0.000348 | 0.000639 | Consistent |
| Delta Wing | 0.000236 | 0.000236 | 0.001169 | Consistent |
| Condor | 0.000540 | 0.000540 | 0.001284 | Consistent |
| Needle | 0.000000 | 0.000000 | 0.000000 | Consistent |
| Canard | 0.000054 | 0.000054 | 0.001325 | Consistent |
| Swallow | 0.000002 | 0.000002 | 0.001121 | Consistent |

## Execution performance

The primary 840-trial search took 2.220 s wall time and 2.366 s process CPU time on this execution machine. Maximum observed progress interval was 46.067 ms, with at most 12 trials between checkpoints. Browser optimization yields after 12 trials or 16 ms elapsed, whichever occurs first; a single flight simulation remains synchronous. Browser timing depends on hardware and scheduling.

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


Run `npm run benchmark -- --seed 42` from the project directory to reproduce the metrics. `--output-dir <path>` changes the destination. All reported rows are generated from the shared physics engine used by the interactive simulator.

- `benchmark.json`: settings, airframe coefficients, full-precision metrics, search ranges, and step-sensitivity results.
- `benchmark.csv`: full-precision baseline, optimized, and independently refined-grid results for spreadsheets.

Software: fold-flight-lab 1.0.0; Three.js 0.186.1.
