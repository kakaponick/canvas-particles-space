# Every knob, by the law it belongs to

This is a map, not a manual: it says which keys belong together, what they do to each other and where the
traps are. Ranges, defaults, units and the full meaning of a key come from the scene itself (describe with
a filter word), so they are not repeated here and cannot go stale.

A name in backticks in this file is always a key, a layer, a preset, a font, a film size or a caption
place. The audit script reads the file by that rule and fails when a name is missing or no longer exists.

## Contents

1. The unit everything is measured in
2. The flight: the particle field
3. Gravity on the particles
4. Capture: the event horizon
5. The lens: how light bends
6. The photon ring
7. Orbiting stars
8. A second black hole and its waves
9. Curved space made visible: the grids and the lattice
10. Background stars and the sky
11. Where the black hole is, and the camera
12. The page only
13. The opening: every parameter by its track
14. Layers of the opening
15. Presets, fonts, sizes, caption places
16. What is still fixed in code

## 1. The unit everything is measured in

`blackHoleSize` is the radius of the shadow, as a percent of the frame's short side. Every other length
around the hole is in black hole radii: `horizonScale`, `gravityReach`, `lensingRadius`, `orbitSize`,
`companionSize`, `companionDistance`, `gridDepth`, `ringWidth`. So one key scales the whole black hole and
nothing has to be kept in step. The strength of gravity grows with the square of the size. At 0 there is
no black hole at all.

A real shadow is 2.6 Schwarzschild radii, which is how the descriptions convert to physical distances.

## 2. The flight: the particle field

The particles fly towards the camera through a field `farZ` deep, born in a disc of `spawnRadius`.

| What | Keys |
|---|---|
| How many, how deep, how wide | `numParticles`, `farZ`, `spawnRadius` |
| What point it is born around | `fieldAtHole` |
| How fast | `baseSpeed`, `speedVariance` |
| What a particle looks like | `particleSize`, `particleSizeMin`, `trailIntensity`, `speedGlow`, `speedGlowKnee`, `baseBrightness` |
| How depth changes it | `depthFade`, `minOpacity`, `maxOpacity` |
| Twinkle | `pulseIntensity`, `pulseSpeedMultiplier` |
| Colours | `colorPalette`, `backgroundR`, `backgroundG`, `backgroundB` |
| The tint of a fast flight: its two colours, where one gives way to the other, how much, from what speed | `flightTintAhead`, `flightTintEdge`, `flightTintGradient`, `flightTintLimit`, `flightTintFrom`, `flightTintFull` |

What follows from how it is drawn:

- A particle's brightness is its own speed on the screen, whatever the camera does: a 3D camera that turns
  or moves streaks the trails and lights nothing. A particle that did not move draws nothing, so
  `baseSpeed` 0 leaves the field dark except where gravity moves it. `speedGlow` bends that link: 0 lights every moving
  particle in full, high values leave only the fast ones. `speedGlowKnee` is the speed that lights a
  particle half way, the point the curve bends round: lower it and a slow flight and the far field show,
  raise it and only the streaks near the camera stay.
- A particle thins with distance from `particleSize` down to `particleSizeMin`. Raise the second to the
  first and the field is drawn in strokes of one width, a flat graphic look; at 0 the far field thins away.
- The trail is the fade of the picture, not part of the particle. `trailIntensity` 0 means nothing ever
  fades: a long exposure. Together with `baseSpeed` 0 the black hole draws with its own pull.
- Gravity is not scaled by the flight speed, so slowing the flight does not weaken the hole.
- The field is born around the centre of the frame and flies out of it. A hole placed off the centre
  (`blackHoleY` 0.7 over a tilted sheet) is then fed from the side with more field: what falls in gathers
  on one side of it, and a swirl winds that side round. `fieldAtHole` 1 centres the field on the hole,
  so matter comes in from every side alike and a hole moved along a track carries its field with it.
- `colorPalette` is an array of colours with shares; a particle takes its colour when it is born, so a new
  palette arrives as particles are recycled. It is set, never keyframed. The background channels can be
  keyframed.
- A fast flight tints the particles over their own colours (the `doppler` layer): `flightTintAhead`
  round the point the field flies out of, `flightTintEdge` toward the edges. In 3D that point is where
  the line of flight is seen: it leaves the frame as the camera turns, and from the side the whole
  column takes the edge colour. It begins at a flight speed
  of `flightTintFrom` and is whole at `flightTintFull`, so at the default `baseSpeed` there is none: lower
  `flightTintFrom` to 0 to tint a slow flight. `flightTintGradient` is how fast one colour gives way to
  the other outward (the turn lies 1 / it of the way to the corner; at 1 and below the frame is all
  `flightTintAhead`), and `flightTintLimit` the most of a particle's colour the tint replaces: at 1 a
  fast flight is two flat colours. The two colours take a hex string and can be keyframed.
- `numParticles` is exact on the page and in a film, up to 200 000: the graphics card steps and draws
  them all.
- `fieldEnabled` false takes the field away: none of its particles is stepped or drawn, and the flows below,
  the grids, the stars and the lens are the whole scene. Turned on again the field is made anew at every depth.

### Flows: matter told where to go

The field is left to its laws, and a look grows out of it over seconds. A flow is said: a band of particles
round the hole that appear at one radius, leave at another and turn as they go. Three stand in a scene at
once, A, B and C, beside the field or without it.

| What | Keys |
|---|---|
| A flow's brightness (0 is off) and how many particles it holds | `flowA`, `flowACount` |
| Where its matter appears, where it leaves, how wide the band is, in radii | `flowAFrom`, `flowATo`, `flowASpread` |
| How fast it turns (the sign is the direction), and the seconds a particle takes | `flowASwirl`, `flowALife` |
| Its look: seconds of trail, stroke width, colour | `flowATrail`, `flowASize`, `flowAColor` |
| Which hole of a pair it turns round | `flowAPair` |
| How far it tips out of the hole's equator, in degrees, and which side comes up | `flowATilt`, `flowANode` |
| How thick the disc is: half its height as a share of the radius | `flowAThick` |
| The second flow, the same | `flowB`, `flowBCount`, `flowBFrom`, `flowBTo`, `flowBSpread`, `flowBSwirl`, `flowBLife`, `flowBTrail`, `flowBSize`, `flowBPair`, `flowBTilt`, `flowBNode`, `flowBThick`, `flowBColor` |
| The third | `flowC`, `flowCCount`, `flowCFrom`, `flowCTo`, `flowCSpread`, `flowCSwirl`, `flowCLife`, `flowCTrail`, `flowCSize`, `flowCPair`, `flowCTilt`, `flowCNode`, `flowCThick`, `flowCColor` |

- The two radii are the shape. `flowATo` the same as `flowAFrom` keeps every particle on its circle: a ring,
  a disc with a wide `flowASpread`. Below it the matter closes in, as in a fall from rest, and below 1 it
  ends inside the shadow. Above it the matter flows outward.
- `flowASwirl` is turns a second at one radius, and falls outward by Kepler's law. 0 is a straight fall or
  a straight outflow; with a fall it winds the matter into a spiral that tightens toward the hole.
- A flow has no warm-up and no history. It is whole in the first frame it is asked for, so a film of flows
  starts with a warm-up of 0, and a flow that comes in the middle of a film is its brightness on a track.
- A particle lives `flowALife` seconds and appears again elsewhere in the band, fading in and out at the
  ends. A long life on a ring is a steady ring; a short one twinkles.
- Every number of a flow moves along a track. `flowALife` changes how fast the particles go and never
  where they are. `flowACount` adds and takes particles at once, wherever they are in their lives.
- The flows lie in the main hole's equator, the plane a real disc settles into: face on in the flat mode,
  and in 3D facing the spin's axis as far as `orbitalSpinFollow` turns the swirl there (along the flight
  while the hole does not spin), turned by the camera (`threeD` with `cameraPitch` 60 is a disc seen from
  above its rim). That camera stands about twelve radii from the hole at the default `blackHoleSize`, so a
  flow wider than that passes it: strokes that come near fade out.
- `flowATilt` tips a flow out of the equator about a line through the hole, keeping its radii: 90 stands
  it across the equator, a stream over the poles, 180 lays it back turning the other way. `flowANode` says
  which side comes up, in degrees round the hole the way a positive `flowASwirl` turns (0 the right, 90
  the top), rising against the way the equator faces: toward the camera of the flat mode, where a tilted
  ring is an ellipse and a polar one a line. Two flows at different tilts are two discs crossing at the hole.
- `flowAThick` is the disc's half height as a share of the radius, its H/r: 0.06 by default, a thin disc;
  0 lays every particle in one plane, 0.3 and above is a thick torus. Each particle's orbit is tipped a
  little, so it rises and sinks once a turn, by its own share of that height, and a thick disc seen edge-on
  is a band as many radii high farther out as near. Face on it changes nothing.
- The lens bends a flow as it bends everything behind the hole: a ring shows farther out than its radius
  says and again, mirrored, inside the Einstein ring. `lensingEnabled` false draws it where it was set.
- A flow's light is said, not earned by speed: `speedGlow`, `baseBrightness` and `trailIntensity` do
  nothing to it. Strokes keep the brighter of two, so many particles in a narrow band are one flat band:
  for streaks, fewer and thinner.
- Its trail is a line in the scene, not a fade of the picture, so a camera that moves does not smear it.
- `gridRide` lays the flows on the sheet as it lays the field, from their places in the scene: a particle is
  dropped onto the equator, the sheet's plane, and rides as far as it lies within `gridRideDepth` of it. A
  flow in the equator lies on the sheet whole, so a ring lies round the mouth of the well and a fall runs
  down its wall, all the way round and from the first frame; a thick disc rides by its middle and a flow
  tilted past the slab keeps its own place where it leaves it. The sheet's setup is the field's (films.md,
  section 16), `lensingEnabled` false with it.
- A flow round the main hole whose `flowATo` is below `horizonScale` lights the photon ring while
  `ringFeedEnabled` is on: a particle a life, each leaving `ringFeedCapture`, shared out all the way
  round. A dense fast flow fills the ring; `ringFeed` and `ringFeedCapture` say how far.
- With a second black hole `flowAPair` says what the flow turns round: -1 the main hole, 0 the centre
  the two turn about (a ring wider than `companionDistance` there is a disc round both), 1 the second
  hole, in whose radii the flow is then measured, lying in the main hole's equator still. The second
  hole does not pull a flow off its path: matter torn from one hole to the other is two flows, or the
  field.
- Without a black hole (`blackHoleSize` 0) a flow keeps `gridLatticeUnit` for its radius.

## 3. Gravity on the particles

| What | Keys |
|---|---|
| Pull towards the hole (negative pushes away) | `gravityStrength` |
| Sideways force that makes them swirl (the sign is the direction), and in 3D how far its axis follows the hole's spin | `orbitalStrength`, `orbitalSpinFollow` |
| How much of the speed gravity gives them they keep | `gravityInertia` |
| How far it reaches across the screen, in radii | `gravityReach` |
| Where the hole sits in depth, and how thick a layer it pulls | `blackHoleDepth`, `gravityDepth` |

- At `gravityInertia` 0 (the default) gravity displaces the particles only while it acts, the scene's
  classic look. Raised, they keep the speed it gives them: about 0.9 gathers the particles that pass close
  into a turning ring round the shadow and thins the field outside it; 1 keeps all of it, so they swing
  past the hole and fly on along bent paths, a whirl of straight streaks. Orbital Force, the spin's drag
  and the second black hole add to that speed too. Closed orbits still belong to the orbiting stars
  (section 7).
- Only the layer around `blackHoleDepth` is pulled; `gravityDepth` at 50 or more reaches the whole field,
  which is what makes the long-exposure knots dense. With a moving field it is the opposite: strong
  `gravityStrength` over the whole depth pulls everything into the horizon and the frame goes nearly empty.
- Strong `orbitalStrength` with weak `gravityStrength` gives a whirlpool; the reverse gives a straight
  infall that feeds the ring.
- `orbitalSpinFollow` (3D only, default 1) turns the axis `orbitalStrength` swirls about from the line of
  flight to the spin's axis as it stands in the scene (`spinTilt`, `spinAxis`, a merger's spin), the more
  the faster the hole spins (`blackHoleSpin`): a tilted, fast-spinning hole winds a tilted disc. 0, or a
  hole that does not spin, keeps the line of flight; the flat mode always does.

## 4. Capture: the event horizon

`horizonScale` is the radius of no return in black hole radii. A particle or an orbiting star that crosses
it is recycled, and what it carried lights the photon ring (section 6).

- 1 is the edge of the shadow, where a real black hole captures light. Above 1 things vanish before they
  reach the shadow; below 1 inside it; 0 lets everything fly through.
- Growing it over a film swallows the orbiting stars one by one, each with a flare on the ring.
- A wide horizon does not empty the field: captured particles are reborn outside it.

### Spin: a hole that turns (Kerr)

| What | Keys |
|---|---|
| How fast it turns, a/M from 0 to 0.998 | `blackHoleSpin` |
| Angle of its axis to the camera: 0° down the axis, 90° side-on | `spinTilt` |
| Which way the axis points on screen, from up toward the left | `spinAxis` |
| How hard the spin carries the particles round, × what the spin itself gives | `frameDrag` |
| How hard spin lying in the screen sweeps near and far particles apart, × the swirl | `frameDragSweep` |

- Spin reshapes the shadow in either lens: the side turning toward the camera flattens and the shadow moves
  the other way, and the photon ring follows the outline. Particles are captured on the circle that fits it.
- Under `lensingTraced` the light itself is followed round a Kerr hole: the sky is dragged round and the
  rings inside the Einstein ring lean to one side. The stylized lens stays round.
- The orbiting stars feel the spin (Lense-Thirring) about its axis as it stands in the scene, at any
  `spinTilt`: the plane of a tipped orbit turns about that axis, the way the particles are carried round
  (section 7).
- The particles are carried round with the space near the hole (frame dragging), as a share of the pull:
  spin / 2 at one hole radius, fading one power of the distance faster than the pull, so it shows within
  two or three radii and needs `gravityStrength` above 0. Toward the camera (`spinTilt` near 0°) the spin
  swirls them anticlockwise, away from it (near 180°) clockwise; it adds to `orbitalStrength`, which swirls
  at every distance alike. Side-on (90°) there is no swirl: particles nearer than the hole are swept one way
  across the axis and those beyond it the other, so their trails cross above and below the hole. To see the
  drag alone, set `orbitalStrength` 0 and `baseSpeed` 0 and zoom in (`cameraZoom` 3).
- `frameDrag` multiplies that drag and nothing else: 1 is the physical share, where the spiral needs a zoom
  to be seen; about 4 winds a vortex round the shadow that reads at a zoom of 1 with the field flying, and
  about 12 holds a bright ring of particles circling the hole before they fall. 0 keeps the shadow, the lens and the stars' swing and lets the particles fall straight.
- `frameDragSweep` multiplies `frameDrag` for the share of spin that lies in the screen, the one that
  sweeps near and far particles across the axis: at 1 it is as hard as the swirl, higher makes the crossed
  trails of a side-on hole show, 0 leaves a side-on hole dragging nothing. It is the flat mode's: under
  `threeD` the axis stands in space and the drag is the real turn round it. The stars have their own
  multiple, `orbitDrag` (section 7).
- `blackHoleSize` stays the mass: a spinning hole's shadow is a little smaller than a still one's.
- The look needs `spinTilt` well away from 0°; at 0° the shadow stays round and only the sky winds.
- Two holes that merge leave a spinning one about the axis of their orbit, which faces the camera, whatever
  `blackHoleSpin` says: the remnant's spin (0.69 for two equal holes) takes over as the shadows join.
- The `Kerr` preset is Schwarzschild's setup spinning at 0.99, seen at 80°, with the ring's bright side
  (`ringSide`) on the flat side, which turns toward the camera. The approaching side is at 180° plus
  `spinAxis` at every tilt (past 90° the hole is seen turning the other way about the line of sight, but the
  same limb comes toward the camera), and the contrast a real hole shows grows as the sine of `spinTilt`.
  `ringSpinFollow` at 1 takes both from the spin as the camera sees it, with `ringDoppler` as the
  contrast side-on: it follows the tilt, the axis, every move of the 3D camera and a merger's spin, so a
  flight round the hole needs no track for the ring. At 0, the default, `ringSide` and `ringDoppler` are
  what is set and a film drives them along the tilt (films.md, section 10); a hole without spin always
  keeps them.

## 5. The lens: how light bends

The lens bends the finished picture (particles, stars, grids), not the particles' paths.

| What | Keys |
|---|---|
| On or off | `lensingEnabled` |
| Exact light paths (ray traced) or the stylized lens | `lensingTraced` |
| Size of the Einstein ring, in radii, or how much of it the scene's own camera sets | `lensingRadius`, `lensingFromCamera` |
| Shape outside the ring: 0 a compact bubble, 1 a point mass | `lensingReach` |
| How the pull changes with distance, and where that changes nothing | `lensingFalloff`, `lensingPivot` |
| What shows inside the ring | `lensingMaxBend`, `lensingCore` |
| Swirl of the sky | `lensingRotation`, `lensingTwistLimit` |
| Dark zone around the shadow | `lensingAbsorption` |

- `lensingTraced` true, the default, follows every pixel's ray round the hole, a Kerr one when it spins:
  the Einstein ring, the mirrored image inside it and the thin rings of light that circled the hole come
  from the physics, with nothing to tune but `lensingRadius` (where the camera stands) and
  `lensingAbsorption`. The other lens keys shape only the stylized lens (`lensingTraced` false) and do
  nothing while it is on; a film that sets or moves them under the traced lens gets a note saying so.
- The physically faithful setup is the `Schwarzschild` preset: no light taken from around the shadow,
  capture at the shadow's edge, no swirl of the particles; its stylized keys are a point mass
  (`lensingReach` 1, `lensingFalloff` 2, no twist) for when the switch is turned off. `Default` traces the
  lens too and tunes the rest for the look.
- For a real hole `lensingRadius` says how far the camera is: about the square root of twice the distance
  in Schwarzschild radii, divided by 2.6. Ray traced it places the camera exactly: 1.32 at 2 Schwarzschild
  radii (the nearest), 2.13 at 10, 2.86 at 21. A near camera sees a very wide field around a small hole.
- `lensingRadius` 0 turns the lens off just as `lensingEnabled` false does, so a film can fade the lens in
  with a number or cut it with the switch.
- `lensingRadius` and the camera of the particles are two cameras: one says how far the lens sees the
  hole from, the other draws the particles in perspective. `lensingFromCamera` at 1 makes them one: the
  lens stands where the scene's camera does, half the frame's long side from the hole in the units the
  shadow is drawn in (about 29 Schwarzschild radii at the default `blackHoleSize` in a wide frame, an
  Einstein ring of about 3.3), nearer as `cameraMoveIn` brings the 3D camera in. A larger hole is then
  seen from nearer, with a smaller ring and a wider warp of the sky; `cameraZoom` is a longer lens and
  changes nothing. Between 0 and 1 the two distances blend; `lensingRadius` stays the switch.
- The lens is hard to see on a dark sky. `gridSky` above 0 (section 9) shows exactly what it does.
- `lensingAbsorption` takes light away around the shadow. When the particles next to the hole look dim,
  this is the first key to lower, before any brightness of the particles themselves.

## 6. The photon ring

| What | Keys |
|---|---|
| On or off | `ringEnabled` |
| The line: brightness, soft light around it, added thickness | `ringBrightness`, `ringGlow`, `ringWidth` |
| The line's width at no thickness, in screen pixels, how far off the shadow's edge it stands, in its widths, and how soft it is | `ringWidthMin`, `ringOffset`, `ringSoftness` |
| The glow's shape: reach of its tight core and of its wide skirt, in radii, and the share of the glow in each | `ringGlowCore`, `ringGlowSkirt`, `ringGlowCoreShare`, `ringGlowSkirtShare` |
| The approaching side brighter and bluer, which side that is, and how much of that the spin sets as the camera sees it | `ringDoppler`, `ringSide`, `ringSpinFollow` |
| Its colour, and what the two sides turn toward | `ringColor`, `ringColorApproaching`, `ringColorReceding` |
| Light with nothing falling in | `ringBase` |
| Light from what falls in: on or off, how much, how long it lingers, how fast it travels round | `ringFeedEnabled`, `ringFeed`, `ringAfterglow`, `ringFlowSpeed` |
| What each thing that falls in leaves: a captured particle, one skimming past per frame and how near it must pass, a captured star, how far round its flare spreads and how bright its sides are | `ringFeedCapture`, `ringFeedSkim`, `ringFeedReach`, `ringStarFlare`, `ringStarSpread`, `ringStarSides` |

- The ring is fed by the simulation: particles captured or skimming past, and orbiting stars that cross
  the horizon. A dark ring usually means nothing is falling in; raise `gravityStrength` or `ringBase`.
- `ringWidth` 0 is the finest line the screen draws, at any zoom: `ringWidthMin` pixels, 1.5 by default.
  `ringWidth` is added to it in radii, so the first grows with a zoom and the second does not. `ringOffset`
  moves the line off the shadow's edge in its own widths: 0 centres it on the edge, where the shadow hides
  its inner half, and a negative value draws it inside the shadow. `ringSoftness` is the width of the
  bell of light that draws the line, as a share of the line's own: low is a hard hairline, high a soft band.
- `ringGlow` scales the whole glow; the four shape keys say where it lies. A wide `ringGlowSkirt` with a
  high `ringGlowSkirtShare` is a halo that fills the shadow and hazes the sky; both shares at 0 leave the
  bare line whatever `ringGlow` says.
- `ringFeed` scales all the light that falls in; `ringFeedCapture` and `ringFeedSkim` set what a captured
  particle and a passing one give, so their ratio is whether the ring flashes where things go in or glows
  where the stream runs past. Skimming counts within `ringFeedReach` radii, never beyond `gravityReach`,
  and in the flat mode only inside `gravityDepth`. A swallowed star leaves `ringStarFlare`, on the scale
  of `ringFeedCapture`, spread `ringStarSpread` to each side with `ringStarSides` of it in each: three
  points of light that the ring's flow then carries round.
- The ring is `ringColor`, and `ringDoppler` turns its bright side toward `ringColorApproaching` and its
  dim side toward `ringColorReceding` by the square of the contrast, so the tints show from about 0.5 up.
  The second black hole's ring takes `ringColor`, the line and the glow, and neither the feed nor the sides.
  The three colours take a hex string and can be keyframed.

## 7. Orbiting stars

Up to 64 stars with real velocity in space, each on a plane of its own near the hole's equator: ellipses
that precess, faster the closer they come, as around a real black hole.

| What | Keys |
|---|---|
| How many (0 is none) | `orbitCount` |
| Shape of the orbits | `orbitSize`, `orbitEccentricity` |
| Rate of their time; the sign is the direction | `orbitSpeed` |
| How long a trace stays lit, and its width | `orbitTrail`, `orbitStarSize` |
| How much the orbits differ from the size and the stretch set | `orbitSizeSpread`, `orbitEccentricitySpread` |
| The widest an orbit's plane is tipped out of the hole's equator, in degrees | `orbitInclination` |
| The closest a new orbit comes, and how far out a star counts as gone, in Schwarzschild radii | `orbitClosest`, `orbitEscape` |
| How hard the spin swings the orbits, × what the spin itself gives | `orbitDrag` |
| Seconds a new star takes to light up | `orbitFadeIn` |

- Changing `orbitSize`, `orbitEccentricity`, `orbitSizeSpread`, `orbitEccentricitySpread`, `orbitInclination`
  or `orbitClosest` makes every orbit anew, so do not glide them along a track: set them at the start, or
  step them with the hold ease.
- A star is born in the equator (the plane across the line of flight while the hole does not spin, in the
  flat mode always; in 3D the plane facing the swirl's axis, which `orbitalSpinFollow` turns toward the
  spin's) and tipped out of it by up to `orbitInclination` degrees about a direction of its own. 0 is a
  flat disc of rosettes, seen edge-on from the side (`cameraYaw` 90 with a still hole); 90 a ball of
  orbits at every angle. The flat mode sees them straight on, so a tipped orbit there is only a narrower
  ellipse. The default, 20, was set with no picture to judge it by.
- After its birth a star is moved by its motion alone: an equator that turns later moves no orbit, and a
  spin axis that turns later precesses the orbits about where it now stands.
- Both spreads at 0 put every star on the same ellipse, turned differently: a clean rosette. `orbitSizeSpread`
  at its top scatters them from the shadow's edge to twice `orbitSize`.
- `orbitClosest` and `orbitEscape` are in Schwarzschild radii, the unit of the orbits' own physics (the
  shadow is 2.6 of them), so they still follow `blackHoleSize`. Below 3 no orbit lasts: a low `orbitClosest`
  with a high `orbitEccentricity` feeds stars to the ring, a high one keeps them all clear. A low
  `orbitEscape` replaces a flung star while it is still in the frame.
- `orbitDrag` is the stars' own multiple of the spin's field (Lense-Thirring) and leaves `frameDrag`, the
  particles', alone. The spin acts about its axis as it stands in the scene, at any `spinTilt`: a tipped
  orbit's plane turns about that axis the way the particles are carried round, 2 J / r^3 radians per unit
  of the orbits' time with J = spin / 4 (about a fiftieth of a turn per turn at 10 Schwarzschild radii,
  the hole's fastest spin, `orbitDrag` 1), its tilt to the axis held; within the plane the orbit turns
  too, and a star moving with the hole's turn is pushed out, one against it pulled in. Raised, the planes
  and the rosettes turn faster and the closest stars are thrown in or out: at 10, stars about 10
  Schwarzschild radii out on orbits against the hole's turn fall in within a few turns.
- `orbitCount` along a track wants the hold ease too: stars arrive in whole numbers.
- A long `orbitTrail` over several turns draws the rosette of the precession. The traces are lines kept
  around the hole, so they follow it, grow with `blackHoleSize` and stay sharp at any zoom.
- Below an `orbitSize` of about 2.5 most stars fall in: no orbit is stable that close.
- The stars circle the main hole only, even when there is a second one.

## 8. A second black hole and its waves

| What | Keys |
|---|---|
| The companion's radius, as a share of the main one (0 is none); its mass is its size | `companionSize` |
| Gap between the centres, in main hole radii | `companionDistance` |
| Rate of the pair's time; the sign is the direction | `companionSpeed` |
| Strength of the spiral gravitational wave of the pair | `companionWaves` |
| The plane the two circle in: its tilt from the plane across the line of flight, and the side of the screen it tips away from the camera | `companionTilt`, `companionNode` |
| Where the closing pair stops speeding up, as a share of touching | `companionClosest` |
| What a merger leaves: its spin × the real one, its oval × the opening's, the wobbles its ringing takes to take over the wave | `companionSpin`, `companionOval`, `companionHandover` |

- The two turn around their common centre by Kepler's law, so closing `companionDistance` speeds them up
  by itself. Moving it from far to 0 over a film is a merger. Inside `companionClosest` of the distance at
  which they touch they turn no faster: lower it and the last turns whip round, raise it to 1 and the pair
  merges at the pace it touched at.
- Below a distance of 1 + `companionSize` the shadows overlap and the main hole grows by the companion's
  mass. At 0 they are one hole, which rings and sends a last wave.
- The last turns, the merger and the ringing are one motion. The main hole is drawn out toward the
  companion as the shadows merge; after the merger the oval keeps turning the way the pair did while it
  dies away. Its tone is the merged hole's own (what is left spins, so two equal holes ring about 1.4
  times higher than a still hole of that size) and runs on the pair's clock: `companionSpeed` scales it,
  and the opening's `ringdownPitch`, `ringdownLength` and `lightCrossTime` do not.
- `ringdownAmplitude`, an intro parameter, is how far the merged hole is drawn out: `companionOval` times
  it (3 by default) for equal masses, less for unequal ones. It works in a film without the opening.
- `companionSpin` multiplies the spin the merger leaves (section 4): it flattens the merged shadow and
  raises and lengthens the tone the hole rings with; at 0 the merged hole is a still one and rings lowest.
  `companionHandover` is how many wobbles the ringing takes to take over from the spiral at the front
  that leaves the merger: low is a seam in the wave, high a long blend.
- `companionWaves` alone sets the wave. The spiral rises to its peak at the merger and flies on outward,
  and the dying turns of the ringing follow it at the same strength, with no jump between them.
  `gravityWaveGain` shapes only the opening's wave and a fired one.
- A wave stretches the sky across its path, never along it, and weakens as 1 over the distance. At
  `companionWaves` 1 the sheet sways through a merger; at 3 it folds into steep spiral arms.
- The pair circles in a plane of its own. `companionTilt` 0 is the plane across the line of flight, the
  one the flat view looks straight at; 90 stands it edge-on to a camera looking along the flight, so the
  two pass in front of each other at every half turn; 180 is the same plane circled the other way.
  `companionNode` is the side of the screen that tilts away from the camera: 0 the top (at 90 the orbit
  is a horizontal line), 90 the left (a vertical line). The plane stays where it is set: the holes' spins
  do not turn it.
- The waves and the merged hole's oval lie in the pair's plane, and the camera sees the slice through
  the pair that faces it: from above the orbit a two-armed spiral, from its side rings, twice as strong
  along the orbit's axis as in its plane, round a shadow that swells and shrinks along that plane. The
  hole a merger leaves spins about the orbit's axis, the way the pair turned. A hole alone (the
  opening's ringing, a fired `ringdown` or `gravityWave` with `companionSize` 0) rings in the plane
  across the line of flight whatever the tilt.
- The two holes stand at their own depths, so seen along the orbit's plane one passes in front of the
  other: the nearer one's lens bends the light of the farther, which is seen pushed out round it, and
  its shadow hides what of the farther ring lies behind it. The flat mode keeps that order but draws
  the orbit as it lies across the screen, both holes at their own size; 3D straight on draws the same
  with perspective, the nearer hole larger and farther from their centre.
- At `companionSpeed` 1 a turn at 8 radii takes about 15 s. A short film wants 2 to show the pair circling.
- Two horizons take more of the flight than one: over a long approach the field can thin out. Lower
  `gravityStrength`, or `horizonScale`, when the picture needs the particles.
- The companion has its own shadow, lens, ring, gravity and well in the sheet.
- A wave leaves only what moves. The opening's `ringdown` and `gravityWave` fired at a hole that has been
  at rest show a hole that wobbles for no reason, and a viewer who knows the physics sees a mistake: a ripple in a film
  comes from a pair closing in, and ends in the ringing of their merger.
- For that ripple to read on the sheet, frame it wide and plain: `blackHoleSize` 3.5, square cells
  (`gridCell` 3, `gridRings` 0), `gridTilt` 60, no particles. The wave is weak while the two are far
  apart and steep at the merger, so move both strengths against the approach: `companionWaves` 3 and
  `gridWaveLift` 30 as `companionDistance` leaves 6, down to 1.6 and 11 as it reaches 0. Held high to the
  end, the sheet round the merger breaks into spikes (`films/fourth_dimension_ripple.js`).

## 9. Curved space made visible: the grids and the lattice

| What | Keys |
|---|---|
| Cell size, shared by the sheet and the lensed grid | `gridCell` |
| The sheet: brightness (0 is off), the angle the flat mode sees it at, depth of the well in radii | `gridSheet`, `gridTilt`, `gridDepth` |
| The sheet as rings and spokes: how many rings stand at equal steps of the well's depth (0 keeps the square cells), and the spokes across them | `gridRings`, `gridSpokes` |
| The particles drawn on the sheet's surface: the share of the way they are moved onto it (0 leaves them where they fly), and the half thickness in radii of the slab round the equator whose particles are | `gridRide`, `gridRideDepth` |
| The lattice in three dimensions: brightness (0 is off), its cell in radii, how hard it is drawn in | `gridLattice`, `gridLatticeCell`, `gridLatticeWarp` |
| A flat grid on the sky read through the lens (0 is off), how far it is drawn in towards the hole (0 is flat), and the width of its lines | `gridSky`, `gridSkyPull`, `gridSkyLine` |
| The colour of all three, and how many times brighter the lattice draws it | `gridColor`, `gridLatticeGain` |
| The sheet's lines: their width, the most they widen near its camera, and where they stop round a hole | `gridLine`, `gridLineNear`, `gridClearing`, `gridClearingEdge` |
| The flat mode's sheet camera: its distance, and how near it the sheet is cut off; how far the sheet reaches and the share of that it fades over | `gridDistance`, `gridNear`, `gridSpan`, `gridFade` |
| How high a gravitational wave lifts the sheet | `gridWaveLift` |
| The lattice's lines and extent: their width, its reach in cells and the share of that it fades over | `gridLatticeLine`, `gridLatticeReach`, `gridLatticeFade` |
| The lattice in depth: where it fades near the camera, the share of that where a line is gone, and what it keeps far behind the hole | `gridLatticeNear`, `gridLatticeNearEdge`, `gridLatticeFar` |
| The shadow the lattice's cells are measured from while there is no black hole, as a share of the short side | `gridLatticeUnit` |

- The sheet is a surface of the scene: a piece of the main hole's equator (the plane matter, the flows and
  the orbiting stars follow; across the line of flight while the hole does not spin), dented where the hole
  sits, the well going down along the way the plane faces, away from a camera that looks down the flight,
  and rippled by gravitational waves. Its lines stay put while the hole moves across it. In the flat mode
  a camera of its own sees it, tipped by `gridTilt` and set so that the well's bottom lands on the hole:
  at 60 and above the well's depth shows. In 3D the scene's camera sees it (section 11).
- The dent is gravitational time dilation, and can be said so in a caption: a place is lowered by how much
  time is slowed where the light seen at that distance passed closest to the hole. Far away the sheet is
  flat; at the shadow's edge, where that light skims the photon sphere, it is `gridDepth` deep and ends.
- `gridRings` above 0 draws the sheet as a textbook does, in rings and spokes around the main hole. The
  rings are the well's contour lines, one at each of that many equal steps of its depth: from the side they
  step down the well evenly, from above (`gridTilt` 0) they crowd toward the hole, where the well is
  steepest, so the depth is read with no tilt at all. The outermost stands about half as many shadow radii
  out as there are rings (40 fills a 1080p frame at `blackHoleSize` 8), and half of them stand within a
  third of a radius of the shadow, where `gridClearing` thins them. Waves read better on the square cells.
- `gridRide` lays the particles on the sheet, and with that the sheet shows not only how space lies but
  where it goes: each stroke is an arrow on the surface. A particle is drawn where the sheet lies under
  its place around the hole, so what falls goes down the well's wall, what circles wraps its mouth, and
  from above the same matter is the disc round the shadow. Without it the particles stay in the plane of
  the screen and float in front of a tilted sheet. It moves only where they are drawn, so their motion is
  set as ever, and four neighbours decide whether it shows: `baseSpeed` 0, since the flat flight would run
  outward along the sheet; `lensingEnabled` false, since the lens bends them round the hole on the screen;
  `fieldAtHole` 1, since a tilted sheet is framed with the hole low and the well then fills on one side
  only (section 2); and `particleSizeMin` raised to `particleSize`, since what the hole took comes back at
  the far end of the field as a hairline and the well looks empty. The whole setup, and the motion for
  each thing a shot may say, are in the film guide, section 16. In the flat mode `gridTilt` is the
  camera: tilting it streaks the trails as a camera move does. In 3D the particles on the sheet stand on it
  where it lies in the scene, and every move of the camera sees the two together.
- Only what flies near the equator rides: a particle is dropped onto the plane along the way it faces, and
  rides the whole of `gridRide` in the plane, none of it `gridRideDepth` radii off it, smoothly between;
  the rest is drawn where it flies. While the hole does not spin the plane lies across the line of flight,
  so the slab is a stretch of the column round the hole's depth: at 1080p and the defaults a radius is
  135 scene units of a column 5000 deep, and the default 2 holds 11% of the field (2600 of 24 000
  particles, half of that ridden on average for the smooth edge), 5 holds 27%, 10 over half, and 26
  reaches both ends of the column. A flat field (`threeD` off) is measured the same way, by its depth.
- The lensed grid is a measuring tool: it shows the Einstein ring, the mirrored image, the twist and the
  waves. Lower `baseBrightness` when it should be read clearly.
- `gridSkyPull` draws the lensed grid in towards the hole: the classic picture of space pulled in by a
  mass, lines above the hole sagging to it, lines beside it bowing in, cells crowding into a haze round the
  shadow. It is the lattice's law on the flat grid (the slowing of time, in shadow radii times the Pull,
  never folding), so it falls as 1 over the distance. The lens bends the grid the other way, outward, on
  top of it: with `lensingEnabled` false the pull shows alone, the picture of a well seen from above
  (8 bends the lines visibly to the frame's edges at `blackHoleSize` 12). It is not the sheet seen from
  above: the sheet's dent is short-ranged and drawn over the frame, so a dent deep enough to bend the
  edges would lay lines over the shadow.
- Where the pull crowds the cells, they merge into a haze once a cell is smaller than `gridSkyHaze` screen
  pixels, wholly at `gridSkyHazeSpan` of the way down from it. The default 6 only catches cells crowded to
  a few pixels, which a Pull below 10 rarely makes; about three quarters of a cell on screen (50 px at
  `gridCell` 6 in 1080p) dissolves the grid round the shadow into a glow, and a value at or above the cell
  hazes the grid everywhere, since far from the hole a cell is its full size.
- The lattice is the sheet's law in three dimensions: lines along the three axes of the scene, each node
  drawn in towards the hole by the same slowing of time, in shadow radii times `gridLatticeWarp`, taken so
  that no node reaches the centre and no line folds over. It is a ball of `gridLatticeReach` cells around
  the hole, 6 by default and at most (all the lines it has), that fades out over the outer
  `gridLatticeFade` of that, a half, so at the default `gridLatticeCell` of 1 the whole ball fits the frame
  of the default camera; a larger cell reaches farther and passes the camera. It stands still while the
  hole moves through it and a second hole pulls it too.
- The lattice is drawn into the layer of the orbits' traces and read through the lens: the lines behind
  the hole are bent into its Einstein ring even at `gridLatticeWarp` 0, and the shadow covers it. It is
  made for `threeD`, where the camera circles it; in the flat mode it is seen straight on, down the line
  of flight. Among a bright field lower `baseBrightness` or raise `gridLattice`.
- A camera inside the ball would have lines across its face: they begin to fade nearer than
  `gridLatticeNear` of the way to the point the camera circles and are gone at `gridLatticeNearEdge` of
  that, a quarter. Behind that point a line dims with its distance, down to `gridLatticeFar` of its
  light. `gridLatticeNear` low and `gridLatticeFar` 1 give a cage drawn alike near and far;
  `gridLatticeNear` above 1 leaves only the far side.
- With `blackHoleSize` 0 the lattice is a plain cage of space: its cells are then multiples of
  `gridLatticeUnit` of the short side, 8%, the default hole's shadow.
- `gridColor` is one colour for all three grids. The lattice draws it `gridLatticeGain` times brighter,
  each channel stopping at full, so a high gain turns the lattice white while the sheet keeps the colour.
- In the flat mode the sheet has a camera of its own, apart from the scene's: `gridDistance` long screen
  sides from the middle of the screen. Nearer, the perspective steepens and the horizon of a tilted sheet
  comes into the frame; far, the lines run parallel, as on a map. `gridNear` is the share of that distance
  nearer than which the sheet is cut off: lower it with a near camera, or the foreground is gone. In 3D
  neither does anything: the sheet is cut where the 3D camera cuts the particles.
- `gridSpan` is how far the sheet reaches, and it fades over the outer `gridFade` of that. It has 112
  lines each side of the hole, so at a small `gridCell` it ends there whatever the span. A small span with
  a short fade is a disc of sheet around the hole.
- `gridLine` is the width as far from the camera as the point it looks at; nearer lines widen with the
  perspective up to `gridLineNear` times. The lines stop at each hole: gone inside `gridClearing` shadow radii, whole beyond
  `gridClearingEdge`, which is taken no smaller. Both at 0 let the sheet cross the shadow.
- `gridWaveLift` is the height a wave gives the sheet for each pixel it stretches the sky, so it scales
  every wave on the sheet at once (`companionWaves`, `gravityWaveGain`, a fired `gravityWave`) and leaves
  the sky alone. 0 keeps the sheet still under a rippling sky; 20 makes steep hills of a merger.

## 10. Background stars and the sky

| What | Keys |
|---|---|
| How bright, how many, how far apart | `starsBrightness`, `starDensity`, `starCell` |
| One star: its width, and the faintest as a share of the brightest | `starsSize`, `starsFaintest` |
| The two colours a star's tint lies between | `starsColorWarm`, `starsColorCool` |
| The twinkle: the share of a star's light that swings, and how fast | `starsTwinkle`, `starsTwinkleSpeed` |

- Fixed stars behind everything, bent by the lens and rippled by the waves. They keep their size at any
  zoom.
- A star lives in its own cell of the star grid, in the middle of it: a `starsSize` of more than a quarter
  of `starCell` is cut off square at the cell's edge, so raise the two together.
- `starsTwinkleSpeed` multiplies the stars' clock: moved along a track it shifts every swing at once, a
  flicker. Set it at a cut, or with `starsTwinkle` at 0.
- The same colour in `starsColorWarm` and `starsColorCool` gives a sky of one colour.

### The nebula

| What | Keys |
|---|---|
| How bright (0 is off) | `nebula` |
| Its clouds: size, how much of the sky they fill, edges, curl, how much denser in the middle, grain | `nebulaScale`, `nebulaSparseness`, `nebulaEdge`, `nebulaWarp`, `nebulaContrast`, `nebulaGrain` |
| Their drift: speed and direction on the screen | `nebulaDrift`, `nebulaDriftAngle` |
| Its colours: main, the second in patches (size, share of the sky, softness), the core of the thickest cloud (how far, from what thickness) | `nebulaColor`, `nebulaColorDeep`, `nebulaPatch`, `nebulaPatchShare`, `nebulaPatchSoftness`, `nebulaColorCore`, `nebulaCore`, `nebulaCoreFrom` |

- Clouds of gas and dust behind the stars, bent and rippled like them. They are made as the opening's dust
  is (section 13), but every number is the nebula's own, so the dust the flash lights and the nebula can
  differ; at the dust's values (`nebulaScale` = `dustScale`, `nebulaSparseness` = `dustThreshold`, the
  look at its defaults) the two are the same clouds.
- `nebulaSparseness` 0.1 to 0.3 fills the sky with clouds and narrow dark gaps, the default 0.55 leaves
  clouds apart, 0.8 and above a few wisps. `nebulaWarp` 0 leaves round blotches; `nebulaGrain` near 1
  shows the square cells the noise is built on.
- `nebulaCore` grows from `nebulaCoreFrom` to the thickest cloud; at a low sparseness most of the sky is
  thick, so raise `nebulaCoreFrom` (0.9) or the core colour washes over everything.
- It shows as the opening lets the stars show, and hiding the `stars` layer hides it. It adds light, so a
  dark background colour under it (`backgroundR`..`backgroundB`) deepens the gaps between the clouds.
- In 3D it is painted on the box of the sky (section 11) and turns rigidly with the camera: a cloud keeps
  its shape and its place among the stars at any turn. Near an edge of the box the clouds of the two
  faces blend.

## 11. Where the black hole is, and the camera

| What | Keys |
|---|---|
| Where it rests, as shares of the frame | `blackHoleX`, `blackHoleY` |
| Whether it follows the cursor, and how stiffly it moves to where it is sent | `blackHoleFollowing`, `followFrequency` |
| Magnification around the hole | `cameraZoom` |
| Where a zoomed-in camera looks: radii right of the hole and above it | `cameraX`, `cameraY` |
| Which of two holes it looks at: -1 the main one, 0 their centre, 1 the second | `cameraPair` |
| The field as a volume, seen from around the hole | `threeD` |
| Where the 3D camera stands: around the hole, above or below it, and how fast it circles on its own | `cameraYaw`, `cameraPitch`, `cameraSpin` |
| The 3D camera off its circle: its roll, its head turned right and up from the hole, and its move right, up and in, in radii | `cameraRoll`, `cameraLookYaw`, `cameraLookPitch`, `cameraMoveRight`, `cameraMoveUp`, `cameraMoveIn` |
| How much of the 3D column fades at each of its ends, as a share of `farZ` | `threeDEndFade` |
| The 3D camera: seconds it takes into and out of 3D, and the nearest point it circles, as a share of `farZ` | `threeDEase`, `threeDNearest` |
| What counts as a cut of the camera, where the trails start afresh: a zoom, a move of the picture and, in 3D, a turn, each in one frame | `cameraCutZoom`, `cameraCutShift`, `cameraCutTurn` |

- Setting a position anchors the hole. A film has no cursor: the hole rests at its position and tracks
  move it, through the same spring, so a low `followFrequency` makes it heavy and late.
- `cameraZoom` is both a setting (0.5 to 8, any time) and an intro parameter of the same name (the camera
  the opening starts with, which always settles back to 1). The two multiply. In a film's tracks the name
  means the setting; the opening's own goes in the intro's parameters.
- Below 1 the camera pulls back. The scene is not drawn wider than its frame, so the picture is shown
  smaller and repeats, mirrored, beyond its own edges: a tunnel of the scene, not more of the sky.
- The zoom redraws the scene, it does not enlarge the picture: particles, traces, the ring and the grids
  stay sharp. While the zoom changes, trails streak, as a moving camera's would. The title and the
  opening's dust are the two things that still soften.
- The camera pans only while it is zoomed in. It is a window into the picture the scene draws: the zoom is
  its size, the pan where it looks, and it stops at the picture's edge. At `cameraZoom` 2 with the hole in
  the middle it reaches a quarter of the frame each way, at 4 three eighths; at 1 the whole picture is in
  the frame and a pan does nothing. To move the picture at no zoom, move the hole (`blackHoleX`,
  `blackHoleY`).
- The point the camera looks at stands where the hole would: `cameraX` at 3 puts the place 3 radii right of
  the hole there. In a pair the zoom holds the common centre still while both holes circle it;
  `cameraPair` 1 holds the second hole still and follows it round its orbit, -1 the main one, and a track
  from -1 to 1 pans from one to the other. Labels and graphics that ride on the scene follow the camera.
- A pan is a track like any other: ease it for a glide, give it the hold ease for a cut. A cut starts the trails
  afresh; a glide streaks them.
- What counts as a cut is set: a zoom that changes by more than `cameraCutZoom` in one frame (8%), a
  picture that moves more than `cameraCutShift` pixels (80) and, in 3D, a camera that turns more than
  `cameraCutTurn` radians (0.35). Raised to their tops they never cut, and a jump smears every particle
  across the frame, a whip pan; at 0 any move of the camera starts the trails afresh and nothing streaks.
- `threeD` is another law of gravity, not only another view. The flat mode pulls a particle where it lands
  on the screen, in a layer of depth (`gravityDepth`), and the horizon takes whatever covers the hole at
  any depth. In 3D the hole is a point in space: gravity follows the true distance and ends at the sphere
  of `gravityReach`, the swirl turns around the line of flight or the spin's axis (`orbitalSpinFollow`),
  the horizon is a sphere, the opening reveals the field in a sphere that grows from the blast, and
  `gravityDepth` does nothing. Fewer particles fall in, so the ring's infall light is fainter.
- The 3D camera circles the point at `blackHoleDepth` on the line of flight: `cameraYaw` 0 looks along
  the flight and draws what the flat mode draws, 90 sees the column of particles flow past the hole from
  the side, 180 looks back up the stream. `cameraPitch` is degrees above (positive) or below. The two
  only matter while `threeD` is on, and the camera eases between the flat view and its place in
  `threeDEase` seconds, 1.2 by default, so a film can flip `threeD` on a track and get a turn instead of a
  cut; at 0 it cuts. For a full circle in a film keyframe `cameraYaw` from -180 to 180, or set
  `cameraSpin` in degrees a second. The point it circles is never nearer than `threeDNearest` of `farZ`:
  raised above `blackHoleDepth` it carries the hole, and the lattice with it, deeper into the column.
- From the side the field is a column with two ends, where particles are born and where they leave.
  `threeDEndFade` fades both over that share of `farZ`: 0 cuts them hard, 0.5 fades the whole column
  toward its middle. Straight on it does nothing.
- What turns with the camera is the field, the orbits (each on a plane of its own near the hole's
  equator, which lies across the line of flight while the hole does not spin), the flows (in that
  equator, each with its own tilt), the second black hole (it circles in a plane of its own,
  `companionTilt`), its waves, and the sky. The sky is a box round the camera that stands still in the scene: the stars, the nebula and
  the Lensed Grid cross the frame as a real sky does when a camera turns, faster at the frame's edges
  than in its middle, and behind the camera is another sky than ahead. A hole without spin looks the same from every side. A spinning hole's
  axis stands in the scene (`spinTilt` and `spinAxis` are as seen straight on), so as the camera circles
  it the flattened side of the shadow and the leaning rings turn with the view, and the particles are
  dragged round the axis in space. `gravityInertia` keeps their speed along all three axes.
- The sheet of section 9 is a surface of the scene in 3D, seen by this camera as the particles are: it
  lies in the main hole's equator, across the line of flight while the hole does not spin, so straight on
  it is seen face on with the hole in its middle and the well going away from the camera; circled to 90°
  it is seen edge on, past that from the side the well hangs down to, and the circle, the head, the moves
  and the roll all act on it, with the parallax of its near and far parts. `gridTilt` does nothing here:
  switching `threeD` on turns the sheet over `threeDEase` from the flat mode's tilted view to where it
  lies. The second hole's well stands where that hole's place falls on the plane, so a pair tilted out of
  the equator (`companionTilt`) dents it under where each hole is, not where it is seen.
- The circle is where the camera starts; six keys take it anywhere from there, all in 3D only and all at
  0 the circle alone, number for number. `cameraRoll` turns the whole picture about the middle of the
  screen (positive anticlockwise), the sky, the sheet and the ring's bright side (`ringSide`) with it;
  the circle and the head leave `ringSide` and `ringDoppler` where they are unless `ringSpinFollow` is
  up. `cameraLookYaw` and `cameraLookPitch` turn the camera's head without moving it: the hole slides off centre (to the edge at about 45°), so a
  shot can open on empty space and swing onto the hole, or let the hole cross the frame. The sky turns
  with the head as it does with the circle. `cameraMoveRight`, `cameraMoveUp` and `cameraMoveIn` move the
  camera itself along its own axes, in radii of the hole at its full size: near particles slide past
  faster than far ones (parallax, which no pan or zoom gives), and a move in is a real approach, so the
  hole grows as it does in perspective and, under `lensingTraced`, the lens sees it from nearer too.
  The camera circles about 11 radii away at the default size in a wide frame (half the frame's long side
  over the shadow's radius), so `cameraMoveIn` near that is at the shadow; past it the hole is behind the
  camera and its shadow, lens, ring and orbits are not drawn while the particles fly on. A fly-by is
  `cameraMoveRight` held at a few radii while `cameraMoveIn` runs from below 0 to past the distance, with
  `cameraLookYaw` turning to keep the hole in frame. A move through the sheet passes it: what lies
  behind the camera or nearer than its nearest is cut, as a stroke is.
- A roll or a turn of the head by more than `cameraCutTurn`, or a move by more than `cameraCutShift`
  pixels as seen at the hole, in one frame, is a cut like a jump of `cameraYaw`.

## 12. The page only

`frameRateCap`, `fpsCounter` and `scrollSpeedStep` belong to a device or to a hand on the wheel. They do
nothing in a film, and the first two are in no preset.

## 13. The opening: every parameter by its track

The opening is a star that explodes, light and matter fronts crossing the frame, a core that collapses, a
black hole that forms, rings and sends a gravitational wave, and a title that the hole takes. Times are
seconds from its start. Only the explosion's own events count from `collapseAt`: the glare, the light and
matter fronts, the echo, the camera's kick and shake. The moments after it are seconds of the opening too
and stay where they are when `collapseAt` moves, so an explosion moved by some seconds takes `remnantAt`,
`horizonAt`, `dissolveAt`, `releaseAt` and `introEnd` with it by as many (and `titleInAt`, when the title
has an entrance of its own): left behind, the opening still ends at its old second, and the shadow can
form before the star has exploded.

| Track | Parameters |
|---|---|
| Progenitor star | `starChargeStart`, `collapseAt`, `starPeakGlow`, `starRadiusStart`, `starRadiusGrowth`, `colorFlash` |
| Glare in the camera | `glareRise`, `glarePeak`, `glareDecay`, `glareRadius`, `exposureDip` |
| Light front | `lightCrossTime`, `lightPower`, `lightPowerDecay`, `lightWidth`, `lightDustContrast`, `colorLight` |
| Dust echo | `echoPower`, `echoPowerDecay`, `echoDecay`, `echoFloor`, `dustShock`, `dustScale`, `dustThreshold`, `dustBlow`, `dustDrift`, `dustSweep`, `colorDust` |
| Matter wave | `matterSpeed`, `waveRefraction`, `waveWidth` |
| Particle birth and burst | `revealFeather`, `burstPeak`, `burstCurve` |
| Background stars | `starsInitial`, `starsFadeIn`, `starFlare` |
| Collapsing core | `remnantAt`, `remnantDecay`, `redshiftDuration`, `remnantRadius`, `colorEmber` |
| Shadow, lens, ring | `horizonAt`, `horizonGrowth`, `lensDuration`, `ringDelay`, `ringFadeIn` |
| Ringdown and wave | `ringdownAmplitude`, `ringdownPitch`, `ringdownLength`, `ringFlicker`, `gravityWaveGain` |
| Title: type | `titleOffset`, `titleSize`, `titleWeight`, `titleTracking`, `colorTitle` |
| Title: light | `titleGlow`, `titleFlash`, `titleCooling`, `titleDust`, `titlePush`, `titleHalo`, `titleHaloRadius`, `titleStreak`, `titleFringe` |
| Title: arriving | `titleEntrance`, `titleInAt`, `titleInDuration` |
| Title: leaving | `titleExit`, `dissolveAt`, `dissolveDuration`, `titleFallEase`, `titleGrain`, `titleTidal`, `titleSpiral`, `titleSpread`, `titleStream`, `titleOrder`, `titleTrail`, `titleHeat`, `titleDrift`, `titleSwirl`, `titleRedshift` |
| Camera and film stock | `cameraSettle`, `cameraKick`, `shakeAmount`, `shakeDecay`, `lensFringe`, `vignette`, `filmGrain`, `letterbox`, `filmHold` |
| The hole's motion and the end | `releaseAt`, `introEnd`, `centerHoldFrequency`, `originAtHole` |

- `lightCrossTime` is the speed of light on screen. The matter front moves at `matterSpeed` of it, and the
  gravitational wave at exactly it, so one key sets the pace of the whole explosion.
- The ringdown's pitch and length are multiples of what a real hole of that size does, so a bigger hole
  rings lower and longer without touching them. They shape the opening's ringdown and a fired one, where
  the oval stands still and squashes one way and then the other; a merger rings by itself (section 8).
- `titleEntrance` and `titleExit` are choices: they take an option's name or index and cannot be keyframed.
  The falling-dust parameters matter only when the title falls into the hole; `titleDrift` and `titleSwirl`
  follow `gravityStrength` and `orbitalStrength`.
- The five colours take a hex string and can be keyframed; they move channel by channel.
- With `originAtHole` 1 the whole opening happens where the hole is placed.
- The film stock (`lensFringe`, `vignette`, `filmGrain`, `letterbox`) belongs to the opening and leaves
  with it. `filmHold` is the share of it that stays: 1 keeps the bars, the grain and the rest for a whole
  film, and in a film without the opening it is what shows them at all.
- The title's words, face and case are not parameters: the title command on the page, or the intro's title,
  font and uppercase in a film, or a cue's own when a film fires another title.

### Fine tuning: the numbers that shape each event

These were constants of the code. Each one's default is the constant it replaced, so an opening that leaves
them alone is drawn as it was; the intro debugger keeps them in the Fine Tuning group of their track.

| Track | Fine tuning |
|---|---|
| Progenitor star | `starChargeEase` |
| Light front | `lightReach` |
| Dust echo | `echoHoldThin`, `echoHoldThick`, `echoSwell`, `echoSwellMin`, `echoReach`, `dustBlowTime`, `dustDriftAngle`, `dustShockOffset`, `dustShockSharpness`, `dustShockTint` |
| Background stars | `starFlareDecay` |
| Collapsing core | `remnantEmberAt`, `remnantWhiteness`, `remnantDeep`, `remnantDim` |
| Shadow, lens, ring | `horizonEase` |
| Title: type | `titleLineHeight`, `titleMaxWidth`, `titleMargin` |
| Title: light | `titleDustSize`, `titleDustClumps`, `titleDustLow`, `titleDustHigh` |
| Title: arriving | `titleInOversize`, `titleInEase`, `titleRiseEase`, `titlePushEase`, `titleRiseLitBy` |
| Title: leaving | `titleFlyGrowth`, `titleFlyEase`, `titleOutGrowth`, `titleOutEase`, `titlePullLimit`, `titleSpeckSize`, `titleCurrentSize`, `titleBeyondSpeed`, `titleWink`, `titleSpiralRadius`, `titleSpiralMin`, `titleSpiralMax`, `titleBurnGrain`, `titleBurnFine`, `titleBurnEnds`, `titleBurnRim`, `titleBurnRimWidth`, `titleFallFadeAt`, `titleFlyFadeAt`, `titleCurrentContrast`, `titleOrderReach`, `titleCaptureEdge`, `titleReachFade`, `titleBurnMix`, `titleBurnEdge` |
| Camera and film stock | `cameraCreep`, `cameraSettleEase`, `cameraKickDecay`, `shakeRate`, `vignetteStart`, `vignetteEnd`, `filmKnee` |

- `lightReach` is how far past the farthest corner the fronts run in `lightCrossTime`, so it multiplies the
  on-screen speed of light: the matter front, the birth of the particles and the gravitational wave quicken
  with it, and the ringdown, which follows that speed, rings higher and shorter.
- The dust holds the light for a multiple of `echoDecay`: `echoHoldThin` in the thinnest haze,
  `echoHoldThick` in the thickest cloud. Its glow swells over `echoSwell` of `echoDecay` plus
  `echoSwellMin` seconds, and is half as bright `echoReach` of the screen's width from the explosion.
- `dustBlow` is covered over `dustBlowTime`; `dustDrift` goes the way `dustDriftAngle` points, in degrees
  anticlockwise from the right.
- The flare of `dustShock` stands `dustShockOffset` widths of the matter front (`waveWidth`) outside its
  middle, is as thin as `dustShockSharpness` and is coloured `dustShockTint` of the way from `colorDust`
  to `colorLight`. Behind the front `dustSweep` has cleared the dust, so a negative offset shows little.
- A star's `starFlare` lasts `starFlareDecay`.
- Over `redshiftDuration` the core cools from `colorFlash` to `colorEmber`, which it is at
  `remnantEmberAt` of the way with `remnantWhiteness` of the flash still in it, then sinks to that colour
  deepened, `remnantDeep` bright, having lost `remnantDim` of its glow.
- A key that ends in Ease is the power of a curve, 1 being an even pace: `starChargeEase` (the star's
  brightening), `horizonEase` (over `horizonGrowth`), `cameraSettleEase` (over `cameraSettle`),
  `titlePushEase` (`titlePush` over the title's life), and one for each way a title moves:
  `titleInEase` with Fades in, `titleRiseEase` with Gathers from dust and Comes out of the black hole,
  `titleFlyEase` with Flies past the camera, `titleOutEase` with Fades out. Falling in has `titleFallEase`.
- The sizes of those moves: a title fading in settles from `titleInOversize` too large, one flying past
  gains `titleFlyGrowth` sizes, one fading out `titleOutGrowth`.
- `titleLineHeight` and `titleMaxWidth` are read when the words are drawn, as `titleSize`, `titleWeight`,
  `titleTracking`, `titleHaloRadius` and `titleStreak` are: set them in the intro's params or a cue's own.
  A track on one moves nothing, and the film is told so. `titleMargin` is read every frame.
- The falling dust follows `gravityStrength` and `orbitalStrength` as multiples of 2.5 and 40, and
  `titlePullLimit` is the most either counts for. `titleSpeckSize` sizes the specks, and the grain of
  `titleDust` with them; `titleCurrentSize` is the width of the currents of `titleStream`;
  `titleBeyondSpeed` is the speed of dust beyond `gravityReach`; a speck takes `titleWink` of the fall to
  go out, in the order `titleOrder` sets.
- The finer shape of that fall: the currents of `titleStream` differ in speed by `titleCurrentContrast`;
  `titleOrder` puts out the dust nearest the hole first and the dust `titleOrderReach` of the screen's
  height away last; dust fades out over `titleCaptureEdge` of the horizon's radius outside `horizonScale`;
  and the speed of dust beyond `gravityReach` gives way to `titleBeyondSpeed` over `titleReachFade` reaches.
- When a title dims and is lit: one falling in starts to dim `titleFallFadeAt` of the way through
  `dissolveDuration`, one flying past at `titleFlyFadeAt`, and one gathering from dust or coming out of
  the hole is fully lit `titleRiseLitBy` of the way through `titleInDuration`.
- The grain of `titleDust`: clumps `titleDustSize` across, which the grain follows by `titleDustClumps`
  and each speck's own chance by the rest; grain below `titleDustLow` leaves a letter empty and grain
  above `titleDustHigh` leaves it solid, so the two set how much of a letter the dust eats.
- At `titleSpiral` 1 the dust `titleSpiralRadius` of the screen's height from the hole turns as
  `titleSwirl` sets, nearer dust up to `titleSpiralMax` times that and farther dust down to
  `titleSpiralMin`.
- The seven keys that begin titleBurn shape the Burns away exit alone: the two grains of the fire's ragged
  edge (`titleBurnGrain`, `titleBurnFine`) and the share of the larger in it (`titleBurnMix`), how soft that
  edge is (`titleBurnEdge`), how much it eats in from the ends (`titleBurnEnds`), and its glowing rim,
  `titleBurnRim` times `colorEmber` and `titleBurnRimWidth` wide.
- `cameraZoom` creeps `cameraCreep` of its way before `collapseAt`; `cameraKick` drops over
  `cameraKickDecay`; `shakeAmount` trembles at `shakeRate` times its own rate. `vignette` darkens from
  `vignetteStart` to `vignetteEnd`, in half sizes of the frame from its middle.
- `filmKnee` is not the opening's alone: it rolls off the highlights of every frame, whatever `filmHold`
  is and in a film without the opening too.

## 14. Layers of the opening

Each can be hidden on its own to see what it contributes, or to leave it out of a film: `star`, `glare`,
`light`, `echo`, `stars`, `shockwave`, `reveal`, `burst`, `remnant`, `ringdown`, `gravityWave`, `title`,
`hole`, `lens`, `ring`, `gravity`, `doppler`, `camera`.

The last six are the scene's own features as the opening brings them in. Hiding `gravity` flies the
particles straight through; hiding `camera` leaves the opening's zoom, shake and film stock out.

A layer is one of two kinds, and the list of layers from the page says which, with a line on each:

- An event happens once: `star`, `glare`, `light`, `echo`, `shockwave`, `burst`, `remnant`, `ringdown`,
  `gravityWave`, `title`, `camera`. A film fires it again with a cue, at the black hole, after the opening
  is over. Fired, `camera` is the jolt and shake of the blast alone, and `title` is a title that arrives
  and leaves again, with words of its own if the cue gives them.
- A state is there or not: `stars`, `reveal`, `hole`, `lens`, `ring`, `gravity`, `doppler`.

Every layer of either kind can be switched on and off along a film. What an event looks like when it is
fired is its parameters in the table of section 13.

## 15. Presets, fonts, sizes, caption places

- Simulation presets: `Default`, `Schwarzschild`, `Kerr`.
- Looks of the opening: `Default`, `Slow Burn`, `Flashbang`, `Anamorphic`, `Event Horizon`, `Nebula`,
  `Silent Dark`, `Supernova`, `Whirlpool`, `Swallowed`, `Requiem`. A look sets intro parameters, sometimes
  the title's face and some scene settings; parameters given beside it are laid over it.
- Title fonts: `unbounded`, `orbitron`, `geistMono`. Only the first and the last follow `titleWeight`.
- Caption fonts: the three above, `noto` (a plain text face for sentences and formulas) and `system` (the
  machine's own, so not the same everywhere). Behind every bundled one stand faces with Greek, mathematics
  and the signs of the Sun and the planets.
- Ways a caption arrives: `letters`, `words`, `lines`.
- Film sizes: `1080p`, `720p`, `4k`, `vertical`, `square`.
- Caption places: `bottom`, `top`, `center`, and three that point a line at something in the scene: `hole`
  (the shadow's edge), `einstein` (the Einstein ring), `companion` (the second black hole).

## 16. What is still fixed in code

A film shows only what it can set, so every number here is a limit on films. The tables cover the scene:
the particles, the holes, the lens, the grids, the opening and its title. Each line says what is fixed and
what a knob for it would cost. A film that needs one is asking for that knob: make it (SKILL.md, "A new
ability: the code"), delete its line here and write the film. A change that leaves a new number in the code
adds its line, and its report names it.

The cost of a knob, in the last column:

- **frame**: read once a frame, or handed to a shader as a uniform in place of the constant. Free.
- **birth**: read once when a star or a title is made. Free.
- **particle**, **pixel**: adds work to every particle of the field's step or to every pixel of the composite
  pass, so CLAUDE.md's Measuring decides.
- **has one**: a value of nature whose multiple is a knob already, named in the line. Nothing to bring out.
- **machine**: held by frame time, memory or the precision of the arithmetic. It stays.

### The particles

| Fixed | File in src/lib | Cost |
|---|---|---|
| How the pull falls with distance, as (radius / distance)^2, and the bell of the depth band (in 3D the true distance, out to the sphere of Gravity Reach) | field_step.ts | particle |
| The spin's drag, spin / 2 at one radius | field_step.ts | has one: `frameDrag` |
| How the drag falls: one power of the distance faster than the pull, so `frameDrag` makes the vortex stronger and never wider | field_step.ts | particle |
| What spin lying in the screen does along the line of sight: nothing, so both sides of a tilted hole fall alike | field_step.ts | particle |
| How the swirl's axis turns to the spin's in 3D: by `orbitalSpinFollow` times the spin itself, a straight line | scene.ts | frame: a curve, not a number |
| The flight's tint a quarter turn or more off the line of flight: the edge colour in full | webgl_shaders.ts | frame |
| A particle nearer than the 3D camera's near plane is lit by the length of its stroke, the camera's move with it | field_step.ts | machine |
| A captured particle is reborn in four tries, else on the rim, up to half a capture radius outside it | field_step.ts | machine |
| Motion capped at six reference frames a step; a stall treated as one frame | particle_simulation.ts, frame_pacing.ts | machine |

### The flows

| Fixed | File in src/lib | Cost |
|---|---|---|
| The path: the radius to the power 1.5 runs evenly from the first radius to the last, and the turn rate falls as the radius to the power -1.5 | flows.ts, webgl_shaders.ts | frame |
| The plane the flows lie in: the main hole's equator, which faces the swirl's axis, before each flow's own tilt | scene.ts, flows.ts | frame |
| A flow round the second hole, or the centre of a pair, lies in the main hole's equator too, not the second hole's | scene.ts | frame |
| A thick disc's shape: each orbit tipped a little, the height swinging once a turn as the sine of the angle round the hole; not a bell, not flaring with the radius | webgl_shaders.ts | frame |
| A particle's share of the height and its orbit's phase: drawn evenly from 0 to the whole and all the way round, anew each life | webgl_shaders.ts | frame |
| A particle appears over the first 6% of its life and leaves over the last | flows.ts | frame |
| Each particle is drawn at 40% to 100% of its flow's brightness | webgl_shaders.ts | frame |
| A trail dims toward its tail as the square of what is left of it | webgl_shaders.ts | frame |
| In 3D a stroke fades nearer the camera than half the hole's distance and is gone at a fifth | flows.ts | frame |
| A trail is drawn in 12 pieces; a flow holds 40 000 particles at most; three flows | flows.ts | machine |
| Where a flow's particles stand at second 0: one set of numbers for every film, whatever its seed | flows.ts | birth |
| What a flow leaves in the photon ring: a particle a life, each direction a half to one and a half times its even share | scene.ts, ring_energy.ts | frame |

### The photon ring

| Fixed | File in src/lib | Cost |
|---|---|---|
| The second hole's ring: a plain line at `ringBase`, with no feed and no Doppler sides | webgl_shaders.ts | pixel |
| The ring's light is kept in 256 directions | ring_energy.ts | machine |

### The lens and the shadow

| Fixed | File in src/lib | Cost |
|---|---|---|
| The shadow at 2.598 Schwarzschild radii, and the ray's path under Ray Traced | lens_trace.ts, kerr_glsl.ts | has one: `blackHoleSize` is the shadow |
| The fastest spin, 0.998 | scene.ts | has one: the top of `blackHoleSpin` |
| The nearest the Ray Traced camera stands, 2 Schwarzschild radii | lens_trace.ts | machine: the photon sphere is at 1.5 |
| The stylized lens's bubble, the cosine of the pull, which `lensingReach` blends with a point mass | webgl_shaders.ts | pixel |
| How much light the pull removes: half the pull, times `lensingAbsorption` | webgl_shaders.ts | has one |
| The second hole's lens: a point mass, softened inside half its shadow, with none of the lens settings | webgl_shaders.ts | pixel |
| The outline of a spinning hole's shadow: 128 points, redrawn when the camera moves 2% | kerr_shadow.ts | machine |

### Orbiting stars

| Fixed | File in src/lib | Cost |
|---|---|---|
| The speed of light, 1.2 short sides a second, and how the orbits precess | orbiters.ts | has one: `orbitSpeed` is the rate of their time |
| At most 64 stars, and traces of 60 s at most | orbiters.ts, particle_renderer.ts | machine |
| The spin's field on the stars: that of a spinning mass, J = spin / 4, turning a plane at 2 J / r^3 | orbiters.ts | has one: `orbitDrag` |
| The spin's field is held at its strength at the Schwarzschild radius for a star that passes inside it | orbiters.ts | machine |
| A star's tilt is drawn evenly between 0 and `orbitInclination`, not by the sky's share at each tilt, and its node evenly round the equator | orbiters.ts | birth |
| Every star is born going the same way round the equator | orbiters.ts | birth |

### A second black hole and the waves

| Fixed | File in src/lib | Cost |
|---|---|---|
| Kepler's law for the pair | companion.ts | has one: `companionSpeed` is the rate of its time |
| The spiral wave's stretch, 0.16 radii at the shadow as the two touch | companion.ts | has one: `companionWaves` |
| That a wave weakens as 1 over the distance and moves the picture across its path | webgl_shaders.ts | has one: `companionWaves`, `gravityWaveGain` |
| A real hole's ringdown tone, and how spin raises it | intro_params.ts, companion.ts | has one: `ringdownPitch`, `ringdownLength` |
| The spin a merger leaves, 0.69 for two equal holes, held under 0.95, where the fit of its tone still holds | companion.ts | has one: `companionSpin` |
| The second hole has no spin of its own | companion.ts, particle_simulation.ts | particle and pixel: a new effect |
| How much of the nearer hole's bend the farther one is seen through in 3D: its depth behind it over its distance from the camera, a thin lens | scene.ts | frame: a law, not a number |
| The depth between two holes at which the nearer one's shadow hides the farther one's ring in full: the sum of their radii | scene.ts | frame |
| A wave is drawn where the pixel is, not where the nearer hole's lens takes its ray | webgl_shaders.ts | pixel |
| The pair's plane does not precess: the holes' spins neither turn it nor are turned by it | scene.ts | frame: a law, not a number |
| A hole alone rings, and sends a fired wave, in the plane across the line of flight; a pair's plane only while there is a second hole | scene.ts | frame |
| The flat mode draws a tilted orbit at no depth, as it lies across the screen: neither hole larger for being nearer | scene.ts | frame |
| The sheet's spiral wave turns with the line between the two wells as they land on the sheet, not with the tilted orbit itself | space_grid.ts | frame |

### The grids and the sky

| Fixed | File in src/lib | Cost |
|---|---|---|
| How deep the sheet lies at a distance: the slowing of time where light passing there comes nearest | webgl_shaders.ts | has one: `gridDepth` |
| The sheet's 225 lines each way, in 192 pieces each, where `gridSpan` ends at a small `gridCell` | space_grid.ts | machine |
| Where the sheet's rings stand: at equal steps of the well's depth, so their radii follow from `gridRings` alone | webgl_shaders.ts | frame: a shape, not a number |
| The sheet's waves do not carry the particles `gridRide` lays on it | webgl_shaders.ts | particle: the wave's height at each particle |
| Which side of a hole a line of the sheet passes: the sheet is drawn over the finished frame, and every line is cleared round each shadow as the screen shows it (`gridClearing`), whether it passes behind the hole or before it | particle_renderer.ts, webgl_shaders.ts | pixel: the sheet drawn into the layer the lens reads, or its depth weighed against the hole's, a later stage |
| How a particle's ride falls across the slab: a smooth step from the plane to `gridRideDepth`, alike on both sides | webgl_shaders.ts | frame: a curve, not a number |
| A ridden stroke with an end whose point of the surface lies nearer than the sheet camera's nearest is dropped whole, not cut there | field_step.ts, webgl_shaders.ts | particle |
| The second hole's well dents the sheet at its full depth however far that hole stands off the plane | space_grid.ts | frame |
| While 3D eases in, the sheet's pose, wells and lines go straight from the flat camera's numbers to the 3D camera's, each on its own, not turned: the lines, counted from the middle of the screen flat and from the point the camera circles in 3D, slide | space_grid.ts | frame: a path, not a number |
| The lattice's 13 lines each way along each of the three axes, in 48 pieces each: the top of `gridLatticeReach` | space_lattice.ts | machine |
| A star's own twinkle, 2 to 5 radians a second, the brighter the faster, and its brightness, the square of an even draw | webgl_shaders.ts | has one: `starsTwinkleSpeed`, `starsFaintest` |
| One star at most in a cell, placed in its middle 0.6 and drawn inside that cell alone, which cuts a large `starsSize` off at its edge | webgl_shaders.ts | pixel |
| The sky is a cube round the middle of the screen (the field's vanishing point follows the hole): the Lensed Grid's lines turn a corner where two faces meet, and a strongly bent ray or a zoom below 1 shows that edge | webgl_shaders.ts | pixel: a sphere's grid would have poles instead |
| No star within three of its radii of a face's edge, about 5 px of empty sky along each | webgl_shaders.ts | pixel: each pixel would read the next face's cells too |
| The nebula's clouds blend between two faces over the last quarter of the way to their edge | webgl_shaders.ts | frame |
| The Lensed Grid's lines keep their width across a face by the slant of the ray to the power 0.75 | webgl_shaders.ts | frame |
| How the Lensed Grid's pull is found: 8 halvings of the span the node can lie in, then a straight line across the last | webgl_shaders.ts | machine |
| The nebula's clouds: three layers of noise, each 2.1 times finer and turned, the slower noise that curls them at 0.8 of their size, the grain at 1.7 times the finest; a Detail knob for the layers would take a loop to a fixed most with a break | webgl_shaders.ts | pixel |

### The opening

| Fixed | File in src/lib | Cost |
|---|---|---|
| The dust's clouds: three layers of noise, each 2.1 times finer, bent by a slower one; `dustScale` and `dustThreshold` size and thin them | webgl_shaders.ts | pixel |
| The colour of dust the front has just struck: the light front's, fading to the dust's own as the square of how fresh its glow is | webgl_shaders.ts | frame: a curve, not a number |
| The pattern of the camera's shake: two sines a side, the second 0.6 as strong and a little over half as fast, at 40 to 83 radians a second | scene.ts | frame: a pattern, not a number; `shakeRate` speeds all of it |
| The fades that are a smooth step between their two moments: the stars' fade-in, the lens, the ring, the film look lifting, the field turning to the screen's centre | intro_timeline.ts | frame: a shape with no number in it; each one's length is a knob, and the curves that are a power have theirs |
| How `lensFringe` grows: evenly from the middle of the frame to its corners | webgl_shaders.ts | frame: a shape, not a number |
| The opening for reduced motion: 2.6 s, its fades fixed | intro_timeline.ts | machine |

### The title

| Fixed | File in src/lib | Cost |
|---|---|---|
| The hole the title's fall is measured against: at `gravityStrength` 2.5 and `orbitalStrength` 40 the dust travels `titleDrift`, the whole title drawn in by 2.5 times that, and turns 0.35 of a radian at `titleSwirl` 1 | scene.ts, webgl_shaders.ts | has one: `titleDrift`, `titleSwirl` |
| The streak behind the falling letters: three fainter copies, each 13% behind the last; `titleTrail` scales them | webgl_shaders.ts | pixel |
| The halo brought up 1.5 times, since a blur spreads the letters' light thin | webgl_shaders.ts | has one: `titleHalo` |
| The room round the words for their glow, and a bitmap of 4096 px at most | title_sprite.ts | machine |

### The camera of the scene

| Fixed | File in src/lib | Cost |
|---|---|---|
| The picture is drawn into 4.5 million device pixels at most, 2 to a CSS pixel | particle_canvas.tsx | machine |
| The 3D camera's nearest, 1 scene unit: a hole nearer than that, or behind the camera, is not drawn, and a stroke and a line of the sheet are cut there | scene.ts, field_step.ts, space_grid.ts | machine |
| The orbits' traces are set in perspective around the hole's own place on the screen, not each point on its own, which a camera that looks far aside or comes very near shows as a slight misfit | webgl_shaders.ts | pixel: each point projected alone |
