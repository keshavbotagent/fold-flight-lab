# Airframe assumptions

The catalogue contains eight familiar fold families and three documented
international champions: Suzanne, Sky King and Krstić Dart. All models have
representative projected geometry and uncalibrated coefficients. The new
illustrations adapt public methods; a folded specimen may have different dimensions.

Every design starts with one 210 × 297 mm sheet at 80 g/m², a mass of 4.9896 g.
Changing the paper-weight control should scale this mass consistently for every
design. The simulated plane has no clips, tape, cuts, or other added mass. Historical
record specimens and their throwing conditions differ from these fair-test models.

Wing area is the estimated projected lifting area after folding, not the original
sheet area. Span and length describe the representative flying configuration.
The canard's area includes its forward tabs. Its rendering and flight model are
representations rather than an exact crease-pattern reconstruction.

The illustrated **Fold guide** provides a separate action and result diagram for
every step of all eleven configurations. Fold lines, motion arrows, layer edges,
and explicitly labeled top, side, and front views explain the paper changes.
Final views show each design’s wing/body arrangement; Sky King has a dorsal keel
and downturned tip strips. The diagrams are schematic instructions, not scaled cutting templates;
no design calls for cutting the A4 sheet. The canard is a representative exposed-
flap construction, with its main wing folds behind the front-tab hinges.

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

## Competition provenance and adaptations

| Design | Documented achievement | Public construction source | Model adaptation |
| --- | --- | --- | --- |
| Suzanne | [Former distance world record, 69.14 m, February 2012](https://www.guinnessworldrecords.com/news/2026/5/evolution-of-the-paper-plane-flight-and-how-far-its-actually-possible-to-throw-one) | [John Collins’s own tutorial](https://makezine.com/projects/worlds-best-paper-airplane/) | Tape-free A4 version; historical record used 100 gsm A4 and tape. |
| Sky King | [Former 27.9 s airtime record, 2009](https://www.guinnessworldrecords.jp/news/2015/12/paperaircraft) | [Toda-supervised Honda Kids photographs](https://www.honda.co.jp/kids/jiyuu-kenkyu/challenge/c-13/skyking/) | Original schematic nose-pocket construction; estimated keel/tip dimensions derived from the illustrated fold. |
| Krstić Dart | [2022 Red Bull Paper Wings world-final distance winner, 61.11 m, 14 May](https://www.guinnessworldrecords.com/world-records/729614-farthest-throw-at-the-red-bull-paper-plane-championship) | [Krstić’s published championship method](https://www.mensjournal.com/entertainment/how-to-make-best-paper-airplane) | Descriptive simulator name, grouped diagrams, 80 gsm default; original method recommends 100 gsm and an inverted throw. |

The selection favors established champions whose folding methods are public;
it is not a universal ranking or a claim that these remain current record holders.
Suzanne’s exact 26 February 2012 date and McClellan venue are corroborated by
[the photographer’s contemporary eyewitness account](https://ksimonian.com/Blog/2012/02/29/former-cal-quarterback-joe-ayoob-sets-paper-airplane-world-distance-record-inside-a-hanger-at-mcclellan-air-force-base-near-sacramento-ca/).
Sky King is linked to the April 2009 flight by [contemporaneous TIME reporting](https://content.time.com/time/specials/packages/article/0,28804,1934027_1934003_1933991,00.html).
Do not substitute Toda’s later 29.2 s flight for this 27.9 s achievement. The latest
published Guinness [distance](https://www.guinnessworldrecords.com/world-records/farthest-flight-by-a-paper-aircraft)
and [duration](https://www.guinnessworldrecords.com/world-records/longest-time-flying-a-paper-aircraft)
pages, checked 6 October 2026, list different record flights.

| New model | Span (m) | Length (m) | Lifting area (m²) | CD₀ | Lift slope (/rad) | CL max | Neutral trim | Wing dihedral |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Suzanne | 0.142 | 0.206 | 0.0176 | 0.040 | 2.50 | 0.98 | 4.8° | 10° effective |
| Sky King | 0.1485 | 0.1395 | 0.01725 | 0.047 | 2.80 | 1.00 | 5.8° | −3° |
| Krstić Dart | 0.035 | 0.195 | 0.00364 | 0.027 | 1.05 | 0.50 | 2.7° | 2° |

Krstić’s 195 mm construction check is a sourced written dimension. Suzanne’s
rounded geometry comes from the illustrated A4 hinges and the creator’s white-gap
wing-fold criterion. These and other values are modeling/construction estimates,
not authenticated record-aircraft measurements.
Sky King’s idealized A4 construction leaves about 15.4 mm for each dorsal-keel
half and each tip strip. Suzanne’s rendering interpolates Collins’s front/mid-wing
dihedral references; its aerodynamic model uses a single estimated effective angle.
Krstić’s exceptionally low aspect ratio makes the finite-wing drag approximation
especially uncertain. None of these coefficients was fitted to record performance.

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
| Suzanne | 16.5 | 25 | 8.5 | −3.3 | 0.77 |
| Sky King | 16.5 | 25 | 8.5 | −3.4 | 0.76 |
| Krstić Dart | 18 | 25 | 7 | −3.6 | 0.55 |

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
| Suzanne | −0.39 | −0.20 | 0.065 | 0.45 |
| Sky King | −0.43 | −0.24 | 0.080 | 0.58 |
| Krstić Dart | −0.20 | −0.20 | 0.065 | 0.62 |

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
| Suzanne | 0.045 | 0.060 | 0.049 |
| Sky King | 0.055 | 0.065 | 0.049 |
| Krstić Dart | 0.024 | 0.065 | 0.0633 |

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
do not supply the eleven designs' numerical coefficients:

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

A catalogue entry’s documented historical achievement is independent metadata;
it contains no predicted duration, ranking, or winner. Predicted values
must come from the shared flight simulation and an equal launch search for each
design. A simulated winner applies to the selected environment, launch ranges,
trim, and model assumptions. It does not establish a real-world record or prove
that one fold is best for every paper sheet or throw.
