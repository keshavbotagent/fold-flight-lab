# Validation record

Solver **`2.0.0-rigid-body`** passes 27 automated physics, experiment and shipped-data tests. The Chromium browser suite passes 12 groups of interface checks at 1440 × 900 and 390 × 844 pixels. Run `npm test` and, with Vite running on port 5173, `node scripts/browser-qa.mjs` to reproduce them.

These checks validate equations, numerical integration, consistency and interface behavior. They do not establish agreement with measured paper-plane flights. Aerodynamic coefficients, aerodynamic-center/center-of-gravity positions, damping derivatives and inertia factors are estimates; folding errors, flexibility, humidity and detailed separated flow remain outside this model.

| Independent control or invariant | What the tests establish |
|---|---|
| Constant-gravity vacuum | With explicit isolation options, positions and velocities match `x=vx₀t` and `y=h+vy₀t−gt²/2`; the landing time matches the positive quadratic root. A body initially at rest retains its attitude while gravity changes its velocity. |
| Principal-axis vacuum rotation | Quaternions follow the analytical constant-rate rigid-body solution and remain unit length. |
| Nonprincipal vacuum rotation | Euler gyroscopic coupling changes body rates while rotational energy and world angular momentum remain constant to a relative tolerance of 5 × 10⁻⁶. |
| Atmosphere | Sea-level pressure, density, gravity and Sutherland viscosity match reference values; temperature and elevation produce the expected trends. |
| Aerodynamic forces | Total effective drag obeys `D=½ρV²SCd`, including dissipative sideslip projection. Force power equals `−D·V` in still air, including stalled and reverse-flow cases. |
| Aerodynamic moments | Pitch error produces a restoring moment; damping opposes pitch rate; mirrored sideslip produces mirrored restoring yaw and dihedral roll. |
| Mechanical passivity | Exact inverse-square gravitational potential is used in energy checks. Translational and total mechanical energy decrease between samples; instantaneous force-plus-moment work stays nonpositive. A 768-state envelope chooses the angular rate that maximizes static-moment-plus-linear-damping power and still finds no positive net aerodynamic power. |
| Integration refinement | Selected flights are repeated at 120, 240, 480 and 960 Hz. Optimized launch replays retain the winning design at a finer step. The benchmark also performs complete equal-budget searches at three steps. |
| Experiment integrity | All designs use equal paper mass and identical held conditions, including temperature and elevation. Searches have equal exhaustive budgets, deterministic seeds, monotonic progress and working cancellation. Time-capped observations remain marked. |
| Shipped leaderboard | Every stored row contains the current solver version and complete launch conditions. Current reruns reproduce stored airtime, range and other metrics, and the actual reruns preserve the displayed rank order. |

The constant-gravity vacuum control measured a maximum position error of **3.47 × 10⁻¹⁴ m**, velocity error of **5.51 × 10⁻¹⁴ m/s**, and landing-time error of **2.25 × 10⁻¹³ s**. These near-roundoff results apply to the isolated analytical case, not ordinary aerodynamic flight.

At a shared 7 m/s, 12° launch from 1.8 m in still air, the largest deviation from 960 Hz among the selected Classic Dart, Wide Glider, Condor and Swallow runs at 120/240/480 Hz was **0.00378% in airtime** and **0.00405% in range**. Small integration errors do not reduce uncertainty in the estimated aerodynamic coefficients.

The current report selects **Condor**, with **7.0491 s** predicted airtime at 10 m/s, 30° launch and +2° trim. Three complete 840-trial grids at 120/240/480 Hz select the same design. The report's largest per-design airtime change between its two finest grids is **0.000415%**. See [`benchmark.md`](../public/reports/benchmark.md) for the complete conditions and results.

The browser suite checks live WebGL2, normalized quaternion attitude and shortest-arc interpolation, airframe and environmental controls, wind-relative airspeed versus ground speed, launch/pause/replay/scrubbing/cameras, one complete 840-trial search, CSV downloads, fold/model dialogs, mobile layout and zero JavaScript/console errors. Optional WebMCP registration is tested using a `document.modelContext` stub; native browser tool invocation was unavailable. Screenshots and the browser report are written to `artifacts/`.
