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
9. Curved space made visible: the two grids
10. Background stars and the sky
11. Where the black hole is, and the camera
12. The page only
13. The opening: every parameter by its track
14. Layers of the opening
15. Presets, fonts, sizes, caption places
16. What is a law and not a knob

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
| What a particle looks like | `particleSize`, `trailIntensity`, `speedGlow`, `baseBrightness` |
| How depth changes it | `depthFade`, `minOpacity`, `maxOpacity` |
| Twinkle | `pulseIntensity`, `pulseSpeedMultiplier` |
| Colours | `colorPalette`, `backgroundR`, `backgroundG`, `backgroundB` |

What follows from how it is drawn:

- A particle's brightness is its speed. A particle that did not move draws nothing, so `baseSpeed` 0 leaves
  the field dark except where gravity moves it. `speedGlow` bends that link: 0 lights every moving
  particle in full, high values leave only the fast ones.
- The trail is the fade of the picture, not part of the particle. `trailIntensity` 0 means nothing ever
  fades: a long exposure. Together with `baseSpeed` 0 the black hole draws with its own pull.
- Gravity is not scaled by the flight speed, so slowing the flight does not weaken the hole.
- `colorPalette` is an array of colours with shares; a particle takes its colour when it is born, so a new
  palette arrives as particles are recycled. It is set, never keyframed. The background channels can be
  keyframed.
- On the page the count is trimmed by the particle budget; in a film `numParticles` is exact, up to
  200 000, and costs render time in proportion.

## 3. Gravity on the particles

| What | Keys |
|---|---|
| Pull towards the hole (negative pushes away) | `gravityStrength` |
| Sideways force that makes them swirl (the sign is the direction) | `orbitalStrength` |
| How far it reaches across the screen, in radii | `gravityReach` |
| Where the hole sits in depth, and how thick a layer it pulls | `blackHoleDepth`, `gravityDepth` |

- The particles have no velocity of their own: gravity displaces them each frame. Real orbits belong to
  the orbiting stars (section 7), not to the particles.
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

## 5. The lens: how light bends

The lens bends the finished picture (particles, stars, grids), not the particles' paths.

| What | Keys |
|---|---|
| On or off | `lensingEnabled` |
| Size of the Einstein ring, in radii | `lensingRadius` |
| Shape outside the ring: 0 a compact bubble, 1 a point mass | `lensingReach` |
| How the pull changes with distance, and where that changes nothing | `lensingFalloff`, `lensingPivot` |
| What shows inside the ring | `lensingMaxBend`, `lensingCore` |
| Swirl of the sky | `lensingRotation`, `lensingTwistLimit` |
| Dark zone around the shadow | `lensingAbsorption` |

- The physically faithful setup is the `Schwarzschild` preset: `lensingReach` 1, `lensingFalloff` 2, no
  twist, one mirrored image inside the ring, capture at the shadow's edge. `Default` is tuned for the look.
- For a real hole `lensingRadius` says how far the camera is: about the square root of twice the distance
  in Schwarzschild radii, divided by 2.6.
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
| The approaching side brighter and bluer, and which side that is | `ringDoppler`, `ringSide` |
| Light with nothing falling in | `ringBase` |
| Light from what falls in: on or off, how much, how long it lingers, how fast it travels round | `ringFeedEnabled`, `ringFeed`, `ringAfterglow`, `ringFlowSpeed` |

- The ring is fed by the simulation: particles captured or skimming past, and orbiting stars that cross
  the horizon. A dark ring usually means nothing is falling in; raise `gravityStrength` or `ringBase`.
- `ringWidth` 0 is the finest line the screen draws, at any zoom.

## 7. Orbiting stars

Up to 64 stars with real velocity in the plane of the screen: ellipses that precess, faster the closer they
come, as around a real black hole.

| What | Keys |
|---|---|
| How many (0 is none) | `orbitCount` |
| Shape of the orbits | `orbitSize`, `orbitEccentricity` |
| Rate of their time; the sign is the direction | `orbitSpeed` |
| How long a trace stays lit, and its width | `orbitTrail`, `orbitStarSize` |

- Changing `orbitSize` or `orbitEccentricity` makes every orbit anew, so do not glide them along a track:
  set them at the start, or step them with the hold ease.
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

- The two turn around their common centre by Kepler's law, so closing `companionDistance` speeds them up
  by itself. Moving it from far to 0 over a film is a merger.
- Below a distance of 1 + `companionSize` the shadows overlap and the main hole grows by the companion's
  mass. At 0 they are one hole, which rings and sends a last wave.
- The last turns, the merger and the ringing are one motion. The main hole is drawn out toward the
  companion as the shadows merge; after the merger the oval keeps turning the way the pair did while it
  dies away. Its tone is the merged hole's own (what is left spins, so two equal holes ring about 1.4
  times higher than a still hole of that size) and runs on the pair's clock: `companionSpeed` scales it,
  and the opening's `ringdownPitch`, `ringdownLength` and `lightCrossTime` do not.
- `ringdownAmplitude`, an intro parameter, is how far the merged hole is drawn out: three times it for
  equal masses, less for unequal ones. It works in a film without the opening.
- `companionWaves` alone sets the wave. The spiral rises to its peak at the merger and flies on outward,
  and the dying turns of the ringing follow it at the same strength, with no jump between them.
  `gravityWaveGain` shapes only the opening's wave and a fired one.
- A wave stretches the sky across its path, never along it, and weakens as 1 over the distance. At
  `companionWaves` 1 the sheet sways through a merger; at 3 it folds into steep spiral arms.
- At `companionSpeed` 1 a turn at 8 radii takes about 15 s. A short film wants 2 to show the pair circling.
- Two horizons take more of the flight than one: over a long approach the field can thin out. Lower
  `gravityStrength`, or `horizonScale`, when the picture needs the particles.
- The companion has its own shadow, lens, ring, gravity and well in the sheet.

## 9. Curved space made visible: the two grids

| What | Keys |
|---|---|
| Cell size, shared by both grids | `gridCell` |
| The sheet: brightness (0 is off), viewing angle, depth of the well in radii | `gridSheet`, `gridTilt`, `gridDepth` |
| A flat grid on the sky read through the lens (0 is off) | `gridSky` |

- The sheet is a diagram: a surface dented where the hole sits, rippled by gravitational waves. It stays
  put while the hole moves across it. At a `gridTilt` of 60 and above the well's depth shows.
- The dent is gravitational time dilation, and can be said so in a caption: a place is lowered by how much
  time is slowed where the light seen at that distance passed closest to the hole. Far away the sheet is
  flat; at the shadow's edge, where that light skims the photon sphere, it is `gridDepth` deep and ends.
- The lensed grid is a measuring tool: it shows the Einstein ring, the mirrored image, the twist and the
  waves. Lower `baseBrightness` when it should be read clearly.

## 10. Background stars and the sky

`starsBrightness`, `starDensity`, `starCell`: fixed stars behind everything, bent by the lens and rippled
by the waves. They keep their size at any zoom.

## 11. Where the black hole is, and the camera

| What | Keys |
|---|---|
| Where it rests, as shares of the frame | `blackHoleX`, `blackHoleY` |
| Whether it follows the cursor, and how stiffly it moves to where it is sent | `blackHoleFollowing`, `followFrequency` |
| Magnification around the hole | `cameraZoom` |

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

- Simulation presets: `Default`, `Schwarzschild`.
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

## 16. What is a law and not a knob

These are fixed in the code. No setting, film or agent call changes them; changing one is a code change
with its own measurements, and SKILL.md says how a new knob is added.

| Law | File in src/lib |
|---|---|
| The speed of light for the orbiting stars (1.2 short sides a second) and the shadow at 2.598 Schwarzschild radii | orbiters.ts |
| How the orbits are integrated and precess; at most 64 stars; the spread of sizes between stars | orbiters.ts |
| Kepler's law for the pair, the closest orbit before they merge, the wave's share | companion.ts |
| The shape of gravity's falloff with distance and depth; what a captured or skimming particle gives the ring | particle_simulation.ts |
| A real hole's ringdown tone, which the pitch and length multiply | intro_params.ts |
| The sheet's camera and span | space_grid.ts |
| Motion capped at six reference frames a step; a stall treated as one frame | particle_simulation.ts, frame_pacing.ts |
