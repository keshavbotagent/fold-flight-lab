# Paper-plane flight experiment

**Condor has the longest completed flight in this search: 7.049 s**, covering 17.179 m at 10 m/s, a 30° launch angle, and 2° trim. This is a simulation prediction, not a physical endurance record.

The leader remains Condor at all 3 distinct tested integration steps, including independent complete equal-budget searches. Maximum airtime change between the finest two steps is 0.000415% for selected-launch replay and 0.000415% for grid optima; both satisfy the declared 1% numerical tolerance.

## Model revision comparison

The previous 1.0-aerodynamic-relaxation predictions are included alongside the current predictions in `benchmark.json`. This run uses **2.0.0-rigid-body**, with rigid-body force/torque, quaternion attitude, atmospheric conditions, and revised estimated coefficients. The common launch/weather/paper settings and 105-trial-per-design grid remain identical. These are before/after model predictions, not a physical accuracy comparison.

| Rank | Prior model design | Prior airtime (s) | Current model design | Current airtime (s) |
| ---: | --- | ---: | --- | ---: |
| 1 | Wide Glider | 6.856 | Condor | 7.049 |
| 2 | Condor | 6.710 | Wide Glider | 6.479 |
| 3 | Nakamura Lock | 6.459 | Nakamura Lock | 5.799 |

With one identical release for every airframe, Condor leads at 3.815 s.

## Fair comparison settings

All 8 airframes use 80 gsm paper, a 1.8 m release height, 0 m/s wind at 0°, turbulence 0, gust seed 42, maximum integration step 0.008333333333333333 s, and a 60 s time cap. Air temperature is 15 °C at field elevation 0 m. A4 paper area and stock determine mass consistently across all designs.

At release, gravity is 9.80664446 m/s², density 1.22478835 kg/m³, dynamic viscosity 1.78924117e-5 Pa·s, pressure 101303.378 Pa, and temperature 288.138 K. Ground reference values and SI unit definitions are recorded in JSON.

The baseline release uses 7 m/s speed, 12° elevation, and 0° additional trim. Rankings compare airtime first, then distance.
Distance is final horizontal displacement from launch.

| Rank | Design | Airtime (s) | Distance (m) | Peak height (m) | Status |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Condor | 3.815 | 11.575 | 3.004 | Landed |
| 2 | Wide Glider | 3.197 | 10.086 | 2.994 | Landed |
| 3 | Nakamura Lock | 2.826 | 9.102 | 3.056 | Landed |
| 4 | Delta Wing | 2.760 | 9.104 | 2.962 | Landed |
| 5 | Canard | 2.606 | 7.745 | 2.948 | Landed |
| 6 | Classic Dart | 2.578 | 10.875 | 2.697 | Landed |
| 7 | Needle | 2.359 | 11.111 | 2.445 | Landed |
| 8 | Swallow | 2.220 | 6.067 | 2.963 | Landed |

## Equal-budget launch and trim search

Each design receives exactly 105 trials (840 total): angles [0, 5, 10, 15, 20, 25, 30]°, speeds [4, 5.5, 7, 8.5, 10] m/s, and additional trim [-2, 0, 2]°. Only these three variables vary. Environment, paper, release height, seed, air temperature, and field elevation remain fixed. Each reported flight preserves its actual simulated settings.

Completed landings are eligible to win. Time-capped trajectories are censored observations: their duration is a lower bound and they are excluded from winner selection. If every trial of an airframe is capped, its marked fallback appears after completed flights.

| Rank | Design | Airtime (s) | Distance (m) | Speed (m/s) | Angle (°) | Trim (°) | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Condor | 7.049 | 17.179 | 10 | 30 | 2 | Landed |
| 2 | Wide Glider | 6.479 | 16.814 | 10 | 30 | 2 | Landed |
| 3 | Nakamura Lock | 5.799 | 15.979 | 10 | 30 | 2 | Landed |
| 4 | Canard | 5.050 | 13.101 | 10 | 30 | 2 | Landed |
| 5 | Delta Wing | 3.689 | 14.097 | 8.5 | 0 | 0 | Landed |
| 6 | Classic Dart | 3.278 | 15.932 | 10 | 0 | 0 | Landed |
| 7 | Needle | 3.217 | 17.684 | 10 | 5 | 0 | Landed |
| 8 | Swallow | 3.064 | 9.170 | 4 | 0 | 2 | Landed |

## Integration-step sensitivity

The best launch settings selected above are replayed at 3 requested integration steps without retuning. Agreement checks numerical sensitivity of this model; it does not validate real-world aerodynamics. Repeated actual steps caused by sanitization count only once.

| Step (s) | Leading design | Leading airtime (s) | Original winner airtime (s) |
| ---: | --- | ---: | ---: |
| 0.00833 | Condor | 7.04911 | 7.04911 |
| 0.00417 | Condor | 7.04911 | 7.04911 |
| 0.00208 | Condor | 7.04908 | 7.04908 |

The complete 840-trial grid is also repeated independently at each finer step, giving 2520 grid-search trials in total. Every design receives the same search budget at each step.

| Step (s) | Trials | Grid winner | Airtime (s) | Speed (m/s) | Angle (°) | Trim (°) |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 0.00833 | 840 | Condor | 7.04911 | 10 | 30 | 2 |
| 0.00417 | 840 | Condor | 7.04911 | 10 | 30 | 2 |
| 0.00208 | 840 | Condor | 7.04908 | 10 | 30 | 2 |

Numerical check: **passes** at a declared 1% airtime tolerance between the finest two distinct steps. The leader must remain the same in both replay and complete-grid searches, and landing/cap status must stay consistent.

| Design | Replay change (%) | Grid optimum change (%) | Default-to-finest replay change (%) | Landing/cap status |
| --- | ---: | ---: | ---: | --- |
| Classic Dart | 0.000000 | 0.000000 | 0.000001 | Consistent |
| Nakamura Lock | 0.000014 | 0.000014 | 0.000037 | Consistent |
| Wide Glider | 0.000231 | 0.000231 | 0.001119 | Consistent |
| Delta Wing | 0.000002 | 0.000002 | 0.000006 | Consistent |
| Condor | 0.000415 | 0.000415 | 0.000403 | Consistent |
| Needle | 0.000000 | 0.000000 | 0.000000 | Consistent |
| Canard | 0.000103 | 0.000103 | 0.000171 | Consistent |
| Swallow | 0.000000 | 0.000000 | 0.000003 | Consistent |

## Execution performance

The primary 840-trial search took 2.043 s wall time and 1.815 s process CPU time on this execution machine. Maximum observed progress interval was 32.678 ms, with at most 12 trials between checkpoints. Browser optimization yields after 12 trials or 16 ms elapsed, whichever occurs first; a single flight simulation remains synchronous. Browser timing depends on hardware and scheduling.

## Interpretation and reproduction

This model integrates translational and rotational motion with aerodynamic forces/torques and a quaternion attitude. Gravity, density, viscosity, and Reynolds effects are calculated from atmospheric assumptions. Airframe geometry, aerodynamic coefficients, center-of-mass/aerodynamic-center positions, damping derivatives, efficiency, and inertia distribution remain estimates. Flexible-paper deformation, detailed fold CFD, and measured calibration are outside this model. Its numerical checks do not establish physical accuracy. The winner is the longest predicted completed flight within the finite launch/trim grid and these assumptions.

Source notes and coefficient assumptions are described in `docs/model.md` in the source bundle. Sources support the equations and atmospheric constants; they do not validate the estimated paper-plane coefficients.

- https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/
- https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/induced-drag-coefficient/
- https://www.grc.nasa.gov/www/k-12/airplane/viscosity.html
- https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html
- https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/pages/lecture-notes/


Run `npm run benchmark -- --seed 42` from the project directory to reproduce the metrics. `--output-dir <path>` changes the destination. All reported rows are generated from the shared physics engine used by the interactive simulator.

- `benchmark.json`: settings, airframe coefficients, full-precision metrics, search ranges, and step-sensitivity results.
- `benchmark.csv`: full-precision baseline, optimized, and independently refined-grid results for spreadsheets.

Software: fold-flight-lab 1.0.0; Three.js 0.186.1.
