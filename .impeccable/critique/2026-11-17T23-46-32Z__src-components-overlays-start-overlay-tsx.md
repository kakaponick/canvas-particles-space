---
target: page load / first seconds
total_score: 14
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\kakaponick\\Desktop\\dev\\canvas-particles-space\\src\\components\\overlays\\start_overlay.tsx"
target_fingerprint: "sha256:b70199738ceda380d54481cc8e9a83c1ee1e067ffd0e58284df29507c8cbe37f"
target_path: "C:\\Users\\kakaponick\\Desktop\\dev\\canvas-particles-space\\src\\components\\overlays\\start_overlay.tsx"
timestamp: 2026-11-17T23-46-32Z
slug: src-components-overlays-start-overlay-tsx
---
# Critique: page load / first seconds (start overlay + particle canvas)

Method: dual-agent (A: design review, B: detector + measurements). Production build, headless Chrome 1920x1080 and 390x844.

## Heuristics
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | FOLLOWING toast fires under the overlay at load and is gone before the click; at 100% scroll the label still says "scroll", no end state |
| 2 | Match system / real world | 2 | gravity 0, mouseRadius = eventHorizon = 10: particles ignore the black hole; "CLICK" on phones |
| 3 | User control and freedom | 2 | Start click forces fullscreen; first canvas click silently pins the hole; no reset |
| 4 | Consistency and standards | 2 | cyan/magenta states, OS emoji next to Orbitron, two slider styles |
| 5 | Error prevention | 2 | Exploratory click freezes the hole, reads as a bug |
| 6 | Recognition rather than recall | 1 | Cursor-follow and click-to-pin never shown; only scroll is labelled |
| 7 | Flexibility and efficiency | n/a | Experience surface |
| 8 | Aesthetic and minimalist design | 2 | Minimal HUD, but five-colour confetti, glow everywhere, HUD ghosts through the overlay |
| 9 | Error recovery | 1 | No WebGL: black screen, console.warn only |
| 10 | Help and documentation | n/a | Experience surface |
| Total | | 14/32 (44%) | Poor |

## Design specificity
Engine is authored, skin is generic neon sci-fi (Orbitron, #00ffff glow, mono, pulsing CLICK TO START, five neon particle colours). Detector: 1 finding, overused-font Geist Mono at src/index.css:51 (valid).

## First 10 seconds (desktop)
- 0-0.5 s: blank #0a0a0f; first paint blocked by Google Fonts CSS (480 ms fast, 2 s throttled)
- 0.55 s: overlay in fallback font; ~1.07 s swap to Orbitron, title widens 55 px
- 2.5 s: the only cursor hint (FOLLOWING toast) fades unseen
- click: forced fullscreen; field already in flight; 2 s overlay fade
- +0.5 s: best frame, by accident: hole lenses the fading title
- +1..+10 s: near-identical frames, speed 0.5, nothing escalates; real peak hidden behind scroll 50-100%

## What works
1. Instant reveal, field in motion from frame one, steady pacing.
2. Scroll-to-accelerate is a strong physical mapping (21x).
3. Recessive HUD and the seed of a great reveal (lens bending text).

## Priority issues
1. [P0] No arc in the first seconds, inert hero: ~100 px hole hidden at the densest point, gravity 0. Fix: make the start an escalating event, big hole, gravity and orbits on by default. Command: overdrive.
2. [P1] Interactions undiscoverable: toast wasted under the overlay, click is a hidden mode switch, no scroll end state. Command: onboard.
3. [P1] Forced fullscreen breaks the reveal: resize clears trails mid-fade, Esc bubble, unsupported on iPhone (from code). Command: harden.
4. [P2] Mobile second-class: stretched oval projection, no devicePixelRatio, no touch drag, tap pins silently, scroll label collides with buttons. Command: adapt.
5. [P2] Gate is a dead wall: previews nothing, no keyboard start, prefers-reduced-motion ignored, unlabelled icon buttons, fonts render-blocking 480 ms. Command: harden.

## Persona red flags
- Visitor from a shared link: no preview card, black slate, forced fullscreen, flat 10 s, exploratory click freezes the hole; leaves in ~15 s without the peak.
- Mobile visitor: squashed blurry field, "CLICK", no drag, URL-bar resize clears trails.
- Low-end HiDPI laptop: no adaptive quality, FPS cap buried, 21x acceleration without reduced-motion.

## Minor
Typo "Back Hole Radius"; FPS presets stop at 144 while AUTO showed 152; stippled long streaks at high speed; square spawn area gives a horizontal eye on 16:9; no description / og:image.

## Proposed concepts
Shared base: single colour-temperature ramp plus Doppler shift instead of five neons; hole horizon ~8% of short side with photon ring and inertia; mouseRadius ~320, eventHorizon ~45, gravity ~2.5, orbital ~40, lensingMass x20-30, lensingRotation ~0.15, 30k particles, cruise ~2; drop forced fullscreen, self-host fonts, keyboard start, reduced motion, mobile projection + DPR + drag, scroll end state.
1. Collapse: zero-input cinematic supernova, shockwave spawns the field, hole grows and swallows the title, drifts to cursor; scroll = falling in, 100% = crossing the horizon.
2. Jump (recommended): hold to charge, release to jump 0->40 in 0.6 s with flash and aberration, exit in front of a giant hole; scroll = throttle, Space = jump again, 100% = arrival.
3. Matter: title made of 30-50k dust points; the cursor is the hole, letters spiral into an accretion disk and re-form when idle; click collapses into the warp tunnel as act two.

## Questions to consider
- If lightspeed is the best frame, why make visitors look for it?
- Is the hole a cursor or a character?
- What does arriving mean; how should 300vh end?
