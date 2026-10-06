# Airframe assumptions

The catalog represents eight familiar folded-paper configurations: Classic Dart,
Nakamura Lock, Wide Glider, Delta Wing, Condor, Needle, Canard, and Swallow. The
folding steps are practical starting points for an uncut A4 sheet. The names
describe families of folds; a hand-folded example may have different dimensions.

Every design starts with one 210 × 297 mm sheet at 80 g/m², a mass of 4.9896 g.
Changing the paper-weight control should scale this mass consistently for every
design. The plane has no clips, tape, cuts, or other added mass.

Wing area is the estimated projected lifting area after folding, not the original
sheet area. Span and length describe the representative flying configuration.
The canard's area includes its forward tabs. Its rendering and flight model are
representations rather than an exact crease-pattern reconstruction.

Drag coefficient, lift slope, maximum lift coefficient, trim angle, stability,
dihedral, mass distribution, and all stability derivatives are engineering
estimates. They are not measured wind-tunnel data, calibrated flight-test data,
or certified performance. Lift slopes are per radian; angles are in degrees;
mass, lengths, and areas use SI units.

The broad configurations trade lower wing loading for more profile drag. The
narrow darts trade smaller wings for a slender shape. Folded nose layers, swept
wings, raised tips, and forward tabs are represented through geometry and these
estimated coefficients. The legacy `stability` field is a relative design
indicator; the model-v2 `dynamics` objects provide explicit estimated restoring
and damping coefficients.

## Model-v2 mass and moment assumptions

The six-degree-of-freedom rigid-body model uses estimated diagonal moments of
inertia and aerodynamic moments. Fold layers near the nose and center keel
concentrate mass, so a solid uniform rectangular sheet would be an unsuitable
inertia model. The factors below represent that concentration without claiming
to reconstruct every layer of a real fold.

The reference chord is the characteristic mean wing chord `c = wingArea / span`.
CG and aerodynamic-center positions are fractions of this chord, measured aft
from a nominal main-wing leading-edge reference. This is an approximation: it is
not an exact mean aerodynamic chord reconstructed from tapered crease geometry.
The aerodynamic center is an effective whole-airframe moment reference.

Static margin is `aerodynamicCenter − centerOfGravity`. A positive margin gives
a restoring lift-related pitching slope:

```text
Cmα = −staticMargin × liftSlope
```

For most configurations, the effective aerodynamic center is assumed at 25% of
the reference chord. The canard uses 21% to represent a forward shift from its
lifting tabs; this is an uncalibrated configuration assumption. A physical canard
requires individual foreplane and main-wing force and moment measurements to
identify its actual neutral point.

| Design | CG (% chord) | Effective AC (% chord) | Static margin (% chord) | Pitch damping Cm_q | Span efficiency e |
| --- | ---: | ---: | ---: | ---: | ---: |
| Classic Dart | 16.5 | 25 | 8.5 | −2.6 | 0.67 |
| Nakamura Lock | 16 | 25 | 9 | −3.6 | 0.78 |
| Wide Glider | 18 | 25 | 7 | −3.0 | 0.80 |
| Delta Wing | 18.5 | 25 | 6.5 | −2.5 | 0.71 |
| Condor | 17.5 | 25 | 7.5 | −3.2 | 0.82 |
| Needle | 17 | 25 | 8 | −3.0 | 0.62 |
| Canard | 15.5 | 21 | 5.5 | −2.0 | 0.73 |
| Swallow | 20.5 | 25 | 4.5 | −1.5 | 0.70 |

Damping derivatives are dimensionless coefficients for nondimensional angular
rates: roll and yaw rates use `rate × span / (2 × airspeed)`, and pitch uses
`rate × chord / (2 × airspeed)`. Their negative signs oppose rotation.
`yawStability` is a positive conventional directional restoring derivative;
`sideForceSlope` is a positive magnitude, giving `CYβ = −sideForceSlope`.
These angle derivatives are per radian. The solver maps those signs into its
right-handed body axes, with forward +X, up +Y, and starboard +Z; conventional
positive yaw toward starboard is rotation about −Y.

| Design | Roll damping Cl_p | Yaw damping Cn_r | Directional slope Cn_β | Side-force slope magnitude |
| --- | ---: | ---: | ---: | ---: |
| Classic Dart | −0.28 | −0.18 | 0.065 | 0.42 |
| Nakamura Lock | −0.41 | −0.22 | 0.075 | 0.52 |
| Wide Glider | −0.46 | −0.16 | 0.038 | 0.33 |
| Delta Wing | −0.32 | −0.16 | 0.048 | 0.38 |
| Condor | −0.50 | −0.22 | 0.060 | 0.45 |
| Needle | −0.22 | −0.18 | 0.060 | 0.48 |
| Canard | −0.34 | −0.14 | 0.040 | 0.36 |
| Swallow | −0.25 | −0.11 | 0.030 | 0.28 |

With mass `m`, span `b`, and length `l`, the diagonal inertias in kg·m² are:

```text
Iroll  = rollInertiaFactor  × m × b²
Ipitch = pitchInertiaFactor × m × l²
Iyaw   = yawInertiaFactor   × m × (b² + l²)
```

| Design | Roll factor | Pitch factor | Yaw factor |
| --- | ---: | ---: | ---: |
| Classic Dart | 0.026 | 0.065 | 0.055 |
| Nakamura Lock | 0.050 | 0.058 | 0.052 |
| Wide Glider | 0.065 | 0.052 | 0.060 |
| Delta Wing | 0.045 | 0.065 | 0.055 |
| Condor | 0.075 | 0.055 | 0.068 |
| Needle | 0.022 | 0.074 | 0.065 |
| Canard | 0.047 | 0.055 | 0.049 |
| Swallow | 0.051 | 0.067 | 0.058 |

All resulting principal inertias are positive and satisfy the rigid-body triangle
inequalities: no principal inertia exceeds the sum of the other two. These
checks establish a physically admissible diagonal tensor, not a measured mass
distribution. Off-diagonal inertia products, flexible wings, and fold deformation
are omitted.

## Low-Reynolds-number limits and references

For the catalog's reference chords and the default search speeds, Reynolds
numbers are roughly 20,000–60,000 at sea-level room conditions. Boundary-layer
transition, sharp-edge separation, and fold roughness can materially affect lift
and drag in this range. An analytic Reynolds correction and induced-drag formula
provide a transparent approximation; they cannot identify a particular folded
plane's true drag polar without calibration.

The following public sources support the equation forms and conventions. They
do not supply the eight designs' numerical coefficients:

- [NASA Glenn: Drag Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)
  explains `D = ½ ρ V² S CD`, reference-area consistency, and why drag coefficients
  generally need experimental determination.
- [NASA Glenn: Induced Drag Coefficient](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/induced-drag-coefficient/)
  gives `CDi = CL² / (π e AR)` and `AR = span² / wingArea`. Applying this relation
  to low-aspect-ratio folded wings remains an approximation.
- [NASA Glenn: Viscosity](https://www.grc.nasa.gov/www/k-12/airplane/viscosity.html)
  describes Sutherland's temperature dependence and the viscosity-based Reynolds
  number. [Reynolds Number](https://www.grc.nasa.gov/www/k-12/airplane/reynolds.html)
  explains why similar Reynolds numbers matter when transferring aerodynamic
  data.
- [NASA Glenn: Earth Atmosphere Model](https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html)
  explains altitude-dependent pressure, temperature, and density. See
  [the implemented model](model.md) for this simulator's exact equations.
- MIT OpenCourseWare 16.333: [Static Stability](https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/resources/lecture_2/),
  [Aircraft Dynamics](https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/resources/lecture_4/),
  and [Aircraft Lateral Dynamics](https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/resources/lecture_8/)
  provide the conventional static-margin, moment, inertia, and damping framework.

Calibrating a specific real fold would require measuring its geometry, balance
point, inertias, and flight trajectories at repeatable launches, then estimating
its aerodynamic derivatives with uncertainty. No such measurements are included.

A catalog entry contains no flight duration, ranking, or winner. Those values
must come from the shared flight simulation and an equal launch search for each
design. A simulated winner applies to the selected environment, launch ranges,
trim, and model assumptions. It does not establish a real-world record or prove
that one fold is best for every paper sheet or throw.
