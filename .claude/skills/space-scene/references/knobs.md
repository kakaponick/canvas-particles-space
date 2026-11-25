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
| How fast | `baseSpeed`, `speedVariance` |
| What a particle looks like | `particleSize`, `particleSizeMin`, `trailIntensity`, `speedGlow`, `speedGlowKnee`, `baseBrightness` |
| How depth changes it | `depthFade`, `minOpacity`, `maxOpacity` |
| Twinkle | `pulseIntensity`, `pulseSpeedMultiplier` |
| Colours | `colorPalette`, `backgroundR`, `backgroundG`, `backgroundB` |
| The tint of a fast flight: its two colours, where one gives way to the other, how much, from what speed | `flightTintAhead`, `flightTintEdge`, `flightTintGradient`, `flightTintLimit`, `flightTintFrom`, `flightTintFull` |

What follows from how it is drawn:

- A particle's brightness is its speed. A particle that did not move draws nothing, so `baseSpeed` 0 leaves
  the field dark except where gravity moves it. `speedGlow` bends that link: 0 lights every moving
  particle in full, high values leave only the fast ones. `speedGlowKnee` is the speed that lights a
  particle half way, the point the curve bends round: lower it and a slow flight and the far field show,
  raise it and only the streaks near the camera stay.
- A particle thins with distance from `particleSize` down to `particleSizeMin`. Raise the second to the
  first and the field is drawn in strokes of one width, a flat graphic look; at 0 the far field thins away.
- The trail is the fade of the picture, not part of the particle. `trailIntensity` 0 means nothing ever
  fades: a long exposure. Together with `baseSpeed` 0 the black hole draws with its own pull.
- Gravity is not scaled by the flight speed, so slowing the flight does not weaken the hole.
- `colorPalette` is an array of colours with shares; a particle takes its colour when it is born, so a new
  palette arrives as particles are recycled. It is set, never keyframed. The background channels can be
  keyframed.
- A fast flight tints the particles over their own colours (the `doppler` layer): `flightTintAhead`
  round the point the field flies out of, `flightTintEdge` toward the edges. It begins at a flight speed
  of `flightTintFrom` and is whole at `flightTintFull`, so at the default `baseSpeed` there is none: lower
  `flightTintFrom` to 0 to tint a slow flight. `flightTintGradient` is how fast one colour gives way to
  the other outward (the turn lies 1 / it of the way to the corner; at 1 and below the frame is all
  `flightTintAhead`), and `flightTintLimit` the most of a particle's colour the tint replaces: at 1 a
  fast flight is two flat colours. The two colours take a hex string and can be keyframed.
- On the page the count is trimmed by the particle budget; in a film `numParticles` is exact, up to
  200 000, and costs render time in proportion.

## 3. Gravity on the particles

| What | Keys |
|---|---|
| Pull towards the hole (negative pushes away) | `gravityStrength` |
| Sideways force that makes them swirl (the sign is the direction) | `orbitalStrength` |
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
- The orbiting stars feel the pull round (Lense-Thirring) from the share of spin along the line to the
  camera, so `spinTilt` near 0° or 180° swings them most and 90° not at all.
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
  (`ringSide`) on the flat side, which turns toward the camera. `ringSide` and `ringDoppler` do not follow
  the spin by themselves: the approaching side is at 180° plus `spinAxis` at every tilt (past 90° the hole
  is seen turning the other way about the line of sight, but the same limb comes toward the camera), and
  the contrast a real hole shows grows as the sine of `spinTilt`. A film drives both along the tilt (films.md,
  section 10).

## 5. The lens: how light bends

The lens bends the finished picture (particles, stars, grids), not the particles' paths.

| What | Keys |
|---|---|
| On or off | `lensingEnabled` |
| Exact light paths (ray traced) or the stylized lens | `lensingTraced` |
| Size of the Einstein ring, in radii | `lensingRadius` |
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
| The approaching side brighter and bluer, and which side that is | `ringDoppler`, `ringSide` |
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

Up to 64 stars with real velocity in the plane of the screen: ellipses that precess, faster the closer they
come, as around a real black hole.

| What | Keys |
|---|---|
| How many (0 is none) | `orbitCount` |
| Shape of the orbits | `orbitSize`, `orbitEccentricity` |
| Rate of their time; the sign is the direction | `orbitSpeed` |
| How long a trace stays lit, and its width | `orbitTrail`, `orbitStarSize` |
| How much the orbits differ from the size and the stretch set | `orbitSizeSpread`, `orbitEccentricitySpread` |
| The closest a new orbit comes, and how far out a star counts as gone, in Schwarzschild radii | `orbitClosest`, `orbitEscape` |
| How hard the spin swings the orbits, × what the spin itself gives | `orbitDrag` |
| Seconds a new star takes to light up | `orbitFadeIn` |

- Changing `orbitSize`, `orbitEccentricity`, `orbitSizeSpread`, `orbitEccentricitySpread` or `orbitClosest`
  makes every orbit anew, so do not glide them along a track: set them at the start, or step them with the
  hold ease.
- Both spreads at 0 put every star on the same ellipse, turned differently: a clean rosette. `orbitSizeSpread`
  at its top scatters them from the shadow's edge to twice `orbitSize`.
- `orbitClosest` and `orbitEscape` are in Schwarzschild radii, the unit of the orbits' own physics (the
  shadow is 2.6 of them), so they still follow `blackHoleSize`. Below 3 no orbit lasts: a low `orbitClosest`
  with a high `orbitEccentricity` feeds stars to the ring, a high one keeps them all clear. A low
  `orbitEscape` replaces a flung star while it is still in the frame.
- `orbitDrag` is the stars' own multiple of the spin's pull round and leaves `frameDrag`, the particles',
  alone. It needs `blackHoleSpin` and `spinTilt` away from 90°; raised, the rosettes turn faster and the
  closest stars are thrown in or out.
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
- At `companionSpeed` 1 a turn at 8 radii takes about 15 s. A short film wants 2 to show the pair circling.
- Two horizons take more of the flight than one: over a long approach the field can thin out. Lower
  `gravityStrength`, or `horizonScale`, when the picture needs the particles.
- The companion has its own shadow, lens, ring, gravity and well in the sheet.

## 9. Curved space made visible: the grids and the lattice

| What | Keys |
|---|---|
| Cell size, shared by the sheet and the lensed grid | `gridCell` |
| The sheet: brightness (0 is off), viewing angle, depth of the well in radii | `gridSheet`, `gridTilt`, `gridDepth` |
| The lattice in three dimensions: brightness (0 is off), its cell in radii, how hard it is drawn in | `gridLattice`, `gridLatticeCell`, `gridLatticeWarp` |
| A flat grid on the sky read through the lens (0 is off) | `gridSky` |

- The sheet is a diagram: a surface dented where the hole sits, rippled by gravitational waves. It stays
  put while the hole moves across it. At a `gridTilt` of 60 and above the well's depth shows.
- The dent is gravitational time dilation, and can be said so in a caption: a place is lowered by how much
  time is slowed where the light seen at that distance passed closest to the hole. Far away the sheet is
  flat; at the shadow's edge, where that light skims the photon sphere, it is `gridDepth` deep and ends.
- The lensed grid is a measuring tool: it shows the Einstein ring, the mirrored image, the twist and the
  waves. Lower `baseBrightness` when it should be read clearly.
- The lattice is the sheet's law in three dimensions: lines along the three axes of the scene, each node
  drawn in towards the hole by the same slowing of time, in shadow radii times `gridLatticeWarp`, taken so
  that no node reaches the centre and no line folds over. It is a ball of 6 cells around the hole that
  fades out over its outer half, so at the default `gridLatticeCell` of 1 the whole ball fits the frame of
  the default camera; a larger cell reaches farther and passes the camera. It stands still while the
  hole moves through it and a second hole pulls it too.
- The lattice is drawn into the layer of the orbits' traces and read through the lens: the lines behind
  the hole are bent into its Einstein ring even at `gridLatticeWarp` 0, and the shadow covers it. It is
  made for `threeD`, where the camera circles it; in the flat mode it is seen straight on, down the line
  of flight. Among a bright field lower `baseBrightness` or raise `gridLattice`.

## 10. Background stars and the sky

`starsBrightness`, `starDensity`, `starCell`: fixed stars behind everything, bent by the lens and rippled
by the waves. They keep their size at any zoom.

`nebula`, `nebulaColor`, `nebulaColorDeep`: a nebula behind the stars, bent and rippled like them. It is the
dust of the opening (section 13) glowing on its own, so its shape is the dust's: `dustScale` sizes the
clouds, `dustThreshold` sets how much of the sky they fill (0.1 to 0.2 fills it with haze, the default
leaves wisps), `dustDrift` moves them (0 holds the sky still). Those are intro parameters and work without
the opening too; changing them changes the dust the flash lights as well. The nebula shows as the opening
lets the stars show, and hiding the `stars` layer hides it. It adds light, so a dark background colour
under it (`backgroundR`..`backgroundB`) deepens the gaps between the clouds. In 3D it turns with the camera
and, having no cells to repeat by, blends into itself over a full turn, so its contrast is lowest when the
camera looks back along the flight.

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
| How much of the 3D column fades at each of its ends, as a share of `farZ` | `threeDEndFade` |

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
- `threeD` is another law of gravity, not only another view. The flat mode pulls a particle where it lands
  on the screen, in a layer of depth (`gravityDepth`), and the horizon takes whatever covers the hole at
  any depth. In 3D the hole is a point in space: gravity follows the true distance and ends at the sphere
  of `gravityReach`, the swirl turns around the line of flight, the horizon is a sphere, and
  `gravityDepth` does nothing. Fewer particles fall in, so the ring's infall light is fainter.
- The 3D camera circles the point at `blackHoleDepth` on the line of flight: `cameraYaw` 0 looks along
  the flight and draws what the flat mode draws, 90 sees the column of particles flow past the hole from
  the side, 180 looks back up the stream. `cameraPitch` is degrees above (positive) or below. The two
  only matter while `threeD` is on, and the camera eases between the flat view and its place in about a
  second, so a film can flip `threeD` on a track and get a turn instead of a cut. For a full circle in a
  film keyframe `cameraYaw` from -180 to 180, or set `cameraSpin` in degrees a second.
- From the side the field is a column with two ends, where particles are born and where they leave.
  `threeDEndFade` fades both over that share of `farZ`: 0 cuts them hard, 0.5 fades the whole column
  toward its middle. Straight on it does nothing.
- What turns with the camera is the field, the orbits (they lie across the line of flight, so they are
  seen as ellipses from above), the second black hole (it circles in that plane too) and the sky, which
  slides with the camera's turn. A hole without spin looks the same from every side. A spinning hole's
  axis stands in the scene (`spinTilt` and `spinAxis` are as seen straight on), so as the camera circles
  it the flattened side of the shadow and the leaning rings turn with the view, and the particles are
  dragged round the axis in space. `gravityInertia` keeps their speed along all three axes.
- The sheet of section 9 is a plane of the scene in 3D: `cameraYaw` spins its lines around the point the
  camera circles, and `cameraPitch` is taken from `gridTilt` (seen more from above as the camera rises).
  Past 75° it fades, and it is gone by the time the camera is level with it, so it is never seen from
  below. Its wells stay under the black holes wherever they are seen.

## 12. The page only

`frameRateCap`, `adaptiveParticles`, `fpsCounter` and `scrollSpeedStep` belong to a device or to a hand on
the wheel. They do nothing in a film, and the first three are in no preset.

## 13. The opening: every parameter by its track

The opening is a star that explodes, light and matter fronts crossing the frame, a core that collapses, a
black hole that forms, rings and sends a gravitational wave, and a title that the hole takes. Times are
seconds from its start; everything after the explosion counts from `collapseAt`.

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
- **particle**, **pixel**: adds work to every particle of the hot loop or to every pixel of the composite
  pass, so CLAUDE.md's Measuring decides.
- **has one**: a value of nature whose multiple is a knob already, named in the line. Nothing to bring out.
- **machine**: held by frame time, memory or the precision of the arithmetic. It stays.

### The particles

| Fixed | File in src/lib | Cost |
|---|---|---|
| How the pull falls with distance, as (radius / distance)^2, and the bell of the depth band (in 3D the true distance, out to the sphere of Gravity Reach) | particle_simulation.ts, particle_simulation_3d.ts | particle |
| The spin's drag, spin / 2 at one radius | particle_simulation.ts, particle_simulation_3d.ts | has one: `frameDrag` |
| How the drag falls: one power of the distance faster than the pull, so `frameDrag` makes the vortex stronger and never wider | particle_simulation.ts, particle_simulation_3d.ts | particle |
| What spin lying in the screen does along the line of sight: nothing, so both sides of a tilted hole fall alike | particle_simulation.ts | particle |
| A captured particle is reborn in four tries, else on the rim, up to half a capture radius outside it | particle_simulation.ts, particle_simulation_3d.ts | machine |
| Motion capped at six reference frames a step; a stall treated as one frame | particle_simulation.ts, frame_pacing.ts | machine |

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

### A second black hole and the waves

| Fixed | File in src/lib | Cost |
|---|---|---|
| Kepler's law for the pair | companion.ts | has one: `companionSpeed` is the rate of its time |
| The spiral wave's stretch, 0.16 radii at the shadow as the two touch | companion.ts | has one: `companionWaves` |
| That a wave weakens as 1 over the distance and moves the picture across its path | webgl_shaders.ts | has one: `companionWaves`, `gravityWaveGain` |
| A real hole's ringdown tone, and how spin raises it | intro_params.ts, companion.ts | has one: `ringdownPitch`, `ringdownLength` |
| The spin a merger leaves, 0.69 for two equal holes, held under 0.95, where the fit of its tone still holds | companion.ts | has one: `companionSpin` |
| The second hole has no spin of its own | companion.ts, particle_simulation.ts | particle and pixel: a new effect |

### The grids and the sky

| Fixed | File in src/lib | Cost |
|---|---|---|
| The colour of both grids, and the Lensed Grid's line, 1.5 px wide | space_grid.ts, webgl_shaders.ts | frame |
| The sheet's camera, 2.5 long screen sides away, and its span of 2.2, fading over the outer half | space_grid.ts, webgl_shaders.ts | frame |
| The wave's lift on the sheet, 4 times its stretch of the sky | space_grid.ts | frame |
| The sheet's lines: 1.25 px, at most 3 times wider near the camera, cut off nearer than 0.2 of its distance, and cleared from 1.04 to 1.2 radii round each hole | space_grid.ts, webgl_shaders.ts | frame |
| How deep the sheet lies at a distance: the slowing of time where light passing there comes nearest | webgl_shaders.ts | has one: `gridDepth` |
| The sheet's 225 lines each way, in 192 pieces each | space_grid.ts | machine |
| How far the sheet leans in 3D: the camera's elevation, up to 75°, past which it fades out before it is seen edge-on | scene.ts | frame |
| The lattice's lines: 1.5 px wide, 1.6 times the sheet's colour, in a ball of 6 cells that fades over its outer half | space_lattice.ts, webgl_shaders.ts | frame |
| How the lattice fades with depth: out nearer the camera than half the way to the point it circles, and down to 0.3 far behind that point | scene.ts, webgl_shaders.ts | frame |
| The lattice's 13 lines each way along each of the three axes, in 48 pieces each | space_lattice.ts | machine |
| A background star: a point of light about 1.5 px across, tinted between warm and cool, twinkling by 15% | webgl_shaders.ts | frame |
| One star at most in a cell, placed in its middle 0.6 | webgl_shaders.ts | pixel |
| The nebula's patches of its second colour, 3 Dust Scales across, turning over the middle 0.4 of a noise | webgl_shaders.ts | frame |

### The opening

| Fixed | File in src/lib | Cost |
|---|---|---|
| The dust's clouds: three layers of noise, each 2.1 times finer, bent by a slower one; `dustScale` and `dustThreshold` size and thin them | webgl_shaders.ts | pixel |
| How long dust holds the light: 0.4 of `echoDecay` in thin haze to 1.8 in the thickest cloud, swelling over 0.15 of it, and dimming with distance over half a screen width | webgl_shaders.ts | frame |
| The dust's motion: the direction it drifts, and the 1.2 s the blast takes to push it `dustBlow` | webgl_shaders.ts | frame |
| Where the matter front lights the dust: 0.6 of its width behind the front | webgl_shaders.ts | frame |
| The 0.18 s a background star stays flared by the light front | webgl_shaders.ts | frame |
| The remnant's colours as it reddens: from the flash to the ember, then dark, 0.7 dimmer at the end | webgl_shaders.ts | frame |
| How far the blast reaches: 1.15 times the farthest corner of the screen | scene.ts | frame |
| The camera's shake, two sines a side at 40 to 83 radians a second, and the 0.16 s its kick takes to drop to a third | scene.ts, intro_timeline.ts | frame |
| The camera's zoom: a tenth of the way before the collapse and the rest eased out until `cameraSettle` | intro_timeline.ts | frame |
| The eases of the timeline: how each fade and growth starts and settles between its two moments | intro_timeline.ts | frame |
| The film look: the vignette from 0.45 to 1.45 of the frame's half size, highlights rolled off above 0.8, `lensFringe` growing to the corners | webgl_shaders.ts | frame |
| The opening for reduced motion: 2.6 s, its fades fixed | intro_timeline.ts | machine |

### The title

| Fixed | File in src/lib | Cost |
|---|---|---|
| The hole the title's fall is measured against: at `gravityStrength` 2.5 and `orbitalStrength` 40 the dust travels `titleDrift` and turns 0.35 of a radian at `titleSwirl` 1; a stronger hole counts up to 4 times | scene.ts, webgl_shaders.ts | frame |
| Its dust: specks 2 CSS px across in currents 11 px wide, dust beyond gravity's reach falling at 0.15 of the speed, each speck winking out over 0.15 of the fall | webgl_shaders.ts | frame |
| The streak behind the falling letters: three fainter copies, each 13% behind the last; `titleTrail` scales them | webgl_shaders.ts | pixel |
| The burning: the ragged edge's two grains, 18 and 5 px, eating in from the ends, with a rim 2.5 times the ember | webgl_shaders.ts | frame |
| How much the inner part winds further round at `titleSpiral` 1: 0.4 to 3 times | webgl_shaders.ts | frame |
| How a title arrives and leaves: 9 times larger as it flies past the camera, 12% too large fading in, 6% growing as it fades out | intro_timeline.ts | frame |
| Its setting: lines 1.3 em apart and 1400 px wide at most, 16 px clear of the screen's edges, the halo brought up 1.5 times | title_sprite.ts, scene.ts, webgl_shaders.ts | birth |

### The camera of the scene

| Fixed | File in src/lib | Cost |
|---|---|---|
| A cut: a zoom of more than 8%, a move of more than 80 px or, in 3D, a turn of more than 0.35 radians in one frame starts the trails afresh | particle_renderer.ts, scene.ts | frame |
| The 3D camera's 1.2 s ease between the flat view and its place, and the nearest point it circles, 0.05 of Field Depth | scene.ts | frame |
| The picture is drawn into 4.5 million device pixels at most, 2 to a CSS pixel | particle_canvas.tsx | machine |
