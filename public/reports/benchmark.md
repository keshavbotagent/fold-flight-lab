# Paper-plane flight experiment

**Wide Glider has the longest completed flight in this search: 6.856 s**, covering 20.143 m at 8.5 m/s, a 0° launch angle, and 2° trim. This is a simulation prediction, not a physical endurance record.

The leader remains Wide Glider at all three tested integration steps, including independent repeats of the complete equal-budget search.

With one identical release for every airframe, Condor leads at 5.372 s.

## Fair comparison settings

All 8 airframes use 80 gsm paper, a 1.8 m release height, 0 m/s wind at 0°, turbulence 0, gust seed 42, integration step 0.008333333333333333 s, and a 60 s time cap. A4 paper area and stock determine mass consistently across all designs.

The baseline release uses 7 m/s speed, 12° elevation, and 0° additional trim. Rankings compare airtime first, then distance.
Distance is final horizontal displacement from launch.

| Rank | Design | Airtime (s) | Distance (m) | Peak height (m) | Status |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Condor | 5.372 | 15.929 | 2.927 | Landed |
| 2 | Wide Glider | 5.106 | 15.913 | 2.929 | Landed |
| 3 | Nakamura Lock | 4.671 | 15.528 | 2.986 | Landed |
| 4 | Canard | 4.217 | 13.110 | 2.862 | Landed |
| 5 | Delta Wing | 4.110 | 13.859 | 2.911 | Landed |
| 6 | Swallow | 3.938 | 12.605 | 2.838 | Landed |
| 7 | Classic Dart | 3.400 | 13.430 | 2.731 | Landed |
| 8 | Needle | 2.889 | 13.015 | 2.519 | Landed |

## Equal-budget launch and trim search

Each design receives exactly 105 trials (840 total): angles [0, 5, 10, 15, 20, 25, 30]°, speeds [4, 5.5, 7, 8.5, 10] m/s, and additional trim [-2, 0, 2]°. Only these three variables vary. Environment, paper, release height, and seed remain fixed. Each reported flight preserves its actual simulated settings.

Completed landings are eligible to win. Time-capped trajectories are censored observations: their duration is a lower bound and they are excluded from winner selection. If every trial of an airframe is capped, its marked fallback appears after completed flights.

| Rank | Design | Airtime (s) | Distance (m) | Speed (m/s) | Angle (°) | Trim (°) | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Wide Glider | 6.856 | 20.143 | 8.5 | 0 | 2 | Landed |
| 2 | Condor | 6.710 | 17.959 | 7 | 0 | 2 | Landed |
| 3 | Nakamura Lock | 6.459 | 20.746 | 8.5 | 0 | 2 | Landed |
| 4 | Delta Wing | 5.884 | 21.963 | 10 | 0 | 2 | Landed |
| 5 | Canard | 5.438 | 16.934 | 8.5 | 0 | 2 | Landed |
| 6 | Swallow | 4.793 | 15.900 | 8.5 | 0 | 2 | Landed |
| 7 | Classic Dart | 4.460 | 19.939 | 10 | 0 | 2 | Landed |
| 8 | Needle | 4.058 | 19.948 | 10 | 0 | 2 | Landed |

## Integration-step sensitivity

The best launch settings selected above are replayed at three integration steps without retuning. Agreement checks numerical stability of this model; it does not validate real-world aerodynamics.

| Step (s) | Leading design | Leading airtime (s) | Original winner airtime (s) |
| ---: | --- | ---: | ---: |
| 0.00833 | Wide Glider | 6.85644 | 6.85644 |
| 0.00417 | Wide Glider | 6.86827 | 6.86827 |
| 0.00208 | Wide Glider | 6.86593 | 6.86593 |

The complete 840-trial grid is also repeated independently at each finer step, giving 2520 grid-search trials in total. Every design receives the same search budget at each step.

| Step (s) | Trials | Grid winner | Airtime (s) | Speed (m/s) | Angle (°) | Trim (°) |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 0.00833 | 840 | Wide Glider | 6.85644 | 8.5 | 0 | 2 |
| 0.00417 | 840 | Wide Glider | 6.86827 | 8.5 | 0 | 2 |
| 0.00208 | 840 | Wide Glider | 6.86593 | 8.5 | 0 | 2 |

## Interpretation and reproduction

The simulator uses heuristic aerodynamic coefficients and simplified stability. It cannot reproduce detailed fold geometry, deformation, center-of-mass errors, room drafts, or human release variability. The winner is the longest predicted flight within this finite launch/trim grid and these assumptions; other grid bounds or physical calibration may change the ranking.

Run `npm run benchmark -- --seed 42` from the project directory to reproduce the metrics. `--output-dir <path>` changes the destination. All reported rows are generated from the shared physics engine used by the interactive simulator.

- `benchmark.json`: settings, airframe coefficients, full-precision metrics, search ranges, and step-sensitivity results.
- `benchmark.csv`: full-precision baseline, optimized, and independently refined-grid results for spreadsheets.

Software: fold-flight-lab 1.0.0; Three.js 0.186.1.
