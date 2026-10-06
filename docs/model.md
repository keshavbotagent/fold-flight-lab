# Flight model and what the results mean

This is an interactive comparison of estimated paper-plane aerodynamics. The
designs are recognizable folding families; their drag, lift, and stability values
are estimates, not wind-tunnel measurements. A winning simulation is a candidate
for a real throw test, not proof of the longest-flying paper airplane. Fold quality,
paper stiffness, humidity, launch technique, and room air currents can change the
order. This model does not run CFD or resolve the folds' airflow.

## Units and launch

Positions are meters and time is seconds. +X is downrange, +Y is up, and +Z is
sideways. Speed is m/s, paper weight is grams per square meter, and launch angle,
trim, wind direction, design trim angle, and dihedral are degrees. The recorded
trajectory pitch and roll are radians for Three.js. Wind direction 0° is a tailwind
along +X, 90° is along +Z, and 180° is a headwind.

Defaults are a 7 m/s launch, 12° elevation, 1.8 m release height, 80 gsm paper,
zero wind and turbulence, zero additional elevator trim, and seed 42. The initial
ground velocity is exactly the requested launch velocity. No extra energy or
powered flight is added. Mass scales with paper weight; all catalog designs start
with the same A4 sheet mass. Stiffness does not scale with paper weight here.

## Forces

Gravity is 9.81 m/s² directly downward. Air density is 1.225 kg/m³. Aerodynamic
forces use the velocity relative to the current wind:

```
q = 0.5 × airDensity × airSpeed²
aspectRatio = span² / wingArea
lift = q × wingArea × CL
drag = q × wingArea × CD
CD = CD0 + CL² / (π × efficiency × aspectRatio) + stallDrag
```

Lift is perpendicular to air-relative velocity; drag opposes it. The estimated
span efficiency is 0.58 + 0.17 × stability, bounded to a plausible interval. CL
grows with angle of attack at the design's lift slope, capped at its maximum CL.
After the estimated stall angle, lift decreases with a cosine-squared falloff and
drag rises with the squared sine of the excess angle. Stall events count entries,
with hysteresis to avoid counting numerical chatter as repeated stalls.

Pitch passively relaxes toward flight-path angle plus the design's trim angle and
the chosen trim offset. A critically damped second-order response depends on
airspeed, plane length, and estimated stability. This approximates restoring
aerodynamic moments; it is not an active pilot. A weathercocking heading response
and dihedral-driven bank approximate crosswind response. There is no detailed
six-degree-of-freedom rigid-body or flexible-paper model.

Turbulence adds bounded, smooth sinusoidal wind components. A seed selects their
phases, so repeated runs match and changing numerical timestep does not change
the weather sequence. This is a reproducible disturbance model, not atmospheric
turbulence data. Wind can transfer energy to the plane, as in real flight.

## Integration and comparison

The integrator places an air-relative aerodynamic update between two gravity
half-steps. A predictor estimates the midpoint flight direction, and lift and
drag coefficients are recomputed there to avoid a first-order force lag as the
plane pitches or stalls. Quadratic drag is integrated exactly for each step;
lift rotates the velocity without changing its airspeed. Trapezoid position integration therefore
preserves gravity/lift mechanical energy in still air, apart from dissipative
drag and tiny floating-point/interpolation error. No lift force is used as thrust.
The default timestep is 1/120 s; high aerodynamic turning rates use a smaller
step. Recorded points are interpolated at 30 Hz, with an exact final point.
Ground contact is interpolated on the last segment to Y = 0, including the
landing time. There are no bounces or post-landing slides.

Duration means time from release to first ground contact. Distance is horizontal
displacement from release to landing, not path length. Maximum height includes
internal integration points, so it can be slightly higher than a sampled point.
Runs that reach the time limit are marked truncated, not completed flight records.
Comparisons should use equal launch conditions or an equal search budget per
design, and describe the search range. A finite parameter sweep establishes the
best tested configuration, not a global optimum.

Nonfinite settings revert to their defaults. Finite values are bounded to speed
0–30 m/s, angle −45–80°, height 0–100 m, wind 0–20 m/s, turbulence 0–2, paper
40–240 gsm, trim −12–12°, maximum time 0.01–180 s, and timestep 1/480–1/30 s.
Returned settings contain the actual sanitized values. Invalid or nonpositive
design geometry/aerodynamic constants raise a RangeError. The model's useful
range is ordinary paper-plane throws; extreme settings are numerically bounded,
not scientifically validated.
