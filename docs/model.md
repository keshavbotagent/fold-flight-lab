# Flight model: 2.1.0-moist-air

Earth gravity and air resistance are included. This version upgrades the original
flight-path pitch relaxation to a six-degree-of-freedom rigid-body model: three
position coordinates and three attitude axes. Aerodynamic forces accelerate the
plane, aerodynamic torques turn it, and the quaternion attitude determines how
the next forces act. No controller points the nose along the velocity.

The equations have stronger physical foundations than the first model. The
catalog's lift, drag, mass distribution, and stability coefficients remain
estimates. These results are predictions for comparing designs, not validated
records or proof of which real paper plane flies longest. Fold quality, stiffness,
launch technique, and air currents can change the ranking. This is not CFD and
cannot resolve the airflow around individual folds.

## Units and coordinates

Positions and lengths are meters, mass is kilograms, time is seconds, forces are
newtons, torques are newton-meters, and inertia is kg·m². World +X is downrange,
+Y is upward, and +Z is sideways. The body axes start as +X nose, +Y above the
wing, and +Z toward the right wing. Positive pitch rotates around +Z; positive
roll rotates around +X; positive yaw rotates around +Y, turning the nose toward
world −Z. Quaternions map body coordinates to world coordinates.

UI launch angle, trim, wind direction, and design dihedral are degrees. Recorded
pitch, roll, yaw, angle of attack, and angular rates use radians/radians per second.
Wind direction 0° is a tailwind along +X, 90° is along +Z, and 180° is a headwind.
Speed is m/s, temperature is °C, field elevation is meters above mean sea level,
and paper weight is grams per square meter.

Defaults are a 7 m/s launch, 12° elevation, 1.8 m release height, 80 gsm A4 paper,
the New Delhi representative environment (26°C, 46% relative humidity, 215 m
field elevation, 1008.3 hPa sea-level pressure, 2 m/s headwind), zero turbulence
and extra trim, and seed 42. Ground velocity is exactly the requested launch velocity. Initial attitude
is launch angle plus the airframe's trim angle and the chosen trim adjustment;
initial angular velocity is zero. There is no propulsion or extra launch energy.

## Earth gravity and atmosphere

Standard gravity is g₀ = 9.80665 m/s². The model estimates the variation with
absolute altitude h using a spherical Earth of radius R = 6,371,000 m:

```
g(h) = g₀ × (R / (R + h))²
h = fieldElevation + heightAboveGround
```

For example, a 2 m release on ground 1,500 m above mean sea level starts at
1,502 m above sea level. At landing it is back at 1,500 m, with height above ground
equal to zero. Negative ground elevations represent locations below sea level.
The **Ground elevation** control is under **Paper, wind & altitude**; live telemetry
shows absolute altitude as well as height above ground. CSV exports include
`release_altitude_msl_m` and `peak_altitude_msl_m`, in addition to ground elevation
and above-ground heights. Atmosphere diagnostics expose `altitudeMSL` explicitly.

Gravity acts vertically downward. This approximation excludes local latitude,
Earth rotation, and terrain anomalies; those effects are far smaller than the
uncertainty of the paper-plane coefficients in ordinary throws.

Pressure follows the International Standard Atmosphere troposphere formula with
editable sea-level pressure (standard reference 101,325 Pa), temperature 288.15 K, lapse rate 0.0065 K/m, and
specific gas constant 287.05287 J/(kg·K). Above 11 km, an isothermal pressure
continuation is used. The chosen field temperature is the local ground air
condition, decreasing with height at the lapse rate. The dry-air density limit
follows the ideal-gas law; dynamic viscosity follows Sutherland's relation:

```
ρdry = pressure / (287.05287 × temperatureKelvin)
μ = 1.716e−5 × (T / 273.15)^(3/2) × (273.15 + 110.4) / (T + 110.4)
```

At sea level and 15°C in dry air at 1013.25 hPa: gravity is 9.80665 m/s², density is approximately 1.225
kg/m³, and viscosity is approximately 1.7893 × 10⁻⁵ Pa·s. Height, warmer air, and
field elevation change the air density used by every force evaluation. This is
an ISA altitude-pressure reduction with editable sea-level pressure. Actual
humidity and temperature enter the local density; the vertical pressure column
retains standard-atmosphere assumptions.

### New Delhi defaults and humidity

The preset uses a Safdarjung reference at 28.585° N, 77.206° E and 215 m elevation,
rounded from NOAA's 214.9 m station datum. Temperature 26°C, relative humidity 46%,
and wind speed 2 m/s round nearby NASA POWER 2001–2020 annual gridded means
(25.6°C, 45.56%, 1.92 m/s). These are representative climate conditions, not live
weather or annual station observations. The 1008.3 hPa sea-level pressure is an
ISA estimate reducing the grid's 98.39 kPa surface pressure at 206.37 m; it gives
about 982.9 hPa at the 215 m simulation field. Headwind is chosen relative to the
launch direction and is not a claimed prevailing compass bearing.

Humidity enters density through Buck's 1996 saturation-vapor-pressure equation
over liquid water. With temperature t in °C and T in K, pressures are in Pa:

```
es = 611.21 × exp((18.678 − t/234.5) × t/(257.14 + t))
e = min(0.99 × pressure, relativeHumidity/100 × es)
ρ = (pressure − e)/(287.05287 × T) + e/(461.5 × T)
```

Zero humidity reproduces the dry-air limit exactly. At the same temperature and
pressure, humid air is less dense. Relative humidity is held constant over these
short flights; vapor conservation, condensation and latent heat are omitted.
Sutherland viscosity remains a dry-air approximation. Below freezing, humidity
remains relative to liquid-water saturation. Humidity effects on paper mass,
stiffness, creases and deformation are not modeled.

- [NOAA Safdarjung station metadata](https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv)
- [NASA POWER New Delhi climatology](https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,RH2M,WS2M,PS&community=AG&longitude=77.202&latitude=28.583&format=JSON)
- [CIRES vapor-pressure formulations, including Buck 1996](https://cires1.colorado.edu/~voemel/vp.html)

## Air-relative lift, drag, and stalls

Aerodynamics always use velocity relative to the instantaneous wind. Angle of
attack α is `atan2(−bodyVelocityY, bodyVelocityX)`, and sideslip β is
`atan2(bodyVelocityZ, hypot(bodyVelocityX, bodyVelocityY))`. These remain defined
for backwards flow and steep attitudes. The reference chord is c = wingArea/span,
an approximate mean chord rather than an exact mean aerodynamic chord for every
folded planform.

```
dynamicPressure = 0.5 × ρ × airSpeed²
aspectRatio = span² / wingArea
Reynolds = ρ × airSpeed × referenceChord / μ
lift = dynamicPressure × wingArea × CL
inducedCD = CL² / (π × spanEfficiency × aspectRatio)
```

Near zero angle of attack, CL is the design lift slope times α. Around the
estimated stall angle `maxCL/liftSlope`, a smooth blend changes this bounded
attached-flow lift into a flat-plate `0.9 × maxCL × sin(2α)` approximation. The
blend begins at 0.8 times the stall angle and completes at 1.6 times that angle.
Separated-flow drag grows as `1.5 × sin²(α)`. The backwards-flow limit therefore
has bounded forces rather than unbounded linear lift. The separation law is a
model assumption, not a measured stall polar.

Profile CD₀ is treated as the catalog estimate at Reynolds 50,000. A correction
adjusts only the two-sided flat-plate skin-friction contribution:

```
profileCD = max(0.005, CD₀ + 2 × [Cf(Reynolds) − Cf(50,000)])
CD = profileCD + inducedCD + separatedFlowDrag
```

Laminar skin friction is `1.328/sqrt(Re)`. A smooth transition between Reynolds
300,000 and 800,000 blends it into `0.074/Re^0.2 − 1742/Re` for turbulent flow.
Reynolds below 1,000 uses the 1,000 value to bound this empirical correction.
This corrects an existing friction allowance rather than adding a second copy.
Paper roughness, individual layers, and fold leakage are not resolved.

Lift acts along the body-up direction projected perpendicular to air-relative
velocity, so it performs no translational work in still air. Main drag opposes
that velocity. The additional side force is
`−dynamicPressure × wingArea × sideForceSlope × sin(β)` along body +Z. Its
velocity-parallel component is also dissipative. Returned drag and effective CD
include that component, so `drag = dynamicPressure × wingArea × effectiveCD`
and `aerodynamicForce · airVelocity = −drag × airSpeed`. The recorded signed lift
excludes side force. A gust or wind gradient can transfer energy to the plane.

## Torque, inertia, and attitude

Every design now has explicit estimated CG, aerodynamic-center location,
stability derivatives, and inertia factors. CG and aerodynamic-center values are
fractions of the reference chord. A positive static margin `AC − CG` produces a
restoring pitch derivative:

```
Cm = −staticMargin × liftSlope × sin(α − trimAngle)
     + pitchDamping × (omegaZ × chord / [2 × airSpeed])
pitchMoment = dynamicPressure × wingArea × chord × Cm
```

The sine bounds the large-angle static moment while preserving
`dCm/dα = −staticMargin × liftSlope` at the trim equilibrium. Pitch damping is
negative. Roll and yaw use span-scaled negative rate damping. Dihedral gives a
restoring roll moment from sideslip, and the estimated directional stability
gives a restoring yaw moment. Damping calculations are written as terms
proportional to airspeed rather than dividing by zero at zero airspeed.

Principal inertias are estimated from the folded paper mass distribution:

```
Ix = mass × span² × rollInertiaFactor
Iy = mass × (span² + length²) × yawInertiaFactor
Iz = mass × length² × pitchInertiaFactor
I × dω/dt + ω × (I × ω) = aerodynamicMoment
quaternionDerivative = 0.5 × quaternion × (bodyAngularVelocity, 0)
```

The catalog's inertia tensors are positive and satisfy the principal-inertia
triangle inequalities. Paper mass and inertia scale with paper weight; stiffness
and folding geometry do not. All eleven modeled configurations begin with the same uncut
A4 sheet. See [airframes.md](airframes.md) for the actual coefficient estimates.

This is rigid paper with lumped aerodynamic coefficients. It omits bending,
flutter, detailed center-of-pressure movement, canard interactions, and local
rotational flow across the wings. Near stalls or tumbling, these omitted effects
limit confidence even when the integration is numerically converged. It should
not be read as a fully calibrated aircraft simulator.

## Numerical integration and fair experiments

The translational Newton equations, body-axis Euler rotation equations, and
quaternion derivative are integrated together using fourth-order Runge–Kutta.
Quaternions are normalized after every full step. Adaptive substeps resolve
rotational damping, aerodynamic turn rates, and attitude changes; requested dt is
a maximum step. The default maximum is 1/120 s, with refinements down to 1/3840 s.
No arbitrary angular-rate clamp or active attitude alignment is used.

Recorded points are 30 Hz and are aligned with integration endpoints. Ground
contact uses a cubic Hermite height root inside the last step, followed by a
partial RK4 step to that time. The final point is exactly at Y = 0. There is no
bounce or post-landing slide. Maximum height also includes internal integration
points, so it can be higher than a recorded point.

The differential forces dissipate translational energy in still air; tests check
passivity, gravity-only analytical trajectories, torque-free rotation, atmospheric
values, moment signs, quaternion normalization, and timestep convergence.
Numerical validation of equations does not validate estimated design coefficients.

Duration is time to first ground contact. Distance is horizontal displacement,
not path length. Runs reaching the time limit are truncated and excluded from
completed winner claims. Comparisons use identical conditions or the same search
grid for every design. A finite sweep finds the best tested configuration, not a
global optimum. Independent sweeps at refined timesteps check whether the leader
and recorded airtimes are numerically stable. Results from model version 1 are
archived separately and must not be presented as current predictions.

Scientific tests can call `simulateFlight(design, settings, options)` with
`densityScale: 0`, `gravityScale: 0`, `gravityOverride`, or an explicit initial
angular velocity. These isolation controls are not part of ordinary user flight.
`evaluateAerodynamics` exposes force/torque and coefficients for independent
checks, and `getMassProperties` exposes the actual mass, chord, and inertia.

Nonfinite settings fall back to defaults. Finite inputs are bounded to speed
0–30 m/s, angle −45–80°, height 0–100 m, wind 0–20 m/s, turbulence 0–2, paper
40–240 gsm, trim −12–12°, temperature −60–60°C, field elevation −500–10,000 m,
relative humidity 0–100%, sea-level pressure 850–1100 hPa,
maximum time 0.01–180 s, and maximum timestep 1/3840–1/30 s. Returned settings
contain the values actually used. Invalid or nonpositive geometry/aerodynamic
constants and invalid damping/inertia values raise a RangeError. Extreme inputs
are numerically bounded, not experimentally validated.

## Sources for the equations

These references inform the equations and sign conventions; they do not validate
the catalog coefficients or folding instructions.

- NASA: [Drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/).
- NASA: [Induced drag coefficient](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/induced-drag-coefficient/).
- NASA: [Viscosity, Sutherland's relation, and Reynolds number](https://www.grc.nasa.gov/www/k-12/airplane/viscosity.html).
- NASA: [Standard atmosphere](https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html).
- MIT 16.333: [Aircraft stability and control lecture notes](https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/pages/lecture-notes/).
