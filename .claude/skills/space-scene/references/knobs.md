# Every knob, by the law it belongs to

A map of the laws. Each section is one law and is built the same way:

- **Gate** first: the knobs without which the law's effect does not show. A tracer that shows nothing
  means a shut gate; open it before tuning anything else.
- A table of the law's keys.
- What goes with what: how the keys act on each other and on other laws, and the traps, each told as
  cause -> what the frame shows.

A key's range, default, unit, figures and real-physics anchor live in its description: read them with
describe and a filter word when you set the key.

A name in backticks in this file is always a key, a layer, a preset, a font, a film size, a caption place
or a file. The audit script reads the file by that rule and fails when a name is missing or no longer
exists.

## Contents

1. The unit everything is measured in
2. The flight: the particle field (and the flows)
3. Gravity on the particles
4. Capture: the event horizon (and spin)
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

## 1. The unit everything is measured in

Gate: `blackHoleSize` above 0. At 0 there is no black hole: no shadow, lens, ring, capture or pull, and
the lattice and the flows measure their cells and radii in `gridLatticeUnit` instead.

`blackHoleSize` is the radius of the shadow, as a percent of the frame's short side. Every other length
around the hole is in **radii**, black hole radii: `horizonScale`, `gravityReach`, `lensingRadius`,
`orbitSize`, `companionSize`, `companionDistance`, `gridDepth`, `ringWidth`, a flow's radii, the
lattice's cell, the 3D camera's moves. So one key scales the whole black hole and nothing has to be kept
in step. At a fixed place on the screen the pull grows with the square of the size.

A real shadow is 2.6 Schwarzschild radii, so n radii are 2.6 n Schwarzschild radii: that is the one
conversion a caption or a description needs. The orbiting stars' own distances (`orbitClosest`,
`orbitEscape`) are counted in Schwarzschild radii, the unit of their physics, and still follow the size.

### Nature and its stand-ins

Most laws have a value nature gives, and their knob says so ("1 = real", "2 = Newton"); a few laws the scene
does not simulate are drawn by a stand-in. A caption may claim what a knob at nature's value shows; what a
stand-in shows is a picture of the idea. Know which of the two a shot is made of.

| Law | Nature's value | Stand-in, and what it replaces |
|---|---|---|
| The pull | `gravityFalloff` 2 (Newton), `threeD` for the true distance | `gravityReach` ends gravity, which has no edge (200, its most, comes nearest: in 3D the wake behind the hole stops changing from about there); the flat mode's layer (`gravityDepth`) stands in for distance along the line of sight |
| Keeping speed | `gravityInertia` 1 (Newton's first law) | below 1 a share of the speed is lost every 60th of a second; 0 moves a particle only while it is pushed |
| The swirl | none: `orbitalStrength` 0 | Orbital Force, for the angular momentum infalling gas brings with it |
| Frame dragging | `frameDrag` 1, `frameDragFalloff` 1, `frameDragSight` 1; orbits' planes `orbitDrag` 1 | |
| Capture | `horizonScale` 1, the shadow's edge, where every ray the camera sees ends in the hole | |
| The lens | `lensingTraced` on, `lensingAbsorption` 0 | the stylized lens and its keys; and in the flat mode the particles, seen through the lens as if they lay behind the hole (section 5) |
| The photon ring | its outline, and its bright side from the spin (`ringSpinFollow` 1) | its light from infall (`ringFeed`): a real ring is hot matter's light squeezed by the lens |
| A pair | `companionSpin` 1, `companionPrecession` 1, `companionLensDepth` 1, `companionWaveLens` 1; the waves' shape | the waves' size (`companionWaves`) |
| Curved space | the shape of the sheet's well and the grid's pull: the slowing of time | their size (`gridDepth`, `gridSkyPull`), a diagram's |
| A particle's light | | its speed on the screen: a drawing rule, so the eye reads motion |

The field on nature's values alone, `threeD`, `gravityInertia` 1, `gravityFalloff` 2, `orbitalStrength` 0,
`gravityReach` 200 and a flight, shows what gravity does to a stream of matter flying past a hole: the
streams bend toward it, the near ones swing round it, and behind it they cross into a narrow wake,
gravitational focusing (seen in a tracer at `gravityStrength` 6, 8 s of warm-up). No disc forms, as none
would in nature: a disc needs angular momentum, and a straight flight brings none. A disc in this scene is
Orbital Force (the stand-in), a flow (matter told where to go) or the orbiting stars, which keep their own
speed and angular momentum as bodies do.

## 2. The flight: the particle field

Gate: `fieldEnabled` on, and particles that move on the screen: `baseSpeed` above 0, or gravity moving
them (section 3). A particle that does not move draws nothing. The field is a grown look: its trails show
after about a second of warm-up, its falls, rings and long exposures after several (section 3 says which).

What a particle does: it is born at the far end of the field, `farZ` deep, in a disc of `spawnRadius`
round the point `fieldAtHole` sets, and flies straight toward the camera at `baseSpeed`, each at its own
share of it (`speedVariance`; high values add a few very fast streaks). It is reborn at the far end when it
passes the camera or crosses a horizon (section 4). Only the holes bend its path (sections 3 and 4). Each
frame it draws a stroke, a round-capped line from where it was seen last frame to where it is seen now,
stamped as the brighter of two, so strokes never add up. Seen straight on, the flight streams outward from
the point the field flies out of, fastest near the camera and toward the frame's edges.

**Brightness is the particle's own speed on the screen**, its move per 60 Hz frame: it is lit by
speed / (speed + `speedGlowKnee`), raised to `speedGlow`. This is the gate most often missed:

- A particle that stands still draws nothing, at any brightness setting.
- `baseSpeed` 0 leaves lit only what gravity moves: the field goes dark and the hole draws with its own
  pull, brightest where the fall is fastest, close to the shadow.
- A 3D camera that turns or moves streaks the trails (each stroke starts where the particle was seen last
  frame) and lights nothing: the light comes from the particle's own move, seen through this frame's
  camera.
- Far particles move slowly on the screen, so they are dim: lower `speedGlowKnee` to light a slow flight
  and the far field, raise it to keep only the streaks near the camera. `speedGlow` 0 lights every moving
  particle in full; high values leave only the fast ones.

Predict a stroke from the knobs: its direction is the particle's move on the screen (out from the point
ahead, bent toward the hole by the pull, round it by the swirl), its length that move per frame, its tail
the trails that stay (`trailIntensity`), its brightness the speed.

| What | Keys |
|---|---|
| How many, how deep, how wide | `numParticles`, `farZ`, `spawnRadius` |
| What point it is born around | `fieldAtHole` |
| How fast | `baseSpeed`, `speedVariance` |
| What a particle looks like | `particleSize`, `particleSizeMin`, `trailIntensity`, `speedGlow`, `speedGlowKnee`, `baseBrightness` |
| How depth changes it | `depthFade`, `minOpacity`, `maxOpacity` |
| Twinkle | `pulseIntensity`, `pulseSpeedMultiplier` |
| Colours | `colorPalette`, `backgroundR`, `backgroundG`, `backgroundB` |
| The tint of a fast flight: its colours ahead, at the edges and behind, where one gives way to the other, how much, from what speed | `flightTintAhead`, `flightTintEdge`, `flightTintBehind`, `flightTintGradient`, `flightTintLimit`, `flightTintFrom`, `flightTintFull` |

- A particle thins with distance from `particleSize` down to `particleSizeMin`, and `depthFade` dims it
  with distance between `minOpacity` and `maxOpacity`. Raise the size floor to the size and the field is
  strokes of one width, a flat graphic look, and the far end of the field stays visible; at 0 the far
  field thins away. This matters wherever the hole has taken particles: they are reborn at the far end,
  where at the default floor they are hairlines.
- The trail is the fade of the picture, not part of the particle. `trailIntensity` 0 never fades: a long
  exposure, every stroke a particle has drawn kept. With `baseSpeed` 0 beside it the frame is the map of
  the hole's pull, drawn over seconds.
- Gravity keeps its strength at any flight speed: a slow flight shows the same pull, and at `baseSpeed` 0
  the particles gravity moves stay lit.
- The field is born round the centre of the frame and flies out of it. A hole placed off the centre is
  then fed from the side with more frame: what falls in gathers on one side, and a swirl winds that side
  round. `fieldAtHole` 1 centres the field on the hole: matter comes in from every side alike, and a hole
  moved along a track carries its field with it.
- `colorPalette` is an array of colours with shares; a particle takes its colour at birth, so a new palette
  arrives as particles are recycled. Set it at the start; the background channels move along tracks.
- The tint of a fast flight (the `doppler` layer) is the Doppler shift of light met head-on and from the
  side: `flightTintAhead` round the point the field flies out of, `flightTintEdge` toward the edges. Its
  gate is the flight speed: it begins at `flightTintFrom`, which at the defaults lies above `baseSpeed`,
  so lower `flightTintFrom` to tint a slow flight; it is whole at `flightTintFull`. `flightTintGradient`
  places the turn between the two colours (at 1 and below the whole frame is the colour ahead) and
  `flightTintLimit` how much of a particle's own colour the tint replaces (at 1 a fast flight is two flat
  colours). In 3D the point ahead is where the line of flight is seen: it leaves the frame as the camera
  turns, a column seen from the side takes the edge colour, and past a quarter turn off the flight the
  edge colour turns toward `flightTintBehind`, whole straight behind. Its default is a copy of
  `flightTintEdge`'s, so setting one means setting both: set it apart to mark what the flight leaves
  behind, or set it to the new edge colour to keep the two alike. The flat mode always looks ahead. The
  tint colours move along tracks.
- `numParticles` is exact on the page and in a film: the graphics card steps and draws them all.
- `fieldEnabled` false takes the field away, and the flows, the grids, the stars and the lens are the
  whole scene. Turned on again, the field is made anew at every depth.

### Flows: matter told where to go

Gate: `flowA` above 0 with `flowACount` above 0 (and the same for B and C). A flow is a said look: whole in
the first frame it is asked for, so a flow that comes in mid-film is its brightness on a track.

The field is left to its laws and its look grows; a flow is told where to go: a band of particles round
the hole that appear at one radius, leave at another and turn as they go. Three stand in a scene at once,
A, B and C, beside the field or without it.

What a flow's particle does: it appears at a radius in the band round `flowAFrom`, travels to `flowATo` in
`flowALife` seconds along the path `flowAFall` gives, turning at `flowASwirl` as `flowAFalloff` thins it
outward, then appears again elsewhere in the band. Its place is worked out from its clock, so gravity,
inertia, the spin's drag, the horizon and the second hole leave it on its path; the lens bends it as it
bends everything behind the hole, and `gridRide` lays it on the sheet. Its stroke is the stretch of that
same path behind it (`flowATrail`), lit by the flow's brightness rather than by its speed.

| What | Keys |
|---|---|
| A flow's brightness (0 is off) and how many particles it holds | `flowA`, `flowACount` |
| Where its matter appears, where it leaves, how wide the band is, in radii | `flowAFrom`, `flowATo`, `flowASpread` |
| How fast it turns (the sign is the direction), and the seconds a particle takes | `flowASwirl`, `flowALife` |
| Its look: seconds of trail, stroke width, colour | `flowATrail`, `flowASize`, `flowAColor` |
| Which hole of a pair it turns round | `flowAPair` |
| How far it tips out of the hole's equator, and which side comes up | `flowATilt`, `flowANode` |
| How thick the disc is: half its height as a share of the radius | `flowAThick` |
| The path's law: the power of the radius that runs evenly, the power the turn falls with | `flowAFall`, `flowAFalloff` |
| How far its plane turns from the equator to face the camera | `flowAFace` |
| The disc's shape: how its height grows with the radius, how far its heights are a bell | `flowAFlare`, `flowABell` |
| The second flow, the same | `flowB`, `flowBCount`, `flowBFrom`, `flowBTo`, `flowBSpread`, `flowBSwirl`, `flowBLife`, `flowBTrail`, `flowBSize`, `flowBPair`, `flowBTilt`, `flowBNode`, `flowBThick`, `flowBFall`, `flowBFalloff`, `flowBFace`, `flowBFlare`, `flowBBell`, `flowBColor` |
| The third | `flowC`, `flowCCount`, `flowCFrom`, `flowCTo`, `flowCSpread`, `flowCSwirl`, `flowCLife`, `flowCTrail`, `flowCSize`, `flowCPair`, `flowCTilt`, `flowCNode`, `flowCThick`, `flowCFall`, `flowCFalloff`, `flowCFace`, `flowCFlare`, `flowCBell`, `flowCColor` |
| Shared by all three: round a pair, how far a flow lies in the pair's orbit | `flowPairPlane` |
| Shared: how a particle draws its share of the height and its orbit's phase, and whether anew each life | `flowLiftPower`, `flowPhaseSpread`, `flowLiftRenew` |
| Shared: the shares of a life to appear and to leave, the dimmest particle, the trail's dimming | `flowFadeIn`, `flowFadeOut`, `flowDimmest`, `flowTrailFade` |
| Shared: in 3D, the shares of the hole's distance a stroke fades from and is gone at | `flowNearFade`, `flowNearGone` |
| Shared: which set of numbers the particles start from | `flowSeed` |
| Shared: the light a flow falling in leaves in the ring, and how unevenly round | `flowRingFeed`, `flowRingFlicker` |
| The flows in the equator as an accretion disc seen along the paths of light: how much of them, how much it hides, its Doppler shift as a multiple of nature's, the power of the shift its brightness goes as, how far a doubling of the shift turns its colour | `flowTrace`, `flowTraceHide`, `flowTraceDoppler`, `flowTraceBeam`, `flowTraceTint` |

- The two radii are the shape: `flowATo` equal to `flowAFrom` is a ring (a disc with a wide
  `flowASpread`), below it a fall, below 1 a fall into the shadow, above it an outflow. `flowASwirl` with
  a fall winds the matter into a spiral that tightens toward the hole; 0 is a straight fall.
- The radii and the band reach 200: at the default `blackHoleSize` 8 the frame's sides are about 11 radii
  out, and round the smallest hole (0.5) its corners about 200, so a disc much wider than the hole is a
  small hole with a large `flowAFrom` and `flowASpread`.
- `flowASwirl` is the turn rate at one radius whatever `flowAFalloff` says, so a falloff below Kepler's
  speeds up a flow that lies far out: lower `flowASwirl` with it. A falloff of 0 turns the flow as a
  wheel, and a spiral's arms stop winding up. A ring has no fall, so `flowAFall` leaves it alone.
- `flowALife` changes how fast the particles go and never where they are; a long life on a ring is a
  steady ring, a short one twinkles. `flowACount` adds and takes particles at once, wherever they are in
  their lives. Every number of a flow moves along a track.
- The flows lie in the main hole's equator, the plane a real disc settles into: face on in the flat mode;
  in 3D facing the spin's axis as far as `orbitalSpinFollow` turns the swirl there, turned by the camera
  (`threeD` with `cameraPitch` 60 is a disc seen from above its rim). The 3D camera stands at the distance
  section 11 gives, so a flow wider than that passes it: strokes nearer than `flowNearFade` of the hole's
  distance fade and are gone at `flowNearGone`. Lower both to let a flow sweep past the camera in long
  strokes; a near gone far below 0.1 lets one stroke cross the whole frame.
- `flowATilt` tips a flow about a line through the hole, keeping its radii, and `flowANode` picks the
  side that comes up: 90 is a stream over the poles, and two flows at different tilts are two discs
  crossing at the hole. `flowAFace` turns the plane to face the camera before the tilt, so at 1 a ring
  stays a circle on the screen whatever the 3D camera does; the flat mode already sees it face on.
- `flowAThick` makes a disc of orbits each tipped a little, so a thick disc seen edge-on is a band and
  face on looks the same as a thin one. `flowAFlare` grows the height outward: far from 1 on a wide band
  the far edge grows tall fast, so lower `flowAThick` with it. `flowABell` softens the faces into a
  Gaussian; `flowLiftPower`, `flowPhaseSpread` (0: a fan of planes, thin along one line) and
  `flowLiftRenew` (0: each particle keeps its height through its lives) shape the same draw for all three.
- The lens bends a flow as it bends everything behind the hole: a ring shows farther out than its radius
  says and again, mirrored, inside the Einstein ring. `lensingEnabled` false draws it where it was set.
- A flow's light is its brightness alone; `speedGlow`, `baseBrightness` and `trailIntensity` belong to the
  field. Strokes keep the brighter of two, so many particles in a narrow band merge into one flat band:
  for streaks, fewer and thinner. `flowDimmest` low gives a grain of bright and faint.
- A long `flowFadeOut` lets a fall dim before the hole; 0 cuts it off sharp at `flowATo`. `flowFadeIn` is
  the same at the start.
- A flow's trail is a line in the scene, so a moving camera leaves it sharp. `flowTrailFade` 0 keeps it as
  bright as its head; higher leaves a short bright head.
- `flowSeed` above 0 picks another set of starting places, the same each time it is named, whatever the
  film's seed; no flow's shape changes.
- `gridRide` lays the flows on the sheet from their places in the scene: a flow in the equator lies on it
  whole, a ring round the mouth of the well and a fall down its wall, from the first frame. The sheet's
  setup is films.md, section 16.
- A flow round the main hole (`flowAPair` -1) whose `flowATo` lies inside `horizonScale` lights the photon
  ring while `ringFeedEnabled` is on: each particle leaves what a captured particle of the field does
  (`ringFeedCapture`), times `flowRingFeed`, shared round unevenly by `flowRingFlicker`. A dense, fast
  flow fills the ring; `flowRingFeed` 0 lets the flows fall in dark while the field still lights it.
- With a second black hole `flowAPair` says what the flow turns round: the main hole, the pair's centre (a
  ring wider than `companionDistance` there is a disc round both) or the second hole, in whose radii it is
  then measured. `flowPairPlane` leans such a flow into the pair's orbit, where a disc round both settles.
  A flow follows its own path past the second hole: matter torn from one hole to the other is two flows,
  or the field.
- Without a black hole a flow takes `gridLatticeUnit` for its radius.
- `flowTrace` turns the flows of the equator into a traced disc: each flow round the main hole with Tilt 0
  and not on the sheet (`gridRide` 0) is drawn into a map of the equator instead of onto the screen, and
  the Ray Traced lens reads it where each pixel's ray crosses the equator, up to three times, nearest
  first. So the disc behind the hole is lifted into an arch over the shadow, the near side crosses in
  front of the shadow (a ray that falls in still meets it on its way), the underside shows as a smaller
  arc under the shadow, and the next picture hugs the shadow as a thin ring. Every flow key keeps its
  meaning; between 0 and 1 the strokes fade as the traced disc comes in. `flowTraceHide` is how much of
  what lies behind a stroke the disc hides, times the stroke's own coverage: 1 an opaque disc, 0 light
  added, as strokes do. `flowTraceDoppler` raises the shift g of a circular orbit at nature's speed (and
  the climb out of the well) to its power, and the side turning toward the camera is the bright one.
  `flowTraceBeam` is the power of g the brightness goes as: 4 is nature's for the whole light of a
  surface, 0 leaves both sides equally bright. `flowTraceTint` is how far each doubling of g turns the
  colour toward `ringColorApproaching` and `ringColorReceding`: 1 turns it wholly at twice or half, 0
  keeps a flow its own colour. The disc turns the way its brightest flow does, and flows that turn the
  other way are shifted as if they turned with it. It needs `lensingTraced` and the lens on; without
  them, and for a tilted flow (`flowATilt` or `flowAFace` above 0), a flow round the second hole
  (`flowAPair` above -1 with a second hole) or one on the sheet, the flows are drawn as strokes. The
  disc lies over everything the lens shows, the photon ring's line too; the 3D layer in front of the
  holes is laid over it. A second hole's lens does not bend it. A spinning hole's disc is traced as if the hole did not
  spin (its shadow's outline does not match it exactly), and with spin and `orbitalSpinFollow` the
  equator itself turns to face the spin's axis. Flat, the equator faces the camera and the disc is a
  face-on ring with the lens's mirrored copy. `flowAThick` does not reach the map: a traced disc is flat.
  A disc of the recipe in films.md, section 16, is NASA's picture.

## 3. Gravity on the particles

Gate: `gravityStrength` away from 0 (the swirl too: Orbital Force is a share of the pull, so at 0 nothing
swirls), a particle within `gravityReach` radii of a hole, and in the flat mode inside the layer
`gravityDepth` round `blackHoleDepth`; the `gravity` layer shown. Speed that lasts (rings, slingshots,
bent paths) needs `gravityInertia` above 0 and is grown: give it 5 to 10 s of warm-up.

What a particle does: in every frame it spends within reach it is pushed toward the hole by the pull and
sideways by the swirl, `orbitalStrength`, a fixed share of the pull at every distance (its sign the
direction). The ratio of the two is the angle of its path: a high ratio circles the hole, a low one falls
straight in. Without inertia the push is a displacement for that frame only, so the field is dented, bent
toward and round the hole, and runs straight again where it leaves the reach. With inertia the push
becomes speed, and the particle falls, swings and flies on as a body does.

| What | Keys |
|---|---|
| Pull towards the hole (negative pushes away) | `gravityStrength` |
| Sideways force that makes them swirl (the sign is the direction), and in 3D how far its axis follows the hole's spin and along what curve of the spin | `orbitalStrength`, `orbitalSpinFollow`, `orbitalSpinFollowCurve` |
| How much of the speed gravity gives them they keep | `gravityInertia` |
| How far it reaches, in radii, and the power of the distance it falls by | `gravityReach`, `gravityFalloff` |
| Where the hole sits in depth, how thick a layer it pulls, and how softly that layer fades | `blackHoleDepth`, `gravityDepth`, `gravityDepthBell` |

- Flat and 3D are two laws. The flat mode works the pull out on the screen: the distance is where the
  particle is seen from the hole, the reach a circle on the screen, and only the layer round
  `blackHoleDepth` is pulled, `gravityDepth` thick and fading by `gravityDepthBell`, ending at twice
  `gravityDepth`; the swirl turns about the line of sight. In 3D (`threeD`) the hole is a point in space:
  the distance is true, the reach a sphere of `gravityReach`, the swirl turns about the line of flight or
  the spin's axis. Flat only: `gravityDepth`, `gravityDepthBell`, `frameDragSweep`, `frameDragSight`. 3D
  only: `orbitalSpinFollow`, `orbitalSpinFollowCurve`. Both: the rest.
- `gravityInertia` is the share of the speed the holes gave a particle that it keeps every 60th of a
  second. Under a steady push its speed builds to 1 / (1 - inertia) times the classic displacement: ten
  times at 0.9. So a falling particle hurries as it nears the hole, and one passing close with the swirl's
  sideways speed swings round instead of falling in: near passes close into orbits and a turning ring
  gathers round the shadow, while those that swing out leave and the field outside thins. At 1 nothing is
  lost: free fall, slingshots, straight streaks after bent paths. Raising it strengthens the hole's hold,
  so a strong pull with high inertia drains the field into the horizon. Orbital Force, the spin's drag and
  the second black hole add to that speed too. In the flat mode the kept speed lies in the screen (and in
  depth only through `frameDragSight`); in 3D along all three axes. Orbits that last are the orbiting
  stars (section 7).
- Where that ring stands follows from the step itself. A particle circles where the swirl's push, kept
  frame after frame, makes a speed whose turn the pull can hold: with the pull g = 0.6 `gravityStrength`
  (R / r)^n CSS pixels a frame at r (R the shadow's radius in CSS pixels, n `gravityFalloff`), the swirl
  k = `orbitalStrength` / 50 times it and i the inertia, its speed is g k / (1 - i) and it turns by
  (1 - i) / k a frame, so r / R = (0.6 `gravityStrength` k^2 / ((1 - i)^2 R))^(1 / (1 + n)). That is the
  ring's outer edge, the particles at the hole's own depth; those off it feel the layer's weaker pull and
  circle a little closer in, so the ring is a band inside that edge. At `gravityStrength` 5,
  `orbitalStrength` 90 and the default size in a 720p frame (R 58 px) it gives 1.96, 2.98 and 4.07 radii
  at inertia 0.85, 0.92 and 0.95, and the tracers' outer edges stood at 1.7, 2.75 and 3.85. The ring
  widens as the cube root of the pull and as (1 / (1 - i))^(2/3), and it tightens as the cube root of the
  shadow's size in pixels: the same settings close a 1080p film's ring about 13% nearer the shadow, in
  radii, than a 720p tracer's. A ring inside `horizonScale` is taken, and one beyond `gravityReach` never
  forms.
- In the flat mode a layer of half the field or more pulls everything, which makes long-exposure knots
  dense; with a moving field and a strong pull the same layer drains the field and the frame goes nearly
  empty.
- `gravityFalloff` is the power of the distance the pull falls by, at the same strength at one radius: 2
  is Newton's inverse square. Lower reaches farther with the same pull at the shadow, so the whole field
  within `gravityReach` bends toward the hole and the reach shows as an edge, where a still strong pull
  stops; a long exposure draws wide, open knots. Higher leaves the field straight and digs a tight funnel
  at the shadow, which feeds the ring hard. The second hole falls by the same power, and the spin's drag
  `frameDragFalloff` powers faster.
- `gravityDepthBell` (flat) is the shape of the pulled layer, (1 - u² / 4) to its power: soft by default;
  0 a slab with hard faces, where a particle's stroke kinks as it enters; high values a thin sheet at
  `blackHoleDepth`, which catches less of a moving field.
- `orbitalSpinFollow` (3D) turns the swirl's axis from the line of flight to the spin's axis as it stands
  in the scene, by its share times the spin (as a share of the fastest) raised to
  `orbitalSpinFollowCurve`: at 1 the share grows evenly with the spin, below 1 a slow spin already tips
  the disc most of the way, above 1 only a fast spin does. A tilted, fast-spinning hole then winds a
  tilted disc. The flows, the orbiting stars' birth plane and Particles on Sheet lie in the plane facing
  that axis, so they tip with it.

## 4. Capture: the event horizon

Gate: `horizonScale` above 0, and something reaching it: gravity pulling the field in, a flow whose
`flowATo` lies inside, an orbiting star diving in.

What a particle does: crossing the horizon, it is taken, its light goes to the photon ring (section 6),
and it is reborn at the far end of the field. In the flat mode it is taken when it is seen inside the
capture circle, at any depth, since a particle that covers the hole has fallen in as far as the picture
shows; in 3D the horizon is a sphere, so fewer fall in.

`horizonScale` is the radius of no return in radii.

- 1 is the edge of the shadow, where a real black hole captures light. Above 1 things vanish before they
  reach the shadow; below 1 inside it.
- Growing it over a film swallows the orbiting stars one by one, each with a flare on the ring.
- What the hole takes comes back at the far end of the field, where the flat layer no longer pulls it and
  the default size floor draws it as a hairline. So at `baseSpeed` 0 the hole uses its surroundings up
  over the warm-up: the well and the ring dim as the field drains. `gravityDepth` 100 with
  `particleSizeMin` raised to `particleSize` keeps the whole field pulled and visible.

### Spin: a hole that turns (Kerr)

Gate: `blackHoleSpin` above 0. The shadow's flattened side needs `spinTilt` well away from 0° and 180°
(down the axis the shadow stays round and only the sky winds); the particles' drag needs `gravityStrength`
and `frameDrag` above 0 and particles within a few radii; the sky's lean needs `lensingTraced`.

| What | Keys |
|---|---|
| How fast it turns | `blackHoleSpin` |
| Angle of its axis to the camera: 0° down the axis, 90° side-on | `spinTilt` |
| Which way the axis points on screen, from up toward the left | `spinAxis` |
| How hard the spin carries the particles round, × what the spin itself gives | `frameDrag` |
| How hard spin lying in the screen sweeps near and far particles apart, × the swirl | `frameDragSweep` |
| How hard it carries the two sides of its axis toward and away from the camera (flat mode) | `frameDragSight` |
| How many powers of the distance faster than the pull the drag fades | `frameDragFalloff` |

- Spin reshapes the shadow under either lens: the side turning toward the camera flattens and the shadow
  shifts the other way, the photon ring along the outline, and particles are captured on the circle that
  fits it. `blackHoleSize` stays the mass, so a spinning hole's shadow is a little smaller. The ergosphere,
  where nothing can stand still against the spin, lies within the shadow as seen from outside, so no knob
  draws it; the horizon grid (section 9) paints the horizon itself there.
- Under `lensingTraced` the light itself is followed round a Kerr hole: the sky is dragged round and the
  rings inside the Einstein ring lean to one side. The stylized lens stays round.
- What a particle does near a spinning hole: space there turns about the spin's axis (frame dragging) and
  carries it round. At one radius the drag is half the pull times the spin, and it fades one power of the
  distance faster than the pull, so it lives within two or three radii of the shadow, where the hole is
  also taking the particles.
- Where the real drag (`frameDrag` 1) reads: the default `orbitalStrength` already swirls every particle at
  a larger share of the pull than the drag reaches anywhere, so the drag is hidden under it. For the drag
  alone, `orbitalStrength` 0, `baseSpeed` 0 and a zoom (`cameraZoom` 3) onto those few radii; a
  `gravityInertia` near 0.8 lets the turn add up frame to frame into a visible spiral; and only the share
  of spin toward the camera swirls on the screen, so a hole seen nearly side-on (the default `spinTilt`)
  swirls little. To read the drag at a zoom of 1 with the field flying, raise it: `frameDrag` about 4
  winds a vortex round the shadow, `frameDragFalloff` 0 lets it reach as far as the pull, a spiral
  several radii wide, and about 12 holds a bright ring of particles circling the hole before they fall.
  `frameDrag` 0 keeps the shadow, the lens and the stars' swing and lets the particles fall straight.
- The flat mode's drag is the 3D turn split into what the screen shows. The share of the axis along the
  line of sight turns particles in the screen: a swirl, anticlockwise for a spin toward the camera,
  clockwise away, added to `orbitalStrength`. The share lying in the screen turns space about an axis in
  the screen, which does two things: it moves particles across the axis by their depth off the hole,
  those nearer one way and those beyond the other, so their trails cross above and below a side-on hole
  (the sweep, measured in the thickness of the gravity layer rather than in true distance, which is why
  `frameDragSweep` scales it); and it carries one side of the axis toward the camera and the other away
  (`frameDragSight`, which at 1 is exactly that turn's depth part), so on one side the particles fly
  faster and streak brighter and on the other they slow and dim; with `frameDrag` raised the field splits
  round the shadow into a bright and a dark half. The sight push rides on `frameDrag` × `frameDragSweep`,
  and under `gravityInertia` it is kept as speed in depth; a spinning second hole (`companionOwnSpin`)
  carries its own two sides the same way. Under `threeD` the axis stands in space and the
  drag is the real turn round it, so the sweep and the sight are the turn itself and their two knobs give
  way.
- `frameDragFalloff` sets the vortex's width: at 1 `frameDrag` makes it stronger, never wider; 0 lets it
  reach as far as the pull (`gravityFalloff`); 2 and above hold it to a skin round the shadow. Both modes,
  both holes.
- The orbiting stars feel the spin (Lense-Thirring) about its axis as it stands in the scene, at any
  `spinTilt`: a tipped orbit's plane turns about that axis, on its own multiple `orbitDrag` (section 7).
- Two holes that merge leave one spinning about the axis of their orbit, which takes over as the shadows
  join, and keeps each hole's own spin (`blackHoleSpin`, `companionOwnSpin`) by the square of its share of
  the mass (section 8).
- The ring's bright side: `ringSpinFollow` 1 takes the side and the contrast from the spin as the camera
  sees it, so the tilt, the axis, every move of the 3D camera and a merger's spin keep the ring right with
  no track for it. At 0, the default, `ringSide` and `ringDoppler` are what is set, and a film drives them
  along the tilt (films.md, section 10): the approaching side lies at 180° plus `spinAxis`, and the
  contrast a real hole shows grows as the sine of `spinTilt`. A hole without spin keeps the settings.
  Under Follow Spin the contrast is still `ringDoppler` times that sine: at the default 0.2 the ring of a
  fast-spinning hole stays nearly even, and about 0.9 shows a bright and a dim side. Raised from the start
  of a film it lights the sides of holes that do not spin yet, so a merger raises it along a track.
- The `Kerr` preset is the `Schwarzschild` preset (section 15 says what that sets) spinning near its
  fastest, seen nearly side-on, with the ring's bright side on the flat side.

## 5. The lens: how light bends

Gate: `lensingEnabled` on and `lensingRadius` above 0, with something behind the hole to bend: `gridSky`,
the stars, the nebula, the field. The stylized keys act only with `lensingTraced` false.

The lens bends the finished picture (particles, stars, grids), not the particles' paths.

So the particles are seen as if they lay behind the hole. Matter that falls to the shadow is drawn where
the lens shows light from just behind it: pushed out to the Einstein ring and mirrored inside it, with a
dark band between the ring and the shadow where the rays come from far behind. A fall or a ring that
should reach the shadow's edge is drawn with `lensingEnabled` false (or under the 3D front layers, section
11, for what stands in front). With the lens on, the band is the lens's own picture and reads as one.

| What | Keys |
|---|---|
| On or off | `lensingEnabled` |
| Exact light paths (ray traced) or the stylized lens | `lensingTraced` |
| Size of the Einstein ring, in radii, or how much of it the scene's own camera sets | `lensingRadius`, `lensingFromCamera` |
| Shape outside the ring: 0 a compact bubble, 1 a point mass | `lensingReach` |
| The bubble's shape: the power of the pull whose cosine scales the picture | `lensingBubble` |
| How the pull changes with distance, and where that changes nothing | `lensingFalloff`, `lensingPivot` |
| What shows inside the ring | `lensingMaxBend`, `lensingCore` |
| Swirl of the sky | `lensingRotation`, `lensingTwistLimit` |
| Dark zone around the shadow | `lensingAbsorption` |

- `lensingTraced` true, the default, follows every pixel's ray round the hole (a Kerr one when it spins):
  the Einstein ring, the mirrored image inside it and the thin photon rings come from the physics, and
  `lensingRadius` (where the camera stands) and `lensingAbsorption` are its only knobs. The other lens keys
  shape the stylized lens; a film that moves them under the traced lens gets a note saying so.
- The physically faithful setup is the `Schwarzschild` preset: no light taken from round the shadow,
  capture at the shadow's edge, no swirl of the particles, and a point mass for its stylized keys.
  `Default` traces the lens too and tunes the rest for the look.
- For a real hole `lensingRadius` says how far away the camera is (describe gives the conversion): a near
  camera sees a small ring and a very wide field around the hole, a far one a wide ring. Its top, 30, is
  about 3 000 Schwarzschild radii, the farthest the traced lens of a hole that does not spin draws cleanly;
  farther, the graphics card's precision breaks the sky's lines far from the hole into dots.
- A ring wider than the frame puts the whole frame inside it, where the sky is seen shrunk and mirrored:
  with a large `lensingRadius` keep `blackHoleSize` small (the ring is `lensingRadius` times it), or the
  lensed grid and the stars go dark across the frame. The stylized lens has no top and does the same.
- `lensingRadius` 0 turns the lens off as `lensingEnabled` false does, so a film fades the lens in with
  the number and cuts it with the switch.
- `lensingRadius` and the camera of the particles are two cameras. `lensingFromCamera` 1 makes them one:
  the lens stands where the 3D camera circles (section 11) and comes nearer as `cameraMoveIn` brings the
  camera in. A larger hole is then seen from nearer, with a smaller ring and a wider warp of the sky;
  `cameraZoom` is a longer lens and leaves the lens as it is. `lensingRadius` stays the switch.
- On a dark sky the lens shows little, and a sky of point stars alone reads as a swirled field round the
  hole. `gridSky` (section 9) shows exactly what the lens does; for the Einstein ring and its mirrored
  image in the sky itself, a nebula (`nebula` about 0.6) behind denser, larger stars (`starCell` about 14,
  `starsSize` about 2, `starsBrightness` about 2.5) draws its arcs.
- `lensingBubble` shapes the bubble that `lensingReach` 0 shows: higher keeps the warp close round the ring
  and folds more rings inside it, which `lensingMaxBend` still caps; lower spreads it over the sky. The
  ring stays where it is. The second hole's lens takes the stylized shape at `companionLensStyle` above 0.
- Under `lensingTraced` the flows of the equator can be traced too (`flowTrace`, section 2): the lens then
  reads them where each ray crosses the equator instead of as a picture behind the hole.
- `lensingAbsorption` takes light away around the shadow. When the particles next to the hole look dim,
  lower it first, before any brightness of the particles themselves.

## 6. The photon ring

Gate: `ringEnabled` on and `ringBrightness` above 0. Its light is `ringBase` plus what falls in, and the
second needs `ringFeedEnabled` and matter captured or skimming past (gravity, a falling flow, a star).

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

- The ring is fed by the simulation. A dark ring means nothing is falling in: raise `gravityStrength` for
  infall, or `ringBase` for a steady glow. 3D captures fewer particles, so its infall light is fainter.
- `ringWidthMin` is in screen pixels and `ringWidth` adds radii, so the first stays a hairline at any zoom
  and the second grows with it. `ringOffset` moves the line off the shadow's edge (at 0 the shadow hides
  its inner half), and `ringSoftness` turns a hard hairline into a soft band.
- `ringGlow` scales the whole glow; the four shape keys say where it lies. A wide `ringGlowSkirt` with a
  high `ringGlowSkirtShare` is a halo that fills the shadow and hazes the sky; both shares at 0 leave the
  bare line whatever `ringGlow` says.
- `ringFeed` scales all infall light; the ratio of `ringFeedCapture` to `ringFeedSkim` decides whether the
  ring flashes where things go in or glows where the stream runs past. Skimming counts within
  `ringFeedReach`, never beyond `gravityReach`, and in the flat mode only inside `gravityDepth`. A
  swallowed star leaves `ringStarFlare`, spread by `ringStarSpread` with `ringStarSides` in each side:
  three points of light that the ring's flow then carries round.
- `ringDoppler` turns the bright side toward `ringColorApproaching` and the dim side toward
  `ringColorReceding` by the square of the contrast, so the tints show from about 0.5 up. The default
  approaching colour is a pale blue near white, so the bright side reads white beside the reddened dim one;
  a deeper blue shows the shift on both sides. The three colours move along tracks.
- The second hole's ring takes `ringColor`, the line and the glow, along its own outline when it spins.
  `companionRingFeed` lights it with what falls into it, as a multiple of the main ring's feed, and
  `companionRingSides` gives it the main ring's Doppler sides at that multiple (section 8).

## 7. Orbiting stars

Gate: `orbitCount` above 0. A trace needs `orbitTrail` above 0 (at 0 only the stars show); the spin's
swing needs `blackHoleSpin` and `orbitDrag` above 0.

Up to 128 stars with real velocity in space, each on a plane of its own near the hole's equator: ellipses
that precess, faster the closer they come, as around a real black hole. They circle the main hole only.

| What | Keys |
|---|---|
| How many (0 is none) | `orbitCount` |
| Shape of the orbits | `orbitSize`, `orbitEccentricity` |
| Rate of their time; the sign is the direction | `orbitSpeed` |
| How long a trace stays lit, and its width | `orbitTrail`, `orbitStarSize` |
| How much the orbits differ from the size and the stretch set | `orbitSizeSpread`, `orbitEccentricitySpread` |
| The widest an orbit's plane is tipped out of the hole's equator | `orbitInclination` |
| How the tilts are drawn up to it, and the arc of the equator the orbits are tipped about | `orbitTiltSky`, `orbitNodeSpread` |
| The share of stars born going round the other way | `orbitRetrograde` |
| The closest a new orbit comes, and how far out a star counts as gone, in Schwarzschild radii | `orbitClosest`, `orbitEscape` |
| How hard the spin swings the orbits, × what the spin itself gives | `orbitDrag` |
| Seconds a new star takes to light up | `orbitFadeIn` |

- The hold ease: `orbitSize`, `orbitEccentricity`, `orbitSizeSpread`, `orbitEccentricitySpread`,
  `orbitInclination`, `orbitTiltSky`, `orbitNodeSpread`, `orbitRetrograde` and `orbitClosest` make every
  orbit anew when they change, and `orbitCount` arrives in whole stars. Set them at the start, or step
  them along a track with the hold ease on the key each value arrives at.
- A star is born in the equator (across the line of flight while the hole does not spin; in 3D facing the
  swirl's axis, which `orbitalSpinFollow` turns toward the spin's) and tipped out of it by up to
  `orbitInclination` about a direction of its own: 0 is a flat disc of rosettes, seen edge-on from the side
  (`cameraYaw` 90 with a still hole); 90 a ball of orbits. The flat mode sees them straight on, where a
  tipped orbit is only a narrower ellipse.
- `orbitTiltSky` 1 draws the tilts as stars come from every direction, so steep orbits win; it matters
  above a small `orbitInclination`. `orbitNodeSpread` low tips every orbit about nearly one line: the
  planes fan out like a book's pages and the disc warps to one side, a fan rather than a ball.
- After its birth a star is moved by its motion alone: an equator that turns later leaves the orbits where
  they are, and a spin axis that turns later precesses them about where it now stands.
- Both spreads at 0 put every star on the same ellipse, turned differently: a clean rosette.
- No orbit lasts inside 3 Schwarzschild radii, so an `orbitSize` below about 2.5 radii loses most stars.
  A low `orbitClosest` with a high `orbitEccentricity` feeds stars to the ring; a high one keeps them all
  clear. A low `orbitEscape` replaces a flung star while it is still in the frame.
- `orbitDrag` is the stars' own multiple of the spin's field and leaves `frameDrag`, the particles', alone.
  The spin turns each tipped plane about its axis and the orbit within its plane, and a star moving with
  the hole's turn is pushed out, one against it pulled in. At 1 the turn is slow; raised, the planes and
  rosettes turn faster and the closest stars are thrown in or out. With `orbitRetrograde` above 0 the
  stars going against the turn feed the ring sooner.
- A long `orbitTrail` over several turns draws the rosette of the precession. The traces are lines kept
  around the hole, so they follow it, grow with `blackHoleSize` and stay sharp at any zoom.

## 8. A second black hole and its waves

Gate: `companionSize` above 0, with a main hole. Its waves need `companionWaves` above 0 and something to
stretch: the sheet (`gridSheet`, with `gridWaveLift` above 0), `gridSky`, the stars or the nebula; the
particles alone barely show them. The plane's precession needs a spin on either hole and
`companionPrecession` above 0.

| What | Keys |
|---|---|
| The companion's radius, as a share of the main one (0 is none, above 1 the heavier of the two); its mass is its size | `companionSize` |
| Gap between the centres, in main hole radii | `companionDistance` |
| Rate of the pair's time; the sign is the direction | `companionSpeed` |
| Strength of the spiral gravitational wave of the pair | `companionWaves` |
| The plane the two circle in: its tilt from the plane across the line of flight, and the side of the screen it tips away from the camera | `companionTilt`, `companionNode` |
| Where the closing pair stops speeding up, as a share of touching | `companionClosest` |
| What a merger leaves: its spin × the real one, its oval × the opening's, the wobbles its ringing takes to take over the wave | `companionSpin`, `companionOval`, `companionHandover` |
| The second hole's own spin and its axis, as the main hole's | `companionOwnSpin`, `companionSpinTilt`, `companionSpinAxis` |
| How fast the spins and the orbit turn each other, × the real precession | `companionPrecession` |
| Its ring: lit by what falls in, × the main ring's feed; its Doppler sides, × the main ring's | `companionRingFeed`, `companionRingSides` |
| Its lens: the core it softens inside, in its shadow's radii; 0 a point mass .. 1 the stylized lens | `companionLensCore`, `companionLensStyle` |
| Two at different depths: the farther seen through the nearer's lens, and the waves, × a thin lens's share; the depth gap at which a shadow hides the other's ring, × their radii | `companionLensDepth`, `companionWaveLens`, `companionHideDepth` |
| How much of a tilted orbit's depth the flat mode draws | `companionFlatDepth` |
| The plane a hole alone rings in: its tilt, and the side it tips away | `loneTilt`, `loneNode` |

- The two turn round their common centre by Kepler's law, so closing `companionDistance` speeds them up by
  itself, and moving it from far to 0 over a film is a merger (the in ease on its last key). Inside
  `companionClosest` of touching they turn no faster: lower it and the last turns whip round. At
  `companionSpeed` 1 a turn takes many seconds, so a short film wants about 2 to show the pair circling.
- As the shadows overlap the main hole grows by the companion's mass; at 0 they are one hole, which rings
  and sends a last wave.
- The last turns, the merger and the ringing are one motion. The main hole is drawn out toward the
  companion as the shadows merge, and the oval keeps turning the way the pair did while it dies away. Its
  tone is the merged hole's own and runs on the pair's clock, so `companionSpeed` scales it while the
  opening's `ringdownPitch`, `ringdownLength` and `lightCrossTime` leave it alone.
- What a merger leaves: `ringdownAmplitude` (an intro parameter that works without the opening) times
  `companionOval` is how far the merged hole is drawn out, less for unequal masses. `companionSpin` scales
  the spin it leaves: higher flattens the merged shadow and raises and lengthens its tone; 0 leaves a still
  hole that rings lowest. `companionHandover` low leaves a seam between the spiral wave and the ringing,
  high a long blend.
- Merger strengths: `companionWaves` alone sets the wave, the spiral rising to its peak at the merger and
  the ringing after it at the same strength. On the sheet 1 sways it through a merger and 3 folds it into
  steep spiral arms. `gravityWaveGain` shapes only the opening's wave and a fired one.
- A ripple that reads all through a merger: the wave grows as the pair closes, weak while they are far
  apart and steep at the merger, so move both strengths against the approach: `companionWaves` 3 and
  `gridWaveLift` 30 while `companionDistance` leaves 6, down to 1.6 and 11 as it reaches 0. Held high to
  the end, the sheet round the merger breaks into spikes. Frame it wide and plain: `blackHoleSize` 3.5,
  square cells (`gridCell` 3, `gridRings` 0), `gridTilt` 60, no particles
  (`films/fourth_dimension_ripple.js`).
- A wave comes from something that moved: fire `ringdown` or `gravityWave` where a pair has just merged or
  a hole has just formed, and let a ripple in a film come from a pair closing in, ending in the ringing of
  their merger.
- A wave stretches the picture across its path, never along it, and weakens as 1 over the distance. The
  waves and the merged hole's oval lie in the pair's plane, and the camera sees the slice through the pair
  that faces it: from above the orbit a two-armed spiral, from its side rings, twice as strong along the
  orbit's axis, round a shadow that swells and shrinks along that plane.
- The pair's plane: `companionTilt` 0 is the plane across the line of flight, which the flat view looks
  straight at; 90 stands it edge-on, so the two pass in front of each other at every half turn;
  `companionNode` picks the side that tips away (0 the top: at 90 the orbit is a horizontal line). With a
  spin on either hole the plane precesses; without one it stays where it is set.
- A hole alone (the opening's ringing, a fired `ringdown` or `gravityWave` with `companionSize` 0) rings in
  the plane `loneTilt` and `loneNode` set. A film that removes the second hole after a merger and keeps the
  ringing in the orbit's plane sets these two to the pair's tilt and node.
- The two holes stand at their own depths, so seen along the orbit's plane one passes in front of the
  other: the nearer one's lens bends the farther, which is seen pushed out round it, and its shadow hides
  the farther ring behind it. `companionLensDepth` and `companionWaveLens` are small at 1 unless the orbit
  stands deep; 5 to 20 pushes the farther hole, its ring and the waves out round the nearer.
  `companionHideDepth` low covers the farther ring as soon as one hole is ahead, high lets both rings show.
- The flat mode keeps that order but draws the orbit as it lies across the screen, both holes at their own
  size; `companionFlatDepth` 1 draws it in perspective as 3D straight on does, the nearer hole larger and
  farther from the centre.
- `companionOwnSpin` spins the second hole about the axis `companionSpinTilt` and `companionSpinAxis` set:
  its shadow flattens, its ring follows the outline, `frameDrag` and `frameDragSweep` carry the particles
  near it round. As the two merge, the hole they leave keeps each own spin by the square of its share of
  the mass, beside the spin of the orbit.
- `companionPrecession` turns the orbit's plane and both spins about their total angular momentum, widest
  at close range. The real rate turns the plane once in tens of orbits, so a short film raises it many
  times over. The plane carries the waves, the oval and the merged hole's spin with it, and the main
  hole's turned spin turns its equator, so the sheet and the flows that follow the spin turn too. 0 stops
  the turn where it stands.
- `companionLensCore` lower folds the sky tighter round the second shadow. `companionLensStyle` blends its
  lens toward the main lens's stylized shape (`lensingReach`, `lensingBubble`, `lensingFalloff`,
  `lensingRotation`, `lensingMaxBend`, `lensingCore`), traced main lens or not: at 1 with `lensingReach` 0
  both holes are compact bubbles and the sky between them stays put.
- Two horizons take more of the flight than one, so over a long approach the field thins. Lower
  `gravityStrength`, or `horizonScale`, when the picture needs the particles.
- The companion has its own shadow, lens, ring, gravity and well in the sheet.

## 9. Curved space made visible: the grids and the lattice

Gate: each grid's brightness above 0 (`gridSheet`, `gridSky`, `gridLattice`, `gridHorizon`); each
subsection below gives what else its picture needs. All four share `gridColor`, and the sheet and the
lensed grid share `gridCell`.

| What | Keys |
|---|---|
| Cell size, shared by the sheet and the lensed grid | `gridCell` |
| The colour of all four, and how many times brighter the lattice draws it | `gridColor`, `gridLatticeGain` |

- `gridColor` is one colour for all four grids. The lattice draws it `gridLatticeGain` times brighter, each
  channel stopping at full, so a high gain turns the lattice white while the sheet keeps the colour.

### The sheet

Gate: `gridSheet` above 0. Its well shows with `gridDepth` above 0 and, in the flat mode, `gridTilt` 60 or
more, or `gridRings` above 0, which read the depth from straight above too; in 3D, from a camera off
straight-on (section 11).

| What | Keys |
|---|---|
| The sheet: brightness (0 is off), the angle the flat mode sees it at, depth of the well in radii | `gridSheet`, `gridTilt`, `gridDepth` |
| The sheet as rings and spokes: how many rings stand at equal steps of the well's depth (0 keeps the square cells), and the spokes across them | `gridRings`, `gridSpokes` |
| The sheet's lines: their width, the most they widen near its camera, and where they stop round a hole | `gridLine`, `gridLineNear`, `gridClearing`, `gridClearingEdge` |
| The flat mode's sheet camera: its distance, and how near it the sheet is cut off; how far the sheet reaches and the share of that it fades over | `gridDistance`, `gridNear`, `gridSpan`, `gridFade` |
| How high a gravitational wave lifts the sheet | `gridWaveLift` |
| What a pair's spiral wave turns with: 0 the line between the wells, 1 the orbit laid flat | `gridWaveOrbit` |
| The sheet's shape: where its rings stand (equal steps of depth to equal radii), the share of the well's depth it is lifted by, how far a second well reaches toward its own hole | `gridRingSpacing`, `gridLift`, `gridWell2Bottom` |
| The sheet in the picture: the share of it behind the holes drawn through the lens, and how its pose turns while 3D eases in | `gridLensed`, `gridEaseTurn` |

- The sheet is a surface of the scene: a piece of the main hole's equator (the plane matter, the flows and
  the orbiting stars follow; across the line of flight while the hole does not spin), dented where the
  hole sits and rippled by gravitational waves. The well's bottom is the hole, as a textbook draws it: the
  plane is lifted toward a camera looking down the flight by `gridDepth` radii (`gridLift` of it), and the
  funnel runs down to the shadow, its throat the shadow's edge, where the sheet ends from any side. Its
  lines stay put while the hole moves across it. In the flat mode a camera of its own sees it, tipped by
  `gridTilt`; in 3D the scene's camera sees it (section 11).
- The dent is gravitational time dilation, and a caption can say so: a place is lowered by how much time
  is slowed where the light seen at that distance passed closest to the hole. Far away the sheet is flat;
  at the shadow's edge it is `gridDepth` deep and ends.
- `gridRings` draws the sheet as a textbook does, in rings and spokes round the main hole: the rings are
  the well's contour lines, so from the side they step down the well evenly and from above they crowd
  toward the hole, where the well is steepest. 40 rings fill a 1080p frame at the default size. Half of
  them stand close round the shadow, where `gridClearing` thins them. Waves read better on square cells.
  `gridRingSpacing` 1 moves the rings to equal steps of radius: from above a target with no depth, from
  the side bunched at the bottom of the well.
- `gridLift` 1 puts the well's bottom on the hole, so a 3D camera nearer the hole than `gridDepth` along
  the flight stands on the hole's side of the sheet; at 0 the sheet runs through the hole and the funnel
  hangs below it, the textbook's ball resting on a sheet seen from the side.
- `gridWell2Bottom` 1 sinks a second hole's well exactly to where that hole stands: a hole on the sheet's
  far side digs a deep well, one on the near side none. At 0 each well is `gridDepth` of its own radii, the
  two add up, and the second well's bottom misses its hole.
- `gridLensed` draws the share of the sheet behind the holes into the layer the lens reads: its lines bend
  into an Einstein ring and the shadow covers them. The dent already places each point where light passing
  the hole is seen, so at 1 the lines are bent twice: use it for a sheet that is matter in the scene
  rather than a diagram over it, with `gridDepth` lowered.
- `gridEaseTurn` 1 turns the sheet's pose as a camera turns while 3D eases in (`threeDEase`), the plane
  flat and square; 0 squeezes it midway and slides its lines across the screen. The well's bottom stays on
  the hole either way.
- In the flat mode the sheet's own camera stands `gridDistance` from the middle of the screen: nearer
  steepens the perspective and brings a tilted sheet's horizon into the frame; far runs the lines
  parallel, as on a map. With a near camera lower `gridNear` too, or the foreground is cut off. In 3D both
  give way to the scene's camera.
- `gridSpan` is how far the sheet reaches, fading over `gridFade`; a small `gridCell` ends it sooner,
  since the sheet has 112 lines each side of the hole: below `gridCell` 3.5 the default span is cut short,
  and at the default `gridCell` 4 a span above about 2.5 adds nothing. A small span with a short fade is a
  disc of sheet round the hole.
- `gridLine` is the width where the camera looks; nearer lines widen up to `gridLineNear` times. The lines
  clear round each hole between `gridClearing` and `gridClearingEdge`; both at 0 let the sheet cross the
  shadow. In 3D a piece nearer the camera than the holes passes in front of them, uncleared.
- `gridWaveLift` scales every wave on the sheet at once (`companionWaves`, `gravityWaveGain`, a fired
  `gravityWave`) and leaves the sky alone: 0 keeps the sheet still under a rippling sky, high values raise
  steep hills of a merger (merger strengths: section 8).
- `gridWaveOrbit` matters while a pair's orbit is tilted to the sheet: at 0 the spiral follows the two
  wells as they land on the sheet and stalls where the orbit is seen edge-on; at 1 it turns at the pair's
  own even pace.

### Particles on the sheet: the vectors of space

Gate: `gridRide` above 0, and the setup of films.md, section 16, which makes the well fill and read.

| What | Keys |
|---|---|
| The share of the way the particles are moved onto the sheet (0 leaves them where they fly), and the half thickness in radii of the slab round the equator whose particles are | `gridRide`, `gridRideDepth` |
| The slab: the share it fades over, its depth on the far side, the share of the sheet's waves its particles go with, the most of a stroke cut at the near plane rather than dropped | `gridRideSoft`, `gridRideFar`, `gridRideWave`, `gridRideCut` |

- `gridRide` makes the particles the sheet's vectors: each stroke lies on the surface and shows where
  matter, or space, goes on it. What falls goes down the well's wall, what circles wraps its mouth, and from
  above the same matter is the disc round the shadow. Only where they are drawn changes; their motion is
  set as without the sheet. With `gridRide` 0 they stay in the plane of the screen and float in front of a
  tilted sheet.
- The neighbours that decide whether it reads, each for its own cause (films.md, section 16): the flat
  flight runs outward along the sheet, so `baseSpeed` 0; the lens bends the particles round the hole on the
  screen, off the surface, so `lensingEnabled` false; a tilted sheet is framed with the hole low and fills
  on one side, so `fieldAtHole` 1; what the hole took returns at the far end of the field as a hairline,
  so `particleSizeMin` raised to `particleSize` keeps the well full.
- In the flat mode `gridTilt` is the camera: tilting it streaks the trails as a camera move does. In 3D
  the particles stand on the sheet where it lies, and every move of the camera sees the two together.
  There the field's gravity ends at a sphere, so the field lines only a band round the well's mouth; a flow
  lines the wall (films.md, section 16).
- `gridRideDepth` decides which particles ride: those within it of the equator, wholly in the plane and
  fading to none at its edge (`gridRideSoft` shapes that fade, `gridRideFar` the depth behind the plane).
  The default lays the whole column on the sheet, a dusting whose streaks point into the well. A low value
  rides only the matter near the hole's depth, and the flight streams across the sheet and hides it: lower
  it only for a shot about a thin disc.
- `gridRideWave` 1 lifts the riders with the sheet's waves by `gridWaveLift`, and their motion on the
  moving surface lights them, so a ringdown sweeps a bright ring across the matter; 0 holds them on a
  still sheet while it ripples beneath them.
- `gridRideCut` 1 cuts each ridden stroke at the sheet camera's near plane, so the matter runs right up to
  the camera; 0 drops every stroke that crosses it, a ragged edge.

### The lensed grid

Gate: `gridSky` above 0, with the lens on to see it bent; `gridSkyPull` above 0 for the pull drawn in.

| What | Keys |
|---|---|
| A flat grid on the sky read through the lens (0 is off), how far it is drawn in towards the hole (0 is flat), and the width of its lines | `gridSky`, `gridSkyPull`, `gridSkyLine` |
| Where the pulled cells turn to haze, and over what share | `gridSkyHaze`, `gridSkyHazeSpan` |
| The lensed grid on the sky's box or on its sphere, and the power of the slant its lines keep their width by | `gridSkySphere`, `gridSkySlant` |

- The lensed grid is a measuring tool: it shows the Einstein ring, the mirrored image, the twist and the
  waves. Lower `baseBrightness` when it should be read clearly.
- `gridSkyPull` draws the grid in towards the hole, the classic picture of space pulled in by a mass:
  lines above the hole sag to it, lines beside it bow in, cells crowd into a haze round the shadow. The lens
  bends the grid outward on top of it, so with `lensingEnabled` false the pull shows alone, the picture of
  a well seen from above. This is the grid for a well's reach across the frame: the sheet's dent is
  short-ranged, and a dent deep enough to bend the frame's edges would lay lines over the shadow.
- Crowded cells merge into a haze below `gridSkyHaze` screen pixels. A value near a cell's size on the
  screen dissolves the grid round the shadow into a glow; at or above it the whole grid hazes, since far
  from the hole a cell is its full size.
- `gridSkySphere` moves the grid from the faces of the sky's box (straight lines that turn a corner where
  two faces meet, which a strongly bent ray, a zoom below 1 or a turning 3D camera shows) onto its sphere
  (no corners, a pole above and below). Between 0 and 1 both are drawn, so a track cross-fades them.
- `gridSkySlant` keeps the lines' width toward the frame's edges; 0 lets them widen with the sky, as a
  wide lens shows a real grid. `skyCenter` and `skySize` (section 10) place and scale the grid's box and
  sphere.

### The lattice

Gate: `gridLattice` above 0; `threeD` to see it from any side (the flat mode sees it straight on, down the
line of flight).

| What | Keys |
|---|---|
| The lattice in three dimensions: brightness (0 is off), its cell in radii, how hard it is drawn in | `gridLattice`, `gridLatticeCell`, `gridLatticeWarp` |
| Its lines and extent: their width, its reach in cells and the share of that it fades over | `gridLatticeLine`, `gridLatticeReach`, `gridLatticeFade` |
| In depth: where it fades near the camera, the share of that where a line is gone, and what it keeps far behind the hole | `gridLatticeNear`, `gridLatticeNearEdge`, `gridLatticeFar` |
| The shadow its cells are measured from while there is no black hole, as a share of the short side | `gridLatticeUnit` |

- The lattice is the sheet's law in three dimensions: lines along the scene's three axes, each node drawn
  in towards the hole by the slowing of time, never folding over. It stands still while the hole moves
  through it, and a second hole pulls it too. At the default cell the whole ball fits the default camera's
  frame; a larger cell reaches farther and passes the camera, and toward the top of `gridLatticeCell` (20)
  only a few lines cross the frame. To fill the frame with fine cells, raise `gridLatticeReach` (up to 12
  cells) rather than the cell: 12 at the default cell fills the default 3D frame, 12 at 0.5 is a fine ball
  as wide as the default one. Below a cell of 0.5 the ball shrinks into the photon ring.
- It is read through the lens: the lines behind the hole bend into its Einstein ring even at
  `gridLatticeWarp` 0, and the shadow covers them. Among a bright field lower `baseBrightness` or raise
  `gridLattice`.
- A camera inside the ball would have lines across its face: they fade from `gridLatticeNear` and are gone
  at `gridLatticeNearEdge` of that; behind the hole a line dims down to `gridLatticeFar`.
  `gridLatticeNear` low with `gridLatticeFar` 1 is a cage drawn alike near and far; `gridLatticeNear`
  above 1 leaves only the far side.
- With `blackHoleSize` 0 the lattice is a plain cage of space, its cells multiples of `gridLatticeUnit`.

### The horizon grid

Gate: `gridHorizon` above 0 and a hole. Its twist, turn and shift need `blackHoleSpin` above 0; the turn
needs `gridHorizonPace` above 0 and the shift `gridHorizonShift` above 0.

| What | Keys |
|---|---|
| A grid of latitudes and longitudes on the event horizon, seen through the shadow (0 is off), and its cells from pole to pole | `gridHorizon`, `gridHorizonCells` |
| Its turn, its lines and where crowded lines turn to haze: how much of the hole's own time passes in a second (0 holds it still), the width of its lines, the most light the haze gives | `gridHorizonPace`, `gridHorizonLine`, `gridHorizonHaze` |
| The cell sizes on the screen at which its lines start to turn to haze and are wholly haze | `gridHorizonHazeFrom`, `gridHorizonHazeTo` |
| Its cells round the equator (0 keeps them square), the shift its light takes from the horizon's turn, and its brightness on the second hole | `gridHorizonCellsAround`, `gridHorizonShift`, `gridHorizonCompanion` |

- `gridHorizon` paints the event horizon and shows it as a camera would: every ray that falls into the
  shadow is followed back to where it left the horizon, so the whole horizon fills the shadow, its near
  side in the middle and its far side wrapped round toward the edge, where the cells crowd into a haze.
  Without spin it is a globe seen through its own lens; a spinning hole drags the rays and twists the grid
  into spirals round the pole that faces the camera. Its longitudes stand in the scene, so a 3D camera
  circling the hole sees it from all sides. It is seen from the Ray Traced lens's camera (`lensingRadius`,
  `lensingFromCamera`) under either lens. The ergosphere round a spinning horizon lies within the shadow
  too, and the grid is the nearest picture of it the scene draws: the horizon it encloses.
- A spinning horizon turns, the way the particles are dragged, at the pace `gridHorizonPace` sets; light
  from the far side left earlier, which twists the grid at any pace. Caption it as the horizon's own map,
  since no light leaves a real horizon.
- `gridHorizonHazeFrom` and `gridHorizonHazeTo` raised dissolve more of the crowded rim into a glow; brought
  together, the turn is abrupt.
- A few meridians over many latitudes (`gridHorizonCellsAround` low, `gridHorizonCells` high) reads as a
  striped globe; many meridians as a comb that the spin twists.
- `gridHorizonShift` gives the lines the shift of the horizon's turn: blue and brighter on the side turning
  toward the camera, red and dimmer on the other. At 1 a fast spinner's approaching rim burns out to the
  colour's bluest channel and the far side goes dark; a share of it keeps the grid readable. It acts on the
  main hole's grid alone.
- `gridHorizonCompanion` paints the same grid on the second hole, about its own spin's axis
  (`companionOwnSpin`, `companionSpinTilt`, `companionSpinAxis`); each shadow covers the other's grid where
  they overlap.

## 10. Background stars and the sky

Gate: `starsBrightness` and `starDensity` above 0, and the `stars` layer shown.

| What | Keys |
|---|---|
| How bright, how many, how far apart | `starsBrightness`, `starDensity`, `starCell` |
| One star: its width, and the faintest as a share of the brightest | `starsSize`, `starsFaintest` |
| The two colours a star's tint lies between | `starsColorWarm`, `starsColorCool` |
| The twinkle: the share of a star's light that swings, and how fast | `starsTwinkle`, `starsTwinkleSpeed` |
| How stars fill their cells: the share of a cell a star stands in, the most stars a cell holds, the rings of neighbouring cells a star is drawn from | `starsPlacement`, `starsPerCell`, `starsNeighbors` |
| The 3D sky's star cells: from equal lengths to equal angles on a face, and how far a cell's chance follows the sky it covers | `starsCellWarp`, `starsSkyEven` |
| The sky itself: its centre from the middle of the screen to the field's vanishing point, its sphere's radius (0 the focal length), and whether the flat backdrop turns with the camera while 3D eases in | `skyCenter`, `skySize`, `skyEaseBend` |

- Fixed stars behind everything, bent by the lens and rippled by the waves, the same size at any zoom.
- A star lives in a cell of the star grid. `starsPlacement` 0 sets them on a square lattice, 1 scatters
  them; `starsPerCell` above 1 stands them in pairs and clusters. A `starsSize` wider than a quarter of
  `starCell` is cut off square at its cell's edge unless `starsNeighbors` draws it from the cells round
  it. Raise those two only when the shot needs large stars or clusters: each multiplies the sky's work.
- In 3D the sky is cut into the faces of a cube: `starsCellWarp` 1 with `starsSkyEven` 1 keeps the stars
  even in every direction; lower either and stars crowd along the cube's edges.
- `skyCenter` 1 centres the sky on the field's vanishing point, which `fieldAtHole` moves toward the hole,
  so in 3D the sky and the scene turn about the same point. The flat stars and clouds are a backdrop and
  stay where they are.
- `skySize` set to half the long side of the size the film renders at keeps that size's sky at every
  frame size, a preview and a render alike; at 0 a frame of another size shows other clouds and cells.
- In 3D the stars lie on a sphere round the camera, as many to a patch of sky everywhere, so at a wide
  frame's sides they stand further apart on the screen. Switching `threeD` turns the flat backdrop into
  the sphere over `threeDEase`; `skyEaseBend` 1 turns the backdrop with the camera meanwhile, so the whole
  sky moves as one, and 0 cross-fades it on the screen.
- `starsTwinkleSpeed` along a track shifts every swing at once, a flicker: change it at a cut, or with
  `starsTwinkle` at 0.
- The same colour in `starsColorWarm` and `starsColorCool` gives a sky of one colour.

### The nebula

Gate: `nebula` above 0, and the `stars` layer shown.

| What | Keys |
|---|---|
| How bright (0 is off) | `nebula` |
| Its clouds: size, how much of the sky they fill, edges, curl, how much denser in the middle, grain | `nebulaScale`, `nebulaSparseness`, `nebulaEdge`, `nebulaWarp`, `nebulaContrast`, `nebulaGrain` |
| Their drift: speed and direction on the screen, and in 3D whether it follows the camera | `nebulaDrift`, `nebulaDriftAngle`, `nebulaDriftFollow` |
| The noise they are made of: how many layers, each how many times finer, with what share of the light of the one before; the curling noise's size and the grain's | `nebulaDetail`, `nebulaLacunarity`, `nebulaRoughness`, `nebulaCurlSize`, `nebulaGrainSize` |
| Its colours: main, the second in patches (size, share of the sky, softness), the core of the thickest cloud (how far, from what thickness) | `nebulaColor`, `nebulaColorDeep`, `nebulaPatch`, `nebulaPatchShare`, `nebulaPatchSoftness`, `nebulaColorCore`, `nebulaCore`, `nebulaCoreFrom` |

- Clouds of gas and dust behind the stars, bent and rippled like them. They are made as the opening's dust
  is (section 13) with numbers of their own: at the dust's values (`nebulaScale` = `dustScale`,
  `nebulaSparseness` = `dustThreshold`, the rest at its defaults) the two are the same clouds.
- `nebulaSparseness` low fills the sky with clouds and narrow dark gaps, high leaves a few wisps.
  `nebulaWarp` 0 leaves round blotches, 5 ribbons, 15 thin folded loops;
  `nebulaGrain` near 1 shows the square cells the noise is built on.
- At a low sparseness most of the sky is thick, so raise `nebulaCoreFrom` with it, or the core colour
  washes over everything.
- It adds light, so a dark background (`backgroundR`..`backgroundB`) deepens the gaps between the clouds.
- In 3D it lies on the sky's sphere and turns rigidly with the camera, other clouds than the flat mode's.
  Its drift runs through space: `nebulaDriftFollow` 1 keeps it the same way on the screen wherever the
  camera looks. A change of the drift or the follow along a track moves the clouds on from where they are.
- `nebulaDetail` 1 gives soft blobs and high values fine filaments, each layer more of the sky's work; a
  high `nebulaRoughness` makes those filaments ragged and bright. Detail fades its last layer in, so it
  moves smoothly along a track, and `nebulaSparseness` keeps its level at any count. `nebulaCurlSize`
  higher curls the clouds in tighter twists, and `nebulaWarp` sets how hard.

## 11. Where the black hole is, and the camera

Gate: `threeD` on for every 3D key (the circle, the head, the moves, the roll, the column's ends, the front
layers); `cameraZoom` above 1 for a pan (`cameraX`, `cameraY`, `cameraPair`), and a second hole for
`cameraPair`.

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
| What stands in front of the holes in 3D (the subsection below) | `threeDFrontDepth`, `threeDFrontCurve`, `threeDFrontBend`, `threeDFrontBetween`, `threeDFrontReach`, `threeDFrontReachBare`, `threeDFrontLetGo`, `threeDFrontAdd`, `threeDFrontWaves` |

The camera's rules (the craft of a slow push and of keeping the hole off the frame's edge is films.md,
section 4):

- Setting a position anchors the hole. A film has no cursor: the hole rests at its position and tracks
  move it through the same spring, so a low `followFrequency` makes it heavy and late.
- `cameraZoom` is both a setting and an intro parameter of the same name (the camera the opening starts
  with, which always settles back to 1); the two multiply. In a film's tracks the name means the setting;
  the opening's own goes in the intro's parameters.
- The zoom redraws the scene: particles, traces, the ring and the grids stay sharp at any zoom, and while
  the zoom changes the trails streak as a moving camera's would. The title and the opening's dust are the
  two things that soften when magnified.
- Below 1 the picture is shown smaller and repeats, mirrored, beyond its own edges: a tunnel of the scene.
  For a wider sky, use the 3D camera's moves.
- A pan works inside a zoom: the camera is a window into the picture the scene draws, the zoom its size,
  the pan where it looks, and it stops at the picture's edge. Its reach each way is (1 - 1 / zoom) / 2 of
  the frame: a quarter at 2, nothing at 1. To move the picture at a zoom of 1, move the hole (`blackHoleX`,
  `blackHoleY`).
- The point the camera looks at stands where the hole would: `cameraX` 3 puts the place 3 radii right of
  the hole there. In a pair the zoom holds the common centre still; `cameraPair` 1 holds the second hole
  still and follows it round its orbit, -1 the main one, and a track from -1 to 1 pans from one to the
  other. Labels and graphics that ride on the scene follow the camera.
- Cuts: a change bigger than `cameraCutZoom` (zoom), `cameraCutShift` (the picture's move, in pixels at the
  hole) or `cameraCutTurn` (a 3D turn, roll or head) in one frame is a cut, and the trails start afresh;
  below them the trails streak. A pan or a 3D move is a track like any other: ease it for a glide, give it
  the hold ease for a cut. Raised to their tops the thresholds never cut, and a jump smears every particle
  across the frame, a whip pan; at 0 any move starts the trails afresh and nothing streaks.
- `threeD` is another law of gravity, not only another view. The flat mode pulls a particle where it lands
  on the screen, in a layer of depth (`gravityDepth`), and its horizon takes whatever covers the hole at
  any depth. In 3D the hole is a point in space: gravity follows the true distance and ends at the sphere
  of `gravityReach`, the swirl turns about the line of flight or the spin's axis (`orbitalSpinFollow`), the
  horizon is a sphere, the opening reveals the field in a sphere that grows from the blast, and
  `gravityInertia` keeps speed along all three axes. Fewer particles fall in.
- The camera distance: the 3D camera circles the point at `blackHoleDepth` on the line of flight, half the
  frame's long side over the shadow's radius away: about 11 radii at the default size in a wide or a
  vertical frame, about 6 in a square one, nearer for a larger hole. `cameraMoveIn` near that distance is
  at the shadow; past it the hole is behind the camera and its shadow, lens, ring and orbits are not drawn
  while the particles fly on.
- `cameraYaw` 0 looks along the flight and draws what the flat mode draws; 90 sees the column flow past the
  hole from the side; 180 looks back up the stream. `cameraPitch` is degrees above (positive) or below. The
  camera eases between the flat view and its place over `threeDEase`, so flipping `threeD` on a track is a
  turn, not a cut (0 cuts). A full circle is `cameraYaw` keyed from -180 to 180, or `cameraSpin` in degrees
  a second. The point it circles is never nearer than `threeDNearest` of `farZ`: raised above
  `blackHoleDepth` it carries the hole, and the lattice with it, deeper into the column.
- From the side the field is a column with two ends, where particles are born and leave; `threeDEndFade`
  fades both (0 cuts them hard).
- What turns with the camera: the field, the orbits, the flows, the second hole and its waves, and the sky,
  which stands still in the scene round the camera (stars and nebula on a sphere, the lensed grid on a
  box) and crosses the frame as a real sky does, faster at the edges; behind the camera is another sky than
  ahead. A hole without spin looks the same from every side. A spinning hole's axis stands in the scene
  (`spinTilt` and `spinAxis` as seen straight on), so as the camera circles, the shadow's flat side and
  the leaning rings turn with the view.
- The circle is where the camera starts; six keys take it anywhere from there, all at 0 the circle alone.
  `cameraRoll` turns the whole picture about the middle of the screen, the ring's bright side (`ringSide`)
  with it; the circle and the head move `ringSide` and `ringDoppler` only through `ringSpinFollow`.
  `cameraLookYaw` and `cameraLookPitch` turn the camera's head: the hole slides off centre, so a shot can
  open on empty space and swing onto the hole, or let the hole cross the frame. `cameraMoveRight`,
  `cameraMoveUp` and `cameraMoveIn` move the camera itself, in radii of the hole at its full size: near
  particles slide past faster than far ones (parallax, which no pan or zoom gives), and a move in is a real
  approach, which under `lensingTraced` brings the lens's camera nearer too. A fly-by is `cameraMoveRight`
  held at a few radii while `cameraMoveIn` runs from below 0 to past the camera distance, with
  `cameraLookYaw` turning to keep the hole in frame; it turns up to 180, so once the camera has passed the
  hole it looks back at it, shadow, lens and all.

The sheet seen by the 3D camera. In 3D the sheet of section 9 lies across the line of flight while the
hole does not spin, `gridDepth` radii nearer a camera looking down the flight than the hole, its well
running from there down to the hole; the circle, the head, the moves and the roll all act on it, with the
parallax of its near and far parts, and switching `threeD` on turns it over `threeDEase` from the flat
mode's tilted view to where it lies. What each place of the camera shows:

- Straight on (`cameraYaw` 0, `cameraPitch` 0): the sheet face on, rings round the shadow, the well going
  straight away; the flat mode's `gridTilt` 0.
- The familiar view, the well hanging down the screen into the shadow, seen into its mouth: `cameraPitch`
  -20 to -50 at `cameraYaw` 0. A positive pitch sees the same well rising up the screen to the hole, which
  a viewer reads as a mound with the hole on top; a yaw turns the well sideways the same way.
- Once the camera is less than `gridDepth` back along the flight (a steep pitch or yaw: past about 57° at
  `gridDepth` 6, 74° at 3, sooner with both), it has passed through the sheet to the hole's side and sees
  the well from outside. `cameraPitch` -89 is the textbook's cut: the sheet edge on, a line across the
  frame, and the funnel hanging from it down to the hole.
- From behind (`cameraYaw` 180) the far side: the funnel's outside, its tip toward the camera with the hole
  on it and the flat sheet beyond.
- Where the camera looks into the funnel, its near wall passes in front of the lower part of the shadow
  (the subsection below).
- A second hole's well stands where that hole's place falls on the plane, so a pair tilted out of the
  equator dents the sheet under each hole, and that well's bottom stays off its hole.
- A move through the sheet passes it: what lies behind the camera or nearer than its nearest is cut, as a
  stroke is.

### 3D: what stands in front of the holes

Gate: `threeD` on and something nearer the camera than a hole. The flat mode's horizon takes whatever
covers the hole, so there all of this is still.

- In 3D whatever lies between the camera and a hole (a particle, a star's trace, a flow, a line of the
  lattice or the sheet) is drawn over the shadow, the lens and the ring where it is, unbent; what lies
  beyond is seen through the lens. So a camera circled to the side sees the column pass in front of the
  hole on its near side and behind it on its far side, and a fly-by sees the particles it passes cross
  the shadow. A particle that changes side leaves its trail where it was drawn.
- The boundary is a band, `threeDFrontDepth` radii deep behind the hole, over which the share seen through
  the lens grows as a thin lens's bend does (`threeDFrontCurve` bends that growth). At 0 the lens empties a
  half disc round the shadow with a straight edge, the hole's plane; past 3 most of a disc near the hole is
  drawn where it is and its far side stops lifting over the shadow.
- `threeDFrontBend` draws the band once, bent by its share of the lens, so a disc's far side rises smoothly
  into the lens's ring as it lies deeper. That bend is the plain point mass, so with the stylized lens far
  from its defaults the band's far edge shows a seam.
- `threeDFrontAdd` 1 adds the light in front to what is behind, so what crosses the ring brightens it; at 0
  the brighter of the two is kept and a faint particle leaves the ring as it is. `threeDFrontWaves` is how
  much the waves and the opening's matter front slide what is in front: 1 for a wave that passes between
  the holes and the camera.
- With two holes, what lies between them is behind the nearer one alone, which bends and covers it within
  `threeDFrontReach` of its Einstein rings or `threeDFrontReachBare` of its shadow's radii, whichever is
  wider, letting go over `threeDFrontLetGo` times that; elsewhere it is drawn where it is, so the matter
  round the farther hole keeps its shape while the other circles. `threeDFrontBetween` draws that matter
  once, where the nearer lens alone shows it, and with `threeDFrontBend` blends by its depth in the band.

## 12. The page only

`frameRateCap`, `fpsCounter` and `scrollSpeedStep` belong to a device or to a hand on the wheel. They act
on the live page alone, and the first two are in no preset.

## 13. The opening: every parameter by its track

Gate: the opening plays unless a film sets "intro": false. Its film stock stays past `introEnd`, or shows
in a film without the opening, only with `filmHold` above 0; a cue fires an event again only after
`introEnd`.

The opening is a star that explodes, light and matter fronts crossing the frame, a core that collapses, a
black hole that forms, rings and sends a gravitational wave, and a title that the hole takes. Times are
seconds from its start. Only the explosion's own events count from `collapseAt`: the glare, the light and
matter fronts, the echo, the camera's kick and shake. The later moments stay where they are when
`collapseAt` moves, so an explosion moved by some seconds takes `remnantAt`, `horizonAt`, `dissolveAt`,
`releaseAt` and `introEnd` with it by as many (and `titleInAt`, when the title has an entrance of its own);
left behind, the opening still ends at its old second and the shadow can form before the star explodes.

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

- `lightCrossTime` is the speed of light on screen. The matter front moves at `matterSpeed` of it and the
  gravitational wave at exactly it, so one key sets the pace of the whole explosion.
- The ringdown's pitch and length are multiples of what a real hole of that size does, so a bigger hole
  rings lower and longer by itself. They shape the opening's ringdown and a fired one, where the oval
  stands still and squashes one way and then the other; a merger rings by its own clock (section 8).
- `titleEntrance` and `titleExit` are choices: set by an option's name or index, at the start or in a cue.
  The falling-dust parameters act when the title falls into the hole; `titleDrift` and `titleSwirl` follow
  `gravityStrength` and `orbitalStrength`.
- The five colours take a hex string and move along tracks, channel by channel.
- With `originAtHole` 1 the whole opening happens where the hole is placed.
- Film stock: `lensFringe`, `vignette`, `filmGrain` and `letterbox` belong to the opening and leave with
  it. `filmHold` is the share of them that stays: 1 keeps the bars, the grain and the rest for a whole
  film, a track on it fades the look in and out, and in a film without the opening it is what shows them
  at all. `filmKnee` rolls off the highlights of every frame, whatever `filmHold` is.
- The title's words, face and case are set by the title command on the page, by the intro's title, font
  and uppercase in a film, or by a cue's own when a film fires another title.

### Fine tuning: the numbers that shape each event

Each has its default at the constant it replaced, and the intro debugger keeps them in the Fine Tuning
group of their track; describe gives each one's meaning.

| Track | Fine tuning |
|---|---|
| Progenitor star | `starChargeEase` |
| Light front | `lightReach` |
| Dust echo | `echoHoldThin`, `echoHoldThick`, `echoSwell`, `echoSwellMin`, `echoReach`, `dustBlowTime`, `dustDriftAngle`, `dustShockOffset`, `dustShockSharpness`, `dustShockTint`, `dustLayers`, `dustFineness`, `dustRoughness`, `dustWarp`, `dustWarpScale`, `echoTintEase` |
| Background stars | `starFlareDecay`, `starsFadeSmooth` |
| Collapsing core | `remnantEmberAt`, `remnantWhiteness`, `remnantDeep`, `remnantDim` |
| Shadow, lens, ring | `horizonEase`, `lensSmooth`, `ringSmooth` |
| Title: type | `titleLineHeight`, `titleMaxWidth`, `titleMargin` |
| Title: light | `titleDustSize`, `titleDustClumps`, `titleDustLow`, `titleDustHigh` |
| Title: arriving | `titleInOversize`, `titleInEase`, `titleRiseEase`, `titlePushEase`, `titleRiseLitBy` |
| Title: leaving | `titleFlyGrowth`, `titleFlyEase`, `titleOutGrowth`, `titleOutEase`, `titlePullLimit`, `titleSpeckSize`, `titleCurrentSize`, `titleBeyondSpeed`, `titleWink`, `titleSpiralRadius`, `titleSpiralMin`, `titleSpiralMax`, `titleBurnGrain`, `titleBurnFine`, `titleBurnEnds`, `titleBurnRim`, `titleBurnRimWidth`, `titleFallFadeAt`, `titleFlyFadeAt`, `titleCurrentContrast`, `titleOrderReach`, `titleCaptureEdge`, `titleReachFade`, `titleBurnMix`, `titleBurnEdge`, `titleTrailCopies`, `titleTrailLag` |
| Camera and film stock | `cameraCreep`, `cameraSettleEase`, `cameraKickDecay`, `shakeRate`, `shakeSecond`, `shakeSecondRate`, `shakeVertical`, `lensFringeEase`, `filmSmooth`, `vignetteStart`, `vignetteEnd`, `filmKnee` |
| The hole's motion and the end | `turnSmooth` |

- `lightReach` multiplies the on-screen speed of light: the matter front, the birth of the particles and
  the gravitational wave quicken with it, and the ringdown, which follows that speed, rings higher and
  shorter.
- A key that ends in Smooth shapes a fade between two moments (`starsFadeSmooth`, `lensSmooth`,
  `ringSmooth`, `filmSmooth`, `turnSmooth`): 0 an even pace, 1 the smooth step, 3 close to a cut. A key
  that ends in Ease is the power of a curve, 1 an even pace (`starChargeEase`, `horizonEase`,
  `cameraSettleEase`, `titlePushEase`, and one for each way a title moves: `titleInEase`, `titleRiseEase`,
  `titleFlyEase`, `titleOutEase`, `titleFallEase`).
- `titleLineHeight` and `titleMaxWidth` are read when the words are drawn, as `titleSize`, `titleWeight`,
  `titleTracking`, `titleHaloRadius` and `titleStreak` are: set them in the intro's params or a cue's own;
  a track on one moves nothing, and the film is told so. `titleMargin` is read every frame.
- The dust's clouds (`dustLayers`, `dustFineness`, `dustRoughness`, `dustWarp`, `dustWarpScale`) keep their
  coverage at any count, so `dustThreshold` keeps its meaning: one layer and no curl is soft blotches, six
  layers with a high roughness grit, a high curl streams. Behind the matter front `dustSweep` has cleared
  the dust, so a negative `dustShockOffset` shows little.
- The falling title follows `gravityStrength` and `orbitalStrength`, up to `titlePullLimit`; the
  titleBurn keys shape the Burns away exit alone.
- `shakeSecond` 0 is a clean buzz, 2 a lurch with a buzz on it; `shakeVertical` 0 a sway.
  `lensFringeEase` high keeps the middle clean and fringes only the edges.

## 14. Layers of the opening

Gate: a layer shows while it is not hidden; an event layer plays again only when a cue fires it, at the
black hole, after the opening is over.

Each can be hidden on its own to see what it contributes, or to leave it out of a film: `star`, `glare`,
`light`, `echo`, `stars`, `shockwave`, `reveal`, `burst`, `remnant`, `ringdown`, `gravityWave`, `title`,
`hole`, `lens`, `ring`, `gravity`, `doppler`, `camera`.

The last six are the scene's own features as the opening brings them in. Hiding `gravity` flies the
particles straight through; hiding `camera` leaves the opening's zoom, shake and film stock out.

A layer is one of two kinds, and the list of layers from the page says which, with a line on each:

- An event happens once: `star`, `glare`, `light`, `echo`, `shockwave`, `burst`, `remnant`, `ringdown`,
  `gravityWave`, `title`, `camera`. A film fires it again with a cue. Fired, `camera` is the jolt and shake
  of the blast alone, and `title` is a title that arrives and leaves again, with words of its own if the
  cue gives them.
- A state is there or not: `stars`, `reveal`, `hole`, `lens`, `ring`, `gravity`, `doppler`.

Every layer of either kind can be switched on and off along a film. What a fired event looks like is its
parameters in the table of section 13.

## 15. Presets, fonts, sizes, caption places

- Simulation presets: `Default`, `Schwarzschild`, `Kerr`; preset.list() on the page names them with a
  line each, and each is defined in `src/store/preset_store.ts`. `Default` is the store's defaults.
  `Schwarzschild` is `Default` with the physics left untuned: `horizonScale` 1, `orbitalStrength` 0,
  `blackHoleSpin` 0, the lens traced with `lensingRadius` 2.5 and `lensingAbsorption` 0, and its stylized
  keys a point mass (`lensingReach` 1, `lensingFalloff` 2, `lensingRotation` 0, `lensingCore` 0.1,
  `lensingMaxBend` 256); the field's look, gravity and the ring stay at their defaults. `Kerr` is
  `Schwarzschild` with `blackHoleSpin` 0.99, `spinTilt` 80, `spinAxis` 0, `lensingRadius` 2.2 and
  `ringSide` on the flat, approaching side.
- Looks of the opening: `Default`, `Slow Burn`, `Flashbang`, `Anamorphic`, `Event Horizon`, `Nebula`,
  `Silent Dark`, `Supernova`, `Whirlpool`, `Swallowed`, `Requiem`. A look sets intro parameters, sometimes
  the title's face and some scene settings; parameters given beside it are laid over it.
- Title fonts: `unbounded`, `orbitron`, `geistMono`. The first and the last follow `titleWeight`.
- Caption fonts: the three above, `noto` (a plain text face for sentences and formulas) and `system` (the
  machine's own, so it differs between machines). Behind every bundled one stand faces with Greek,
  mathematics and the signs of the Sun and the planets.
- Ways a caption arrives: `letters`, `words`, `lines`.
- Film sizes: `1080p`, `720p`, `4k`, `vertical`, `square`.
- Caption places: `bottom`, `top`, `center`, and three that point a line at something in the scene: `hole`
  (the shadow's edge), `einstein` (the Einstein ring), `companion` (the second black hole).
