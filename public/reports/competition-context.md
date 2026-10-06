# Why competition planes differ from their records

Updated 6 October 2026. These are source-backed explanations and diagnostics of model assumptions, not measured paper-plane aerodynamics.

The lab defaults to **indoor still air: 0 m/s wind and zero gusts**. Temperature (26°C), humidity (46%), ground elevation (215 m) and sea-level pressure (1008.3 hPa) retain editable, representative New Delhi values. They are not venue observations. Walls, ceilings, ventilation and thermals are not modeled. Drag still acts on a moving plane in stationary air.

## What the historical flights establish

| Design | Verified source context | Unverified or different in the model |
| --- | --- | --- |
| Suzanne | [Collins’s construction guide](https://makezine.com/projects/worlds-best-paper-airplane/) specifies 100 gsm A4 with tape and a level launch. It reports about 9 seconds for the 226 ft 10 in distance record. [Guinness’s history](https://www.guinnessworldrecords.com/news/2026/5/evolution-of-the-paper-plane-flight-and-how-far-its-actually-possible-to-throw-one) records Collins/Ayoob’s 69.14 m flight on 26 February 2012. | Exact release speed and measured aerodynamic coefficients are unavailable. The standardized model uses 80 gsm by default and excludes tape mass. |
| Sky King | [Toda’s Honda folding guide](https://www.honda.co.jp/kids/jiyuu-kenkyu/challenge/c-13/skyking/) recommends a strong vertical launch and reversal into a glide at 10–20 m. [Guinness](https://www.guinnessworldrecords.jp/news/2015/12/paperaircraft) and [TIME](https://content.time.com/time/specials/packages/article/0,28804,1934027_1934003_1933991,00.html) document the former 27.9 s achievement and identify the fold. | The guide’s altitude is a technique target, not a measured altitude for the 2009 record. Exact release speed, record-specimen paper stock and full trajectory were not verified. Toda’s later 29.2 s result is a separate achievement. |
| Krstić Dart | [Guinness](https://www.guinnessworldrecords.com/world-records/729614-farthest-throw-at-the-red-bull-paper-plane-championship) documents the 61.11 m Red Bull World Final distance win in Salzburg on 14 May 2022. [Krstić’s interview](https://www.mensjournal.com/entertainment/how-to-make-best-paper-airplane) describes 100 gsm construction and an inverted release. | The model uses an upright, zero-spin release and common paper stock. Its span and reference area are disclosed visual estimates. Exact speed and measured coefficients are unavailable. |

## Why the old comparison was poor

1. **Different goal:** Suzanne and Krstić won distance events. The former lab ranked every plane only by airtime. The lab now lets you choose airtime or horizontal landing distance.
2. **Restricted launch energy:** the former search stopped at 10 m/s and 30°. A still-air audit found that expanding angles alone did not improve Suzanne or Sky King’s best modeled airtime at that speed cap; faster releases caused their gains. The current shared domain includes true vertical releases and speeds through 25 m/s. These are candidate inputs, not documented competition velocities.
3. **Standardized materials and release:** the same A4 stock, release height, environment and upright zero-spin attitude are used for every model. Specialized stock, tape, fold tolerances, flexible deformation and inverted releases differ from real performances.
4. **Estimated aerodynamics:** lift/drag polars, CG, aerodynamic center, damping and inertia are unmeasured estimates. Numerical convergence cannot establish which physical paper plane performs best.

The shared grid is `[0,5,10,15,20,25,30,45,60,75,90]° × [4,5.5,7,8.5,10,15,17.5,20,25] m/s × [-2,0,2]° trim`: **297 trials per design, 3,267 per objective**. All original candidates remain included. Completed landings can win; capped trajectories remain marked. A numerical resemblance to a record is not calibration.

## Corrected generic glider geometry

The prior generic Condor and Wide Glider spans exceeded the dimensions implied by their landscape-A4 guides. Their nominal flat reference geometry is now consistent with those idealized folds:

- Wide Glider: 277 mm span, 358.1775 cm² exposed wing area, 180 mm length. A 10 mm center keel and 30 mm nose fold determine this geometry.
- Condor: 257 mm principal-wing span, 461.6 cm² wing area, 180 mm length. Two 15 mm front rolls, 10 mm keel, 10 mm upright tip strips and 20 mm corner folds determine it. Upright fins are excluded from reference area.

The source repository’s `docs/model.md` contains the area derivations. These are nominal constructions, not surveyed specimens. Dimensionless aerodynamic coefficients remain unchanged and uncalibrated; there are no champion bonuses or fits to record results.

## What the chosen polars imply

At reference Reynolds number 50,000, ignoring separation, sideslip, pitching and Reynolds correction, the model uses `AR=b²/S`, `K=1/(πeAR)` and `CD=CD0+K CL²`. The idealized maximum lift-to-drag ratio is `1/[2 sqrt(CD0 K)]`:

| Model | Estimated aspect ratio | Idealized maximum L/D |
| --- | ---: | ---: |
| Wide Glider | 2.142 | 5.41 |
| Condor | 1.431 | 4.34 |
| Suzanne | 1.146 | 4.16 |
| Sky King | 1.278 | 4.03 |
| Krstić Dart | 0.337 | 2.32 |

These are conditional diagnostics of chosen coefficients, not flight observations. Krstić’s neutral-trim estimate at 7 m/s in still air supports only about 10% of its weight; its short slow-launch flight is unsurprising in this model. Low-aspect-ratio folded darts also make the induced-drag approximation especially uncertain. [NASA’s drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/) emphasizes reference-area consistency and experimental coefficient determination; [NASA’s induced-drag description](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/induced-drag-coefficient/) explains the approximation used here.

See [the current benchmark](benchmark.md) for actual tested settings, both objectives and numerical sensitivity. Physical validation requires measured geometry, repeatable releases and trajectories with uncertainty; historical record results alone cannot supply those missing data.
