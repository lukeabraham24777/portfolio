import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars, PointerLockControls, Float, Sky, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { useStore } from '../store'
import * as THREE from 'three'

// ─── VOLUME CONSTANTS — adjust these to change relative audio levels ───────
const VOLUMES = {
  mainMusic:   0.40,
  fireplace:   0.55,
  wind:        1.00, // set to max; file may be quiet
  cat:         0.70,
  lamp:        0.60,
  chair:       0.65,
  mouseClick:  0.50,
  keyboard:    0.30,
  typingEffect: 0.50,
}
// ────────────────────────────────────────────────────────────────────────────

// ─── FRAME-RATE-INDEPENDENT MOTION ────────────────────────────────────────
// Every bit of movement/animation below is pinned to BASELINE_FPS so the whole
// experience feels IDENTICAL on every machine — a 30 fps laptop and a 240 Hz
// desktop all get the same speed per real-world second. The old code ran at
// `constant × current-fps`, so it was tuned to how it felt on a 165 Hz display;
// BASELINE_FPS = 165 reproduces exactly that feel for everyone. Change this one
// number to make the whole thing faster/slower.
const BASELINE_FPS = 144      // the experience is locked to feel like it did at this refresh rate
const MOVE_SPEED = 0.1 * BASELINE_FPS   // 16.5 units/sec (old code moved 0.1 units PER FRAME)
const SPRINT_MULTIPLIER = 1.8 // walk speed × this while Shift is held
// ─── STAGE SCALE — compresses the whole layout toward the origin ──────────
// Every placed object's x/z position is multiplied by this, so the arrangement
// keeps its exact relative proportions but everything sits closer together.
// Object SIZES are untouched. The walkable boundary, border strips, floor and
// spawn point follow it. 1.0 = the original spread.
const STAGE_SCALE = 0.8
const STAGE_BOUND = 55 * STAGE_SCALE // player/ball clamp (was ±55)

const MAX_DELTA  = 1 / 8      // clamp a single frame's delta so a stutter/tab-out can't teleport things.
                             // Below ~8 fps the scene runs in slow motion (the clamp trades speed for
                             // not leaping across the map on a freeze). Raise the denominator to slow-mo
                             // sooner, lower it to tolerate worse frame rates before slowing.
// Reproduces a fixed-alpha lerp that was tuned at BASELINE_FPS, at ANY frame rate.
// `alpha` is the old per-frame lerp factor; `delta` is seconds since last frame.
const fpsLerp = (current, target, alpha, delta) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.pow(1 - alpha, Math.min(delta, MAX_DELTA) * BASELINE_FPS))
// Same idea for slerp (quaternions).
const fpsSlerpFactor = (alpha, delta) => 1 - Math.pow(1 - alpha, Math.min(delta, MAX_DELTA) * BASELINE_FPS)
// ────────────────────────────────────────────────────────────────────────────

// ─── PROMPT Y POSITION — increase to move the interaction prompt lower ────
const PROMPT_TOP_PX = 80  // pixels from the top of the viewport
// ────────────────────────────────────────────────────────────────────────────

// ─── IN-COMPUTER OS CONTENT — everything the virtual desktop shows ─────────
// PROJECTS is fully modular: add / remove / reorder objects here and the
// Projects.exe window rebuilds itself automatically. `link` opens in a new tab
// (the repo's homepage where one exists, else the GitHub repo); `repo` powers
// the GitHub icon in each card's bottom-right corner.
const PROJECTS = [
  {
    title: 'CmdTab',
    blurb: 'Low-latency macOS window manager that unifies MRU tab, window, and application switching with window previews, on-click minimization, mic controls, and low-level system integrations unavailable natively on macOS. 25+ downloads',
    tech: ['Swift', 'JavaScript', 'Python', 'Shell'],
    link: 'https://cmd-tab.com',
    repo: 'https://github.com/lukeabraham24777/CmdTab',
  },
  {
    title: 'Inspector Pipe',
    blurb: 'Predictive data realignment via anomaly detection — full dashboard, mapped pipe anomalies, and anomaly forecasting for pipeline engineers. Saves pipeline companies millions of dollars and engineers hundreds of hours.',
    tech: ['Python', 'JavaScript', 'HTML', 'CSS'],
    link: 'https://inspector-pipe.vercel.app',
    repo: 'https://github.com/lukeabraham24777/inspector-pipe',
  },
  {
    title: 'Market-Making Trading Bot',
    blurb: 'IMC Prosperity 4 finalist trading bot; yielded ~$33,000 profit.',
    tech: ['Python'],
    link: 'https://github.com/lukeabraham24777/Market-Making-Trading-Bot',
    repo: 'https://github.com/lukeabraham24777/Market-Making-Trading-Bot',
  },
  {
    title: 'Death Clock',
    blurb: 'Recreation of www.death-clock.ai.',
    tech: ['TypeScript', 'JavaScript', 'Python', 'Docker'],
    link: 'https://www.youtube.com/shorts/DtgI_douClg',
    repo: 'https://github.com/lukeabraham24777/death-clock',
  },
  {
    title: 'Cottage Portfolio',
    blurb: 'This very world — an explorable 3D winter cabin with custom GLSL auroras, spatial audio, and a playable basketball mini-game.',
    tech: ['React', 'Three.js', 'R3F', 'GLSL'],
    link: 'https://www.luke-abraham.com/',
    repo: 'https://github.com/lukeabraham24777/portfolio',
  },
]

// Fill in your real handles / URLs. Email is prefilled; edit as needed.
const CONTACT = {
  github:   { url: 'https://github.com/lukeabraham24777',     handle: 'lukeabraham24777' },
  linkedin: { url: 'https://www.linkedin.com/in/lukeabrm/',   handle: 'in/lukeabrm' },
  email:    { url: 'mailto:lukeabraham06@gmail.com',          handle: 'lukeabraham06@gmail.com' },
}

const RESUME_URL = '/resume.pdf'
// ────────────────────────────────────────────────────────────────────────────

// ─── BASKETBALL CONSTANTS — adjust to tune gameplay ──────────────────────
const SHOT_METER_SPEED = 0.55    // full swings per second (higher = faster bar)
const SHOT_GOOD_ZONE   = 0.14   // fraction below 1.0 that counts as a good shot
const BALL_HOLD_DISTANCE = 2.4  // units in front of camera the ball floats
const BALL_SPAWN = [40 * STAGE_SCALE, 0.55, -40 * STAGE_SCALE] // where the ball rests when not held
const HOOP_POS = [52 * STAGE_SCALE, 13, -52 * STAGE_SCALE]    // position of the hoop group
const HOOP_ROT_Y = Math.PI * 0.75 // hoop group Y rotation (faces scene center)
// World-space rim centre — local rim offset [0, -0.98, -0.9] rotated by HOOP_ROT_Y.
// R_y(θ): worldX = groupX + lz*sin(θ),  worldZ = groupZ + lz*cos(θ)  (lx=0)
// lz = -0.9, sin(135°) = +0.7071, cos(135°) = -0.7071
// worldX = 52 + (-0.9)(+0.7071) ≈ 51.36
// worldZ = -52 + (-0.9)(-0.7071) ≈ -51.36
const HOOP_RIM_WORLD = new THREE.Vector3(
  HOOP_POS[0] + (-0.9) * Math.sin(HOOP_ROT_Y),
  HOOP_POS[1] - 0.98,
  HOOP_POS[2] + (-0.9) * Math.cos(HOOP_ROT_Y)
)
const FLIGHT_DURATION = 1.3 // seconds for ball arc
// ────────────────────────────────────────────────────────────────────────────

// ─── GRAND PIANO CONSTANTS — corner prop, scale ≈ 2 units/meter ──────────
const PIANO_POS = [-49 * STAGE_SCALE, 0, -49 * STAGE_SCALE]
const PIANO_ROT_Y = Math.PI / 4 // 45° — tail into the (-60,-60) corner, keyboard/open lid facing room center
const PIANO_LIGHT_RADIUS = 14 // xz-plane distance (units) from PIANO_POS at which the overhead spotlight switches on
const PIANO_SCALE = 1.8 // 80% larger, uniform (proportions unchanged)

const LENGTH_TOTAL   = 3.70  // spine-to-tail (real ≈ 1.85m)
const WIDTH_MAX       = 3.06  // max bentside width (real ≈ 1.53m)
const KEYBOARD_WIDTH  = 2.44  // 88-key span (real ≈ 1.22m)
const LEG_HEIGHT      = 1.36  // floor → keybed
const CASE_RIM_HEIGHT = 0.60  // keybed → case top
const CASE_TOP_Y      = LEG_HEIGHT + CASE_RIM_HEIGHT
const WHITE_KEY_LEN   = 0.30
const BLACK_KEY_LEN   = 0.19
const LID_THICKNESS   = 0.08
const LID_OPEN_DEG    = 52

// shape-space corners (x = width axis, y = length axis; y=0 front/keyboard, y=LENGTH_TOTAL tail)
const BASS_X   = -1.32
const TREBLE_X = 1.32
const MAX_X    = 1.74 // BASS_X + WIDTH_MAX
const MAX_Y    = 1.15
const TAIL_X   = -1.05
const CHEEK_WIDTH = 0.15      // solid corner block flanking the keyboard on each side
const KEY_NOTCH_DEPTH = 0.55  // how far back the keyboard cutout recesses between the cheek blocks

// top-down wing-shaped outline: straight spine, curved bentside/tail, and a rectangular notch
// recessed between two solid "cheek block" corners where the keyboard sits — without this notch
// the case would be a solid slab in front of the keys, hiding them entirely.
// xShift lets the lid reuse the same outline shifted so the hinge (spine) edge sits at shape-x=0.
function buildWingShape(xShift = 0) {
  const s = new THREE.Shape()
  const X = (v) => v + xShift
  s.moveTo(X(BASS_X), 0)
  s.lineTo(X(BASS_X + CHEEK_WIDTH), 0)
  s.lineTo(X(BASS_X + CHEEK_WIDTH), KEY_NOTCH_DEPTH)
  s.lineTo(X(TREBLE_X - CHEEK_WIDTH), KEY_NOTCH_DEPTH)
  s.lineTo(X(TREBLE_X - CHEEK_WIDTH), 0)
  s.lineTo(X(TREBLE_X), 0)
  s.quadraticCurveTo(X(1.95), 0.50, X(MAX_X), MAX_Y)
  s.quadraticCurveTo(X(1.55), 2.60, X(0.05), 3.55)
  s.quadraticCurveTo(X(-0.55), 3.75, X(TAIL_X), LENGTH_TOTAL)
  s.lineTo(X(BASS_X), 0)
  s.closePath()
  return s
}

// standard 12-semitone octave: C C# D D# E F F# G G# A A# B — no black key between E-F or B-C
const OCTAVE_PATTERN = [
  { black: false }, { black: true }, { black: false }, { black: true }, { black: false },
  { black: false }, { black: true }, { black: false }, { black: true }, { black: false }, { black: true }, { black: false },
]
const PIANO_KEY_SEQUENCE = [
  ...OCTAVE_PATTERN.slice(9),                // A0 A#0 B0 (pickup)
  ...Array(7).fill(OCTAVE_PATTERN).flat(),   // C1..B7
  ...OCTAVE_PATTERN.slice(0, 1),              // C8
] // 88 keys: 52 white + 36 black
const PIANO_WHITE_COUNT = 52
const PIANO_WHITE_PITCH = KEYBOARD_WIDTH / PIANO_WHITE_COUNT
const PIANO_KB_HALF = KEYBOARD_WIDTH / 2

// ─── PIANO SOUND ENGINE — Web Audio additive synth, zero audio assets ─────
// Each strike = 5 slightly-inharmonic sine partials through a closing lowpass
// (bright hammer attack that mellows), with bass strings ringing far longer
// than treble, exactly like real strings. noteOff = the damper felt: a fast
// fade instead of a hard cut. Holding a key sustains its natural decay;
// re-striking layers a fresh strike over the old one's tail.
const PIANO_PARTIALS = [
  { mult: 1, gain: 1.0 },
  { mult: 2, gain: 0.55 },
  { mult: 3, gain: 0.3 },
  { mult: 4, gain: 0.16 },
  { mult: 5, gain: 0.08 },
]
let _pianoCtx = null
let _pianoBus = null
const getPianoCtx = () => {
  if (!_pianoCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    _pianoCtx = new AC()
    // soft-knee compressor so full-arm chords/glissandi don't clip
    const comp = _pianoCtx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 20
    comp.ratio.value = 6
    _pianoBus = _pianoCtx.createGain()
    _pianoBus.gain.value = 0.9
    _pianoBus.connect(comp)
    comp.connect(_pianoCtx.destination)
  }
  if (_pianoCtx.state === 'suspended') _pianoCtx.resume()
  return _pianoCtx
}
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12)

const pianoNoteOn = (midi) => {
  const ctx = getPianoCtx()
  if (!ctx) return null
  const t = ctx.currentTime
  const f0 = midiToFreq(midi)
  const ring = 6.5 * Math.pow(0.5, (midi - 21) / 24) + 0.4 // A0 ≈ 7s → C8 ≈ 0.5s

  const strike = ctx.createGain()
  const peak = 0.22 * Math.pow(0.85, Math.max(0, (midi - 60) / 12)) // taper the shrill top octaves
  strike.gain.setValueAtTime(0, t)
  strike.gain.linearRampToValueAtTime(peak, t + 0.004)
  strike.gain.setTargetAtTime(0, t + 0.004, ring / 3)

  const hammer = ctx.createBiquadFilter()
  hammer.type = 'lowpass'
  hammer.Q.value = 0.3
  hammer.frequency.setValueAtTime(Math.min(f0 * 9, 11000), t)
  hammer.frequency.exponentialRampToValueAtTime(Math.max(f0 * 2, 600), t + Math.min(ring, 1.4))

  strike.connect(hammer)
  hammer.connect(_pianoBus)

  const stopAt = t + ring * 2.5 + 0.5
  const oscs = PIANO_PARTIALS.map((p) => {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f0 * p.mult * (1 + 0.0002 * p.mult * p.mult) // string stiffness stretch
    const g = ctx.createGain()
    g.gain.value = p.gain
    o.connect(g)
    g.connect(strike)
    o.start(t)
    o.stop(stopAt)
    return o
  })
  oscs[0].onended = () => { strike.disconnect(); hammer.disconnect() }
  return { strike, oscs, dead: false }
}

const pianoNoteOff = (h) => {
  if (!h || h.dead || !_pianoCtx) return
  h.dead = true
  const t = _pianoCtx.currentTime
  h.strike.gain.cancelScheduledValues(t)
  h.strike.gain.setTargetAtTime(0, t, 0.1) // damper felt, not a hard cut
  h.oscs.forEach((o) => { try { o.stop(t + 0.6) } catch { /* already stopped */ } })
}

// ─── PIANO BENCH — sittable, positioned in front of the keyboard ──────────
const BENCH_LENGTH = 1.9   // long axis, parallel to the keyboard (real ≈ 0.95m)
const BENCH_DEPTH = 0.7
const BENCH_LEG_HEIGHT = 1.0
const BENCH_SEAT_THICK = 0.16
const BENCH_LOCAL_OFFSET = 1.3 // unscaled distance in front of the keyboard (before PIANO_SCALE)
const BENCH_POS = [
  PIANO_POS[0] + BENCH_LOCAL_OFFSET * PIANO_SCALE * Math.sin(PIANO_ROT_Y),
  0,
  PIANO_POS[2] + BENCH_LOCAL_OFFSET * PIANO_SCALE * Math.cos(PIANO_ROT_Y),
]
// Camera target while sitting: eye height matches the desk chair's sit height; look toward the keyboard.
const PIANO_BENCH_SIT_POS = new THREE.Vector3(BENCH_POS[0], 3.8, BENCH_POS[2])
const PIANO_KEYBOARD_GAZE = new THREE.Vector3(PIANO_POS[0], 2.4, PIANO_POS[2]) // where the player should actually appear to look
// THREE.Object3D.lookAt() (unlike Camera.lookAt) orients -Z AWAY from its target — the same reason
// the desk's own `deskLookAt` sits on the far side of `sitPos` from the monitor. Mirror the real
// gaze point through the sit position so the reversal cancels out and the camera faces the piano.
const PIANO_BENCH_LOOK_AT = PIANO_BENCH_SIT_POS.clone().multiplyScalar(2).sub(PIANO_KEYBOARD_GAZE)
// ────────────────────────────────────────────────────────────────────────────

// ─── TypedText: letter-by-letter typing animation ────────────────────────
const CHAR_DELAY_MS = 45
const TypedText = ({ text }) => {
  const [displayed, setDisplayed] = useState('')
  const [cursorOn, setCursorOn] = useState(true)

  useEffect(() => {
    if (!text) { setDisplayed(''); return }
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(iv)
    }, CHAR_DELAY_MS)
    return () => clearInterval(iv)
  }, [text])

  useEffect(() => {
    const iv = setInterval(() => setCursorOn(v => !v), 530)
    return () => clearInterval(iv)
  }, [])

  return (
    <span>
      {displayed}
      <span style={{ opacity: cursorOn ? 1 : 0, marginLeft: '2px' }}>▌</span>
    </span>
  )
}
// ────────────────────────────────────────────────────────────────────────────

// 1. CHAIR COMPONENT
const Chair = ({ position, isInteractive, isHovered }) => {
  const groupRef = useRef()
  const scaleRef = useRef(1)
  const seatMatRef = useRef()
  const backMatRef = useRef()

  useFrame((_, delta) => {
    const target = isHovered ? 1.07 : 1.0
    scaleRef.current = fpsLerp(scaleRef.current, target, 0.1, delta)
    if (groupRef.current) groupRef.current.scale.setScalar(scaleRef.current)
    const emTarget = isHovered ? 0.35 : 0.0
    if (seatMatRef.current) seatMatRef.current.emissiveIntensity = fpsLerp(seatMatRef.current.emissiveIntensity, emTarget, 0.1, delta)
    if (backMatRef.current) backMatRef.current.emissiveIntensity = fpsLerp(backMatRef.current.emissiveIntensity, emTarget, 0.1, delta)
  })

  return (
    <group ref={groupRef} position={position} rotation={[0, Math.PI, 0]} userData={{ interactive: isInteractive, type: 'chair' }}>
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 0.4, 2.5]} />
        <meshStandardMaterial ref={seatMatRef} color="#3d260b" emissive="#7a5320" emissiveIntensity={0} />
      </mesh>
      <mesh position={[0, 2.2, -1.1]} castShadow>
        <boxGeometry args={[2.5, 2.5, 0.3]} />
        <meshStandardMaterial ref={backMatRef} color="#3d260b" emissive="#7a5320" emissiveIntensity={0} />
      </mesh>
      {[[-1, 0.4, 1], [1, 0.4, 1], [-1, 0.4, -1], [1, 0.4, -1]].map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.3, 0.8, 0.3]} />
          <meshStandardMaterial color="#1a1105" />
        </mesh>
      ))}
    </group>
  )
}

const DetailedCat = ({ targetPosition, active, isAtFireplace, isHovered, canInteract }) => {
  const groupRef = useRef()
  const tailRef = useRef()
  const earLeftRef = useRef()
  const earRightRef = useRef()
  const catScaleRef = useRef(1)
  const targetVec = useMemo(() => new THREE.Vector3(), [])

  // Snap to starting position on first mount (prevents underground teleport from origin)
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(targetPosition[0], targetPosition[1], targetPosition[2])
      // Face the computer (-Z direction) from the start
      groupRef.current.rotation.set(0, Math.PI, 0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    targetVec.set(...targetPosition)
    groupRef.current.position.lerp(targetVec, fpsSlerpFactor(0.05, delta))
    const distance = groupRef.current.position.distanceTo(targetVec)

    if (distance > 0.15) {
      // Moving: face direction of travel using atan2 (no lookAt to avoid X/Z tilt bugs)
      const dx = targetVec.x - groupRef.current.position.x
      const dz = targetVec.z - groupRef.current.position.z
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        const travelYRot = Math.atan2(dx, dz)
        groupRef.current.rotation.y = fpsLerp(groupRef.current.rotation.y, travelYRot, 0.15, delta)
      }
      // Gentle body sway while walking — X and Z always return to 0
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 10) * 0.05
      groupRef.current.rotation.x = fpsLerp(groupRef.current.rotation.x, 0, 0.1, delta)
    } else {
      // Settled at destination
      groupRef.current.rotation.z = fpsLerp(groupRef.current.rotation.z, 0, 0.1, delta)
      groupRef.current.rotation.x = fpsLerp(groupRef.current.rotation.x, 0, 0.1, delta)
      // At chair → face the computer (−Z = Math.PI); at fireplace → face the fire (also −Z)
      const restRot = Math.PI
      groupRef.current.rotation.y = fpsLerp(groupRef.current.rotation.y, restRot, 0.1, delta)
    }

    if (isAtFireplace && distance < 0.2) {
      groupRef.current.position.y = targetPosition[1] + Math.sin(state.clock.elapsedTime * 1.5) * 0.04
      if (tailRef.current) tailRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.3
      if (earLeftRef.current) earLeftRef.current.rotation.z = -0.2 + Math.sin(state.clock.elapsedTime * 3) * 0.06
      if (earRightRef.current) earRightRef.current.rotation.z = 0.2 + Math.sin(state.clock.elapsedTime * 3.5) * 0.06
    }

    const scaleTarget = (isHovered && canInteract) ? 1.08 : 1.0
    catScaleRef.current = fpsLerp(catScaleRef.current, scaleTarget, 0.1, delta)
    groupRef.current.scale.setScalar(catScaleRef.current)
  })

  const fur      = '#c87941'   // warm tabby orange
  const furDark  = '#7a4820'   // darker markings
  const furLight = '#e8b87a'   // lighter belly / muzzle
  const eyeCol   = '#55dd55'   // bright green eyes
  const noseCol  = '#ffaaaa'

  return (
    <group ref={groupRef} userData={{ interactive: true, type: 'cat' }}>

      {/* ── BODY ── */}
      <mesh castShadow position={[0, 0, 0]} scale={[1, 0.82, 1.18]}>
        <sphereGeometry args={[0.46, 16, 12]} />
        <meshStandardMaterial color={fur} roughness={0.88} />
      </mesh>
      {/* belly patch */}
      <mesh position={[0, -0.08, 0.22]} scale={[0.62, 0.55, 0.42]}>
        <sphereGeometry args={[0.46, 12, 8]} />
        <meshStandardMaterial color={furLight} roughness={0.88} />
      </mesh>

      {/* ── HEAD — large & round, hallmark of a cute cat ── */}
      <group position={[0, 0.54, 0.28]}>
        <mesh castShadow scale={[1.0, 0.97, 0.95]}>
          <sphereGeometry args={[0.42, 18, 14]} />
          <meshStandardMaterial color={fur} roughness={0.88} />
        </mesh>

        {/* white muzzle */}
        <mesh position={[0, -0.1, 0.34]} scale={[0.62, 0.52, 0.4]}>
          <sphereGeometry args={[0.32, 12, 8]} />
          <meshStandardMaterial color={furLight} roughness={0.88} />
        </mesh>

        {/* nose */}
        <mesh position={[0, -0.09, 0.44]}>
          <sphereGeometry args={[0.038, 7, 5]} />
          <meshStandardMaterial color={noseCol} roughness={0.3} />
        </mesh>

        {/* ── EYES ── large with iris + pupil + shine */}
        {[[-0.17, 1], [0.17, -1]].map(([x, side]) => (
          <group key={x} position={[x, 0.07, 0.37]}>
            {/* whites / sclera outline */}
            <mesh scale={[1, 0.78, 0.55]}>
              <sphereGeometry args={[0.095, 12, 8]} />
              <meshStandardMaterial color="#0a0a0a" />
            </mesh>
            {/* iris */}
            <mesh position={[0, 0, 0.04]} scale={[1, 0.78, 0.55]}>
              <sphereGeometry args={[0.065, 10, 7]} />
              <meshStandardMaterial color={eyeCol} emissive={eyeCol} emissiveIntensity={0.55} />
            </mesh>
            {/* pupil */}
            <mesh position={[0, 0, 0.08]} scale={[0.45, 1, 0.55]}>
              <sphereGeometry args={[0.055, 8, 6]} />
              <meshStandardMaterial color="#000" />
            </mesh>
            {/* shine */}
            <mesh position={[side * 0.022, 0.025, 0.11]}>
              <sphereGeometry args={[0.012, 5, 4]} />
              <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={2} />
            </mesh>
          </group>
        ))}

        {/* ── EARS — tall triangles, wide base ── */}
        <group ref={earLeftRef} position={[-0.24, 0.34, -0.02]} rotation={[0.05, 0, -0.22]}>
          <mesh castShadow>
            <coneGeometry args={[0.13, 0.30, 3]} />
            <meshStandardMaterial color={furDark} roughness={0.88} />
          </mesh>
          <mesh scale={[0.55, 0.72, 1]} position={[0, 0, 0.015]}>
            <coneGeometry args={[0.10, 0.24, 3]} />
            <meshStandardMaterial color="#ff9999" roughness={0.8} />
          </mesh>
        </group>
        <group ref={earRightRef} position={[0.24, 0.34, -0.02]} rotation={[0.05, 0, 0.22]}>
          <mesh castShadow>
            <coneGeometry args={[0.13, 0.30, 3]} />
            <meshStandardMaterial color={furDark} roughness={0.88} />
          </mesh>
          <mesh scale={[0.55, 0.72, 1]} position={[0, 0, 0.015]}>
            <coneGeometry args={[0.10, 0.24, 3]} />
            <meshStandardMaterial color="#ff9999" roughness={0.8} />
          </mesh>
        </group>

        {/* whiskers */}
        {[-1, 0, 1].map(i => (
          <mesh key={`wl${i}`} position={[-0.22, -0.08 + i * 0.04, 0.38]} rotation={[0, 0.1, 0.18 + i * 0.09]}>
            <cylinderGeometry args={[0.0025, 0.002, 0.30, 4]} />
            <meshStandardMaterial color="#eee" />
          </mesh>
        ))}
        {[-1, 0, 1].map(i => (
          <mesh key={`wr${i}`} position={[0.22, -0.08 + i * 0.04, 0.38]} rotation={[0, -0.1, -0.18 - i * 0.09]}>
            <cylinderGeometry args={[0.0025, 0.002, 0.30, 4]} />
            <meshStandardMaterial color="#eee" />
          </mesh>
        ))}
      </group>

      {/* ── FRONT PAWS ── */}
      <mesh castShadow position={[-0.19, -0.38, 0.32]} scale={[0.46, 0.28, 0.54]}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshStandardMaterial color={furLight} roughness={0.88} />
      </mesh>
      <mesh castShadow position={[0.19, -0.38, 0.32]} scale={[0.46, 0.28, 0.54]}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshStandardMaterial color={furLight} roughness={0.88} />
      </mesh>

      {/* ── BACK PAWS ── */}
      <mesh castShadow position={[-0.24, -0.35, -0.28]} scale={[0.5, 0.32, 0.65]}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshStandardMaterial color={fur} roughness={0.88} />
      </mesh>
      <mesh castShadow position={[0.24, -0.35, -0.28]} scale={[0.5, 0.32, 0.65]}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshStandardMaterial color={fur} roughness={0.88} />
      </mesh>

      {/* ── TAIL — three curved segments ── */}
      <group ref={tailRef} position={[0.05, 0.08, -0.62]} rotation={[-0.45, 0.15, 0]}>
        <mesh castShadow><cylinderGeometry args={[0.062, 0.082, 0.55, 8]} /><meshStandardMaterial color={furDark} roughness={0.88} /></mesh>
        <mesh castShadow position={[0.12, 0.32, 0]} rotation={[0, 0, 0.55]}><cylinderGeometry args={[0.05, 0.062, 0.46, 8]} /><meshStandardMaterial color={furDark} roughness={0.88} /></mesh>
        <mesh castShadow position={[0.26, 0.54, 0]}><sphereGeometry args={[0.078, 8, 6]} /><meshStandardMaterial color={fur} roughness={0.88} /></mesh>
      </group>
    </group>
  )
}

const Aurora = () => {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      
      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }
      
      void main() {
        float time = uTime * 0.08;
        float angle = atan(vWorldPosition.z, vWorldPosition.x);
        float normalizedAngle = (angle + 3.14159) / (2.0 * 3.14159);
        
        float curtain1 = snoise(vec3(normalizedAngle * 8.0, vUv.y * 2.0 + time * 0.5, time * 0.3));
        float curtain2 = snoise(vec3(normalizedAngle * 12.0 + 1.5, vUv.y * 3.0 + time * 0.7, time * 0.2 + 2.0));
        float curtain3 = snoise(vec3(normalizedAngle * 4.0 - 0.5, vUv.y * 1.5 + time * 0.3, time * 0.4 + 4.0));
        float curtainEffect = curtain1 * 0.5 + curtain2 * 0.3 + curtain3 * 0.2;
        
        float ribbons = sin(normalizedAngle * 40.0 + curtainEffect * 6.0 + time) * 0.5 + 0.5;
        ribbons *= sin(normalizedAngle * 15.0 + curtainEffect * 3.0 - time * 0.5) * 0.5 + 0.5;
        
        float bottomWave = snoise(vec3(normalizedAngle * 10.0, time * 0.5, 0.0)) * 0.1;
        float dynamicHeightFade = smoothstep(0.05 + bottomWave, 0.25, vUv.y) * smoothstep(0.85, 0.35 + bottomWave * 0.5, vUv.y);

        float intensityNoise = snoise(vec3(normalizedAngle * 3.0, time * 0.2, 1.0)) * 0.5 + 0.5;

        float alpha = ribbons * dynamicHeightFade * (0.5 + intensityNoise * 0.5);
        alpha *= curtainEffect * 0.5 + 0.8;
        alpha = clamp(alpha * 0.8, 0.0, 0.8);
        
        vec3 colorGreen = vec3(0.2, 0.95, 0.4);
        vec3 colorCyan = vec3(0.1, 0.8, 0.7);
        vec3 colorPink = vec3(0.8, 0.2, 0.5);
        vec3 colorPurple = vec3(0.4, 0.1, 0.8);
        
        vec3 baseColor = mix(colorCyan, colorGreen, smoothstep(0.2, 0.4, vUv.y));
        baseColor = mix(baseColor, colorPink, smoothstep(0.5, 0.7, vUv.y) * 0.5);
        baseColor = mix(baseColor, colorPurple, smoothstep(0.6, 0.75, vUv.y) * 0.3);
        
        float colorNoise = snoise(vec3(normalizedAngle * 5.0, vUv.y * 2.0, time * 0.3));
        baseColor = mix(baseColor, colorPurple, colorNoise * 0.2 + 0.1);
        
        vec3 finalColor = baseColor * (1.0 + ribbons * 0.5);
        
        gl_FragColor = vec4(finalColor * alpha * 1.5, alpha);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
  }), [])
  useFrame((state) => { material.uniforms.uTime.value = state.clock.getElapsedTime() })
  return (<mesh position={[0, 200, 0]}><sphereGeometry args={[1800, 64, 64]} /><primitive object={material} attach="material" /></mesh>)
}

// Vibrant close-up aurora curtains
const VibrantAurora = () => {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vPos;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      void main() {
        float time = uTime * 0.1;

        // Create flowing curtain effect
        float n1 = snoise(vec3(vUv.x * 3.0, vUv.y * 0.5 + time, time * 0.5));
        float n2 = snoise(vec3(vUv.x * 5.0 + 10.0, vUv.y * 0.8 + time * 0.7, time * 0.3));
        float n3 = snoise(vec3(vUv.x * 2.0 + 20.0, vUv.y * 0.3 + time * 0.4, time * 0.6));

        // Vertical ribbons
        float ribbon1 = sin(vUv.x * 15.0 + n1 * 4.0 + time * 2.0) * 0.5 + 0.5;
        float ribbon2 = sin(vUv.x * 10.0 + n2 * 3.0 - time * 1.5) * 0.5 + 0.5;

        // Combine ribbons
        float ribbons = ribbon1 * 0.6 + ribbon2 * 0.4;
        ribbons = pow(ribbons, 1.5);

        // Height fade - visible in upper portion
        float heightFade = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.5, vUv.y);

        // Horizontal wave
        float wave = sin(vUv.x * 3.14159 + time) * 0.2 + 0.8;

        float alpha = ribbons * heightFade * wave * (0.6 + n3 * 0.4);

        // Vibrant green colors like the reference
        vec3 green1 = vec3(0.1, 1.0, 0.4);
        vec3 green2 = vec3(0.2, 0.9, 0.5);
        vec3 cyan = vec3(0.1, 0.8, 0.6);

        vec3 color = mix(green1, green2, n1 * 0.5 + 0.5);
        color = mix(color, cyan, vUv.y * 0.3);

        // Brighten
        color *= 1.5;

        gl_FragColor = vec4(color * alpha, alpha * 0.7);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), [])

  useFrame((state) => { material.uniforms.uTime.value = state.clock.getElapsedTime() })

  return (
    <group>
      {/* Main aurora curtain behind scene */}
      <mesh position={[0, 150, -400]} rotation={[0.2, 0, 0]}>
        <planeGeometry args={[800, 300, 1, 1]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* Left curtain */}
      <mesh position={[-300, 120, -200]} rotation={[0.15, 0.5, 0]}>
        <planeGeometry args={[400, 250, 1, 1]} />
        <primitive object={material.clone()} attach="material" />
      </mesh>
      {/* Right curtain */}
      <mesh position={[300, 130, -250]} rotation={[0.15, -0.4, 0]}>
        <planeGeometry args={[450, 280, 1, 1]} />
        <primitive object={material.clone()} attach="material" />
      </mesh>
    </group>
  )
}

// Wavy ribbon aurora like the reference image
const OverheadAurora = () => {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 6; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        float time = uTime * 0.04;
        vec2 uv = vUv;

        // Create curved ribbon paths across the sky
        // Each ribbon follows a wavy path

        float glow = 0.0;
        vec3 totalColor = vec3(0.0);

        // Ribbon 1 - main sweeping curve from left
        float wave1 = sin(uv.x * 2.5 + time) * 0.15 + sin(uv.x * 1.2 - time * 0.5) * 0.1;
        float ribbon1Center = 0.5 + wave1 + fbm(vec2(uv.x * 0.8 + time * 0.2, 0.0)) * 0.15;
        float ribbon1Dist = abs(uv.y - ribbon1Center);
        float ribbon1Width = 0.08 + fbm(vec2(uv.x * 2.0 + time * 0.1, 1.0)) * 0.06;
        float ribbon1 = smoothstep(ribbon1Width, 0.0, ribbon1Dist);
        ribbon1 *= smoothstep(0.0, 0.2, uv.x) * smoothstep(1.0, 0.7, uv.x);

        // Ribbon 2 - crossing from right side
        float wave2 = sin(uv.x * 2.0 - time * 0.8) * 0.12 + cos(uv.x * 1.5 + time * 0.3) * 0.08;
        float ribbon2Center = 0.6 + wave2 + fbm(vec2(uv.x * 0.6 - time * 0.15, 2.0)) * 0.12;
        float ribbon2Dist = abs(uv.y - ribbon2Center);
        float ribbon2Width = 0.06 + fbm(vec2(uv.x * 1.5 - time * 0.1, 3.0)) * 0.05;
        float ribbon2 = smoothstep(ribbon2Width, 0.0, ribbon2Dist);
        ribbon2 *= smoothstep(0.1, 0.4, uv.x) * smoothstep(1.0, 0.6, uv.x);

        // Ribbon 3 - lower sweeping band
        float wave3 = sin(uv.x * 3.0 + time * 0.6) * 0.1 + sin(uv.x * 0.8 - time * 0.2) * 0.15;
        float ribbon3Center = 0.35 + wave3 + fbm(vec2(uv.x * 0.5 + time * 0.1, 4.0)) * 0.1;
        float ribbon3Dist = abs(uv.y - ribbon3Center);
        float ribbon3Width = 0.05 + fbm(vec2(uv.x * 1.8 + time * 0.05, 5.0)) * 0.04;
        float ribbon3 = smoothstep(ribbon3Width, 0.0, ribbon3Dist);
        ribbon3 *= smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.5, uv.x);

        // Combine ribbons with soft glow
        glow = ribbon1 * 0.7 + ribbon2 * 0.5 + ribbon3 * 0.4;

        // Add diffuse outer glow around ribbons
        float outerGlow1 = smoothstep(ribbon1Width * 4.0, 0.0, ribbon1Dist) * 0.3;
        float outerGlow2 = smoothstep(ribbon2Width * 4.0, 0.0, ribbon2Dist) * 0.25;
        float outerGlow3 = smoothstep(ribbon3Width * 4.0, 0.0, ribbon3Dist) * 0.2;
        float outerGlow = outerGlow1 + outerGlow2 + outerGlow3;

        glow += outerGlow * 0.5;

        // Soft noise modulation for natural variation
        float noiseMod = fbm(uv * 3.0 + time * 0.1) * 0.4 + 0.6;
        glow *= noiseMod;

        // Edge fade
        float edgeFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x);
        edgeFade *= smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
        glow *= edgeFade;

        // COLOR GRADIENT: deep blue at edges -> green core -> white at brightest peaks
        vec3 deepBlue = vec3(0.1, 0.15, 0.6);    // Strong blue
        vec3 blue = vec3(0.15, 0.3, 0.7);         // Medium blue
        vec3 teal = vec3(0.1, 0.55, 0.6);         // Blue-green transition
        vec3 green = vec3(0.2, 0.9, 0.45);        // Vibrant green
        vec3 brightGreen = vec3(0.5, 1.0, 0.55);  // Bright green
        vec3 whiteGreen = vec3(0.8, 1.0, 0.85);   // White-ish for peaks

        // Color based on distance from ribbon center (not just intensity)
        // Outer edges = blue, inner core = green, very center = white
        float coreIntensity = glow;

        // Start with blue for the diffuse outer glow
        vec3 color = deepBlue;

        // Transition through colors based on intensity
        color = mix(color, blue, smoothstep(0.05, 0.15, coreIntensity));
        color = mix(color, teal, smoothstep(0.12, 0.25, coreIntensity));
        color = mix(color, green, smoothstep(0.2, 0.4, coreIntensity));
        color = mix(color, brightGreen, smoothstep(0.35, 0.6, coreIntensity));
        color = mix(color, whiteGreen, smoothstep(0.5, 0.85, coreIntensity) * 0.7);

        // Ensure blue shows in outer glow regions
        float outerRegion = outerGlow / (glow + 0.001);
        color = mix(color, deepBlue * 1.5, outerRegion * 0.4);

        // Final output - lower multiplier to prevent washing out
        float alpha = glow * 0.6;
        alpha = pow(alpha, 0.7);

        gl_FragColor = vec4(color * (0.8 + coreIntensity * 0.7), alpha * 0.65);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), [])

  useFrame((state) => { material.uniforms.uTime.value = state.clock.getElapsedTime() })

  return (
    <group>
      {/* Main aurora sheet - large coverage */}
      <mesh position={[0, 60, -40]} rotation={[-1.1, 0, 0]}>
        <planeGeometry args={[350, 200, 1, 1]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* Second layer offset for depth */}
      <mesh position={[30, 80, -100]} rotation={[-0.9, -0.1, 0.1]}>
        <planeGeometry args={[300, 180, 1, 1]} />
        <primitive object={material.clone()} attach="material" />
      </mesh>
    </group>
  )
}

const MountainRange = () => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uRockColor: { value: new THREE.Color("#010101") }, uSnowColor: { value: new THREE.Color("#a0b0d0") } },
    vertexShader: `varying float vHeight; void main() { vHeight = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vHeight; uniform vec3 uRockColor; uniform vec3 uSnowColor; void main() { float snowLine = smoothstep(0.5, 0.95, vHeight); float shadow = smoothstep(0.0, 0.4, vHeight); vec3 col = mix(uRockColor, uSnowColor, snowLine); gl_FragColor = vec4(col * shadow, 1.0); }`,

  }), [])
  const peaks = useMemo(() => {
    const temp = []; for (let i = 0; i < 90; i++) {
      const angle = (i / 90) * Math.PI * 2 + Math.random() * 0.2; const dist = 1200 + Math.random() * 1000;
      temp.push({ pos: [Math.cos(angle) * dist, -60, Math.sin(angle) * dist], scale: [300 + Math.random() * 500, 300 + Math.random() * 800, 300 + Math.random() * 500], rot: Math.random() * Math.PI, sides: Math.floor(Math.random() * 2) + 3 })
    } return temp;
  }, [])
  return <group>{peaks.map((p, i) => <mesh key={i} position={p.pos} rotation={[0, p.rot, 0]} scale={p.scale} frustumCulled={false}><cylinderGeometry args={[0, 1.2, 1, p.sides]} /><primitive object={mat} attach="material" /></mesh>)}</group>
}

const Fireplace = ({ position, active }) => {
  const lightRef = useRef()
  useFrame((state) => { if (lightRef.current && active) lightRef.current.intensity = 12 + Math.sin(state.clock.elapsedTime * 3) * 4 })
  return (
    <group position={position}>
      <mesh position={[0, 2, 0]} castShadow><boxGeometry args={[5, 4.5, 2]} /><meshStandardMaterial color="#080808" roughness={1} /></mesh>
      <mesh position={[0, 1.2, 0.2]}><boxGeometry args={[3.5, 2.5, 1.8]} /><meshStandardMaterial color="#000" /></mesh>
      <mesh position={[0, 0.4, 0.7]}><boxGeometry args={[2.5, 0.3, 0.8]} /><meshStandardMaterial color={active ? "#993300" : "#050505"} emissive={active ? "#772200" : "#000"} emissiveIntensity={active ? 18 : 0} /></mesh>
      {active && <pointLight ref={lightRef} color="#ff7700" distance={35} decay={1.5} intensity={11} castShadow />}
    </group>
  )
}

// ─── CONFETTI PARTICLE ───────────────────────────────────────────────────
const CONFETTI_COLORS = ['#ff4444', '#44ff88', '#4488ff', '#ffff44', '#ff44ff', '#44ffff', '#ffaa44']
const ConfettiParticle = ({ initPos, vel, color }) => {
  const meshRef = useRef()
  const lifeRef = useRef(0)
  const velRef = useRef([...vel])
  useFrame((state, delta) => {
    if (!meshRef.current) return
    lifeRef.current += delta
    velRef.current[1] -= 12 * delta // gravity
    meshRef.current.position.x += velRef.current[0] * delta
    meshRef.current.position.y += velRef.current[1] * delta
    meshRef.current.position.z += velRef.current[2] * delta
    meshRef.current.rotation.x += 4 * delta
    meshRef.current.rotation.z += 3 * delta
    const opacity = Math.max(0, 1 - lifeRef.current / 2.5)
    if (meshRef.current.material) meshRef.current.material.opacity = opacity
  })
  return (
    <mesh ref={meshRef} position={initPos}>
      <planeGeometry args={[0.22, 0.14]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={1} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

const ConfettiEmitter = ({ active }) => {
  const particles = useMemo(() => {
    if (!active) return []
    return Array.from({ length: 40 }, (_, i) => ({
      initPos: [
        HOOP_RIM_WORLD.x + (Math.random() - 0.5) * 2.5,
        HOOP_RIM_WORLD.y + 0.3,
        HOOP_RIM_WORLD.z + (Math.random() - 0.5) * 2.5,
      ],
      vel: [(Math.random() - 0.5) * 12, 4 + Math.random() * 7, (Math.random() - 0.5) * 12],
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  if (!active) return null
  return (
    <>
      {particles.map((p, i) => <ConfettiParticle key={i} {...p} />)}
    </>
  )
}
// ────────────────────────────────────────────────────────────────────────────

// ─── ROCKET-POWERED BASKETBALL HOOP ──────────────────────────────────────
const HoopWithThrusters = () => {
  const flameRefs = [useRef(), useRef(), useRef(), useRef()]
  useFrame((state) => {
    const t = state.clock.elapsedTime
    flameRefs.forEach((r, i) => {
      if (!r.current) return
      r.current.scale.y = 0.75 + Math.sin(t * 9 + i * 1.7) * 0.28
      r.current.position.y = -0.52 + Math.sin(t * 9 + i * 1.7) * 0.04
    })
  })
  // Thruster positions in local XZ (below backboard, 2x2 grid)
  const thrusterXZ = [[-0.7, -0.45], [0.7, -0.45], [-0.7, 0.45], [0.7, 0.45]]
  return (
    <group position={HOOP_POS} rotation={[0, HOOP_ROT_Y, 0]}>

      {/* ── BACKBOARD ── */}
      {/* Main board — dark tinted glass (enlarged) */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[5.4, 3.6, 0.12]} />
        <meshStandardMaterial color="#0a1025" transparent opacity={0.82} emissive="#1a2060" emissiveIntensity={0.25} />
      </mesh>
      {/* Glowing border frame (matches enlarged board) */}
      {[
        [0,   1.86, 0.07, 5.44, 0.09, 0.1],
        [0,  -1.86, 0.07, 5.44, 0.09, 0.1],
        [-2.76, 0, 0.07, 0.09, 3.72, 0.1],
        [ 2.76, 0, 0.07, 0.09, 3.72, 0.1],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#60aaff" emissive="#60aaff" emissiveIntensity={2.5} />
        </mesh>
      ))}
      {/* Target square */}
      {[
        [0,  -0.27, 0.08, 1.1, 0.055, 0.05],
        [0,  -0.87, 0.08, 1.1, 0.055, 0.05],
        [-0.575, -0.57, 0.08, 0.055, 0.66, 0.05],
        [ 0.575, -0.57, 0.08, 0.055, 0.66, 0.05],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} transparent opacity={0.8} />
        </mesh>
      ))}

      {/* ── RIM ── */}
      <group position={[0, -0.98, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.76, 0.045, 10, 36]} />
          <meshStandardMaterial color="#cc3300" emissive="#882200" emissiveIntensity={0.6} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* ── NET — rings + strings ── */}
      <group position={[0, -0.98, -0.9]}>
        {[0.22, 0.48, 0.70, 0.88].map((depth, i) => (
          <mesh key={i} position={[0, -depth * 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.76 - depth * 0.16, 0.012, 5, 24]} />
            <meshStandardMaterial color="#cccccc" transparent opacity={0.65} />
          </mesh>
        ))}
        {Array.from({ length: 14 }).map((_, i) => {
          const a = (i / 14) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.68, -0.28, Math.sin(a) * 0.68]}>
              <cylinderGeometry args={[0.009, 0.007, 0.6, 3]} />
              <meshStandardMaterial color="#cccccc" transparent opacity={0.65} />
            </mesh>
          )
        })}
      </group>

      {/* ── THRUSTER MOUNT PLATE ── */}
      <mesh position={[0, -1.72, 0]} castShadow>
        <boxGeometry args={[2.0, 0.22, 1.1]} />
        <meshStandardMaterial color="#4a4a6a" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* ── 4 THRUSTERS ── */}
      {thrusterXZ.map(([tx, tz], i) => (
        <group key={i} position={[tx, -1.72, tz]}>
          {/* housing */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.26, 0.55, 10]} />
            <meshStandardMaterial color="#383858" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* nozzle flare */}
          <mesh position={[0, -0.36, 0]}>
            <cylinderGeometry args={[0.19, 0.25, 0.22, 10]} />
            <meshStandardMaterial color="#22223a" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* flame cone */}
          <mesh ref={flameRefs[i]} position={[0, -0.52, 0]}>
            <coneGeometry args={[0.17, 0.55, 10]} />
            <meshStandardMaterial color="#ff7700" emissive="#ff5500" emissiveIntensity={4} transparent opacity={0.88} />
          </mesh>
          {/* Glow light from first thruster pair */}
          {i < 2 && <pointLight color="#ff6600" intensity={1.8} distance={5} decay={2} position={[0, -0.7, 0]} />}
        </group>
      ))}
    </group>
  )
}

// ─── PIANO KEY — clickable, drag-playable, only while seated at the bench ──
// Raycasting is swapped out entirely when not playable so 88 extra meshes cost
// the pointer-event system nothing during normal walking around.
const MESH_RAYCAST = THREE.Mesh.prototype.raycast
const NULL_RAYCAST = () => null
const PianoKey = ({ x, black, midi, playable, onKeyPlayed }) => {
  const ref = useRef()
  const noteRef = useRef(null)
  const baseY = LEG_HEIGHT + (black ? 0.065 : 0.025)

  const press = () => {
    if (noteRef.current) return
    noteRef.current = pianoNoteOn(midi)
    onKeyPlayed?.()
    if (ref.current) ref.current.position.y = baseY - (black ? 0.028 : 0.02)
  }
  const release = () => {
    if (!noteRef.current) return
    pianoNoteOff(noteRef.current)
    noteRef.current = null
    if (ref.current) ref.current.position.y = baseY
  }

  // Standing up mid-note: damp it and reset the key
  useEffect(() => { if (!playable) release() }, [playable])

  return (
    <mesh
      ref={ref}
      position={[x, baseY, black ? -0.205 : -0.15]}
      castShadow
      receiveShadow={!black}
      raycast={playable ? MESH_RAYCAST : NULL_RAYCAST}
      onPointerDown={(e) => { e.stopPropagation(); press() }}
      onPointerOver={(e) => { e.stopPropagation(); if (e.buttons & 1) press(); document.body.style.cursor = 'pointer' }}
      onPointerUp={() => release()}
      onPointerOut={() => { release(); document.body.style.cursor = 'auto' }}
    >
      {black
        ? <boxGeometry args={[0.023, 0.07, BLACK_KEY_LEN]} />
        : <boxGeometry args={[PIANO_WHITE_PITCH * 0.92, 0.05, WHITE_KEY_LEN]} />}
      <meshStandardMaterial color={black ? '#0d0d0d' : '#f5f0e6'} roughness={black ? 0.4 : 0.5} />
    </mesh>
  )
}

// ─── GRAND PIANO — corner decoration, tail nestled into the (-60,-60) corner ─
const GrandPiano = ({ playable, onKeyPlayed }) => {
  const caseGeo = useMemo(() => new THREE.ExtrudeGeometry(buildWingShape(0), {
    depth: CASE_RIM_HEIGHT,
    bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2,
    steps: 1, curveSegments: 24,
  }), [])

  const lidGeo = useMemo(() => new THREE.ExtrudeGeometry(buildWingShape(-BASS_X), {
    depth: LID_THICKNESS,
    bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1,
    steps: 1, curveSegments: 24,
  }), [])

  const legs = [
    [-1.15, -0.35], // front-left (bass)
    [1.15, -0.35],  // front-right (treble)
    [0.30, -2.70],  // back, under the belly
  ]

  const keys = useMemo(() => (
    PIANO_KEY_SEQUENCE.map((k, i) => {
      const whiteIndex = PIANO_KEY_SEQUENCE.slice(0, i).filter((kk) => !kk.black).length
      return k.black
        ? { x: -PIANO_KB_HALF + PIANO_WHITE_PITCH * whiteIndex, black: true }
        : { x: -PIANO_KB_HALF + PIANO_WHITE_PITCH * (whiteIndex + 0.5), black: false }
    })
  ), [])

  return (
    <group position={PIANO_POS} rotation={[0, PIANO_ROT_Y, 0]} scale={PIANO_SCALE} userData={{ type: 'piano' }}>
      {/* case */}
      <mesh geometry={caseGeo} position={[0, LEG_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#0a0a0a" roughness={0.42} metalness={0.12} />
      </mesh>

      {/* lid — hinged along the spine (bass) edge, propped open toward the room */}
      <group position={[BASS_X, CASE_TOP_Y, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(LID_OPEN_DEG)]}>
        <mesh geometry={lidGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <meshStandardMaterial color="#0a0a0a" roughness={0.4} metalness={0.12} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* legs */}
      {legs.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, LEG_HEIGHT / 2, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.065, LEG_HEIGHT, 8]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.45} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.5} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* keybed — sits in the cheek-block notch, under the keys */}
      <mesh position={[0, LEG_HEIGHT - 0.05, -KEY_NOTCH_DEPTH / 2]} receiveShadow>
        <boxGeometry args={[KEYBOARD_WIDTH + 0.1, 0.1, KEY_NOTCH_DEPTH]} />
        <meshStandardMaterial color="#1a1108" roughness={0.5} />
      </mesh>

      {/* keyboard — 88 real keys, A0 (midi 21) through C8 (midi 108) */}
      {keys.map((k, i) => (
        <PianoKey key={i} x={k.x} black={k.black} midi={21 + i} playable={playable} onKeyPlayed={onKeyPlayed} />
      ))}

      {/* music desk */}
      <group position={[0, LEG_HEIGHT + 0.35, -0.55]} rotation={[-0.35, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[2.0, 0.5, 0.04]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[0, LEG_HEIGHT + 0.12, -0.42]}>
        <cylinderGeometry args={[0.02, 0.02, 0.25, 6]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

// ─── PIANO BENCH — sittable, matches the Chair's hover-glow pattern ───────
const PianoBench = ({ isHovered }) => {
  const groupRef = useRef()
  const scaleRef = useRef(1)
  const seatMatRef = useRef()

  useFrame((_, delta) => {
    const target = isHovered ? 1.07 : 1.0
    scaleRef.current = fpsLerp(scaleRef.current, target, 0.1, delta)
    if (groupRef.current) groupRef.current.scale.setScalar(scaleRef.current * PIANO_SCALE)
    const emTarget = isHovered ? 0.35 : 0.0
    if (seatMatRef.current) seatMatRef.current.emissiveIntensity = fpsLerp(seatMatRef.current.emissiveIntensity, emTarget, 0.1, delta)
  })

  const legs = [
    [-(BENCH_LENGTH / 2 - 0.15), BENCH_LEG_HEIGHT / 2, -(BENCH_DEPTH / 2 - 0.1)],
    [(BENCH_LENGTH / 2 - 0.15), BENCH_LEG_HEIGHT / 2, -(BENCH_DEPTH / 2 - 0.1)],
    [-(BENCH_LENGTH / 2 - 0.15), BENCH_LEG_HEIGHT / 2, (BENCH_DEPTH / 2 - 0.1)],
    [(BENCH_LENGTH / 2 - 0.15), BENCH_LEG_HEIGHT / 2, (BENCH_DEPTH / 2 - 0.1)],
  ]

  return (
    <group ref={groupRef} position={BENCH_POS} rotation={[0, PIANO_ROT_Y, 0]} userData={{ interactive: true, type: 'pianoBench' }}>
      <mesh position={[0, BENCH_LEG_HEIGHT + BENCH_SEAT_THICK / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BENCH_LENGTH, BENCH_SEAT_THICK, BENCH_DEPTH]} />
        <meshStandardMaterial ref={seatMatRef} color="#3d260b" emissive="#7a5320" emissiveIntensity={0} />
      </mesh>
      {legs.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.12, BENCH_LEG_HEIGHT, 0.12]} />
          <meshStandardMaterial color="#1a1105" />
        </mesh>
      ))}
    </group>
  )
}

// ─── BASKETBALL ───────────────────────────────────────────────────────────
const BasketballMesh = ({ meshRef }) => (
  <group ref={meshRef} position={BALL_SPAWN} userData={{ interactive: true, type: 'basketball' }}>
    <mesh castShadow>
      <sphereGeometry args={[0.40, 18, 14]} />
      <meshStandardMaterial color="#e05a12" roughness={0.72} />
    </mesh>
    {/* longitude seams */}
    {[0, Math.PI / 2].map((r, i) => (
      <mesh key={i} rotation={[0, r, 0]}>
        <torusGeometry args={[0.405, 0.013, 5, 40]} />
        <meshStandardMaterial color="#110500" roughness={0.8} />
      </mesh>
    ))}
    {/* equator seam */}
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.405, 0.013, 5, 40]} />
      <meshStandardMaterial color="#110500" roughness={0.8} />
    </mesh>
    {/* hemisphere seams */}
    {[-1, 1].map((s, i) => (
      <mesh key={i} position={[0, s * 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.338, 0.011, 5, 36]} />
        <meshStandardMaterial color="#110500" roughness={0.8} />
      </mesh>
    ))}
  </group>
)
// ────────────────────────────────────────────────────────────────────────────

// ─── In-computer OS icons — real brand marks, kept calm & de-saturated ────
// currentColor lets the tile control the tone (muted slate → brightens on hover),
// so they read as clean monochrome logos rather than their loud native colors.
const GithubIcon = (p) => (
  <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" {...p}>
    <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-1.7c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
  </svg>
)
const LinkedinIcon = (p) => (
  <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" {...p}>
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
  </svg>
)
const MailIcon = (p) => (
  <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" {...p}>
    <path d="M2 4h20c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H2c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Zm0 2v.4l10 6.2 10-6.2V6H2Zm20 2.9-9.47 5.87a1 1 0 0 1-1.06 0L2 8.9V18h20V8.9Z" />
  </svg>
)
const CONTACT_ICONS = { github: GithubIcon, linkedin: LinkedinIcon, email: MailIcon }

const ContactTile = ({ type, label, href, sub }) => {
  const [h, setH] = useState(false)
  const Icon = CONTACT_ICONS[type]
  const isMail = href.startsWith('mailto:')
  return (
    <a
      href={href}
      target={isMail ? undefined : '_blank'}
      rel="noreferrer"
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        textDecoration: 'none', width: '150px', padding: '20px 14px', borderRadius: '12px',
        // Calm, de-saturated slate — brightens softly on hover (no brand colors)
        color: h ? '#e6edf6' : '#8b9bb4',
        border: `1px solid ${h ? 'rgba(214,224,238,0.45)' : 'rgba(139,155,180,0.22)'}`,
        background: h ? 'rgba(214,224,238,0.06)' : 'rgba(139,155,180,0.03)',
        boxShadow: h ? '0 0 22px rgba(180,200,230,0.18)' : 'none',
        transform: h ? 'translateY(-3px)' : 'none',
        transition: 'all 0.2s ease', fontFamily: "'Courier New', monospace",
      }}
    >
      <Icon width={36} height={36} />
      <span style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px' }}>{label}</span>
      <span style={{ fontSize: '10px', opacity: 0.75, textAlign: 'center', wordBreak: 'break-all' }}>{sub}</span>
    </a>
  )
}

// Home desktop app launcher tile
const AppTile = ({ app, onOpen }) => {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        cursor: 'pointer', background: h ? `${app.color}18` : 'transparent',
        border: `2px solid ${app.color}`, color: app.color, borderRadius: '8px',
        padding: '20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        fontFamily: "'Courier New', monospace",
        boxShadow: h ? `0 0 24px ${app.color}66` : `0 0 8px ${app.color}22`,
        transform: h ? 'translateY(-3px)' : 'none', transition: 'all 0.18s ease',
      }}
    >
      <span style={{ fontSize: '30px', textShadow: `0 0 12px ${app.color}` }}>{app.glyph}</span>
      <span style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>{app.label}</span>
      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{app.desc}</span>
    </button>
  )
}

// Shared window chrome — hosts the top-left BACK button every sub-screen needs
const WindowChrome = ({ title, accent, onBack, right, children }) => {
  const [bh, setBh] = useState(false)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 20 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
        borderBottom: `1px solid ${accent}55`, background: 'rgba(0,0,0,0.35)', flexShrink: 0,
      }}>
        {/* ← top-left back button */}
        <button
          onClick={onBack}
          onMouseEnter={() => setBh(true)}
          onMouseLeave={() => setBh(false)}
          style={{
            cursor: 'pointer', background: bh ? accent : 'transparent',
            color: bh ? '#0a0f1a' : accent, border: `2px solid ${accent}`, borderRadius: '6px',
            padding: '5px 12px', fontFamily: "'Courier New', monospace", fontWeight: 'bold',
            fontSize: '12px', boxShadow: `0 0 10px ${accent}55`, transition: 'all 0.15s ease',
          }}
        >
          ‹ BACK
        </button>
        <span style={{ color: accent, fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', textShadow: `0 0 10px ${accent}` }}>{title}</span>
        <span style={{ marginLeft: 'auto' }}>{right}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}

// ── PROJECTS.EXE — rebuilds from the PROJECTS array (fully modular) ──
const ProjectCard = ({ p }) => {
  const [h, setH] = useState(false)
  const [ghHover, setGhHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative',
        border: `1px solid ${h ? 'rgba(56,189,248,0.6)' : 'rgba(56,189,248,0.22)'}`,
        borderRadius: '8px', padding: '14px 16px',
        background: h ? 'rgba(56,189,248,0.06)' : 'rgba(56,189,248,0.02)',
        boxShadow: h ? '0 0 20px rgba(56,189,248,0.15)' : 'none', transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
        <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '16px', textShadow: '0 0 8px rgba(56,189,248,0.5)' }}>{p.title}</h3>
        {p.link && (
          <a href={p.link} target="_blank" rel="noreferrer" style={{ color: '#4ade80', fontSize: '11px', textDecoration: 'none', fontWeight: 'bold', whiteSpace: 'nowrap' }}>VIEW →</a>
        )}
      </div>
      <p style={{ margin: '8px 0 10px', fontSize: '12px', lineHeight: 1.5, color: '#cbd5e1' }}>{p.blurb}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingRight: '28px' }}>
        {p.tech.map(t => (
          <span key={t} style={{ fontSize: '10px', color: '#94a3b8', border: '1px solid #334155', borderRadius: '4px', padding: '2px 7px' }}>{t}</span>
        ))}
      </div>
      {p.repo && (
        <a
          href={p.repo} target="_blank" rel="noreferrer" title="View source on GitHub"
          onMouseEnter={() => setGhHover(true)}
          onMouseLeave={() => setGhHover(false)}
          style={{
            position: 'absolute', bottom: '10px', right: '12px', display: 'flex',
            color: ghHover ? '#e2e8f0' : '#64748b', transition: 'color 0.2s ease',
          }}
        >
          <GithubIcon width={18} height={18} />
        </a>
      )}
    </div>
  )
}
const ProjectsView = () => (
  <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
    {PROJECTS.map((p, i) => <ProjectCard key={i} p={p} />)}
  </div>
)

// ── RESUME.PDF — native browser PDF viewer (zoom / scroll / download) ──
const ResumeView = () => (
  <iframe
    title="Resume"
    src={`${RESUME_URL}#view=FitH`}
    style={{ width: '100%', height: '100%', border: 'none', background: '#525659', display: 'block' }}
  />
)

// ── CONTACT.SH — calm monochrome social links ──
const ContactView = () => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '24px' }}>
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ margin: 0, color: '#e6edf6', fontSize: '20px', letterSpacing: '3px' }}>LET&apos;S CONNECT</h2>
      <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8' }}>Reach me through any of these channels.</p>
    </div>
    <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <ContactTile type="github"   label="GITHUB"   href={CONTACT.github.url}   sub={CONTACT.github.handle} />
      <ContactTile type="linkedin" label="LINKEDIN" href={CONTACT.linkedin.url} sub={CONTACT.linkedin.handle} />
      <ContactTile type="email"    label="EMAIL"    href={CONTACT.email.url}    sub={CONTACT.email.handle} />
    </div>
  </div>
)

const Computer = ({ pcOn, isSitting }) => {
  const screenMat = useRef()
  const [screen, setScreen] = useState('home') // 'home' | 'projects' | 'resume' | 'contact'

  // Always boot back to the desktop whenever the PC is powered off
  useEffect(() => { if (!pcOn) setScreen('home') }, [pcOn])

  useFrame((state, delta) => {
    if (screenMat.current) {
      const targetIntensity = pcOn ? 0.8 : 0
      screenMat.current.emissiveIntensity = fpsLerp(screenMat.current.emissiveIntensity, targetIntensity, 0.1, delta)
    }
  })

  const apps = [
    { id: 'projects', label: 'PROJECTS.EXE', color: '#38bdf8', glyph: '▤', desc: 'Selected work' },
    { id: 'resume',   label: 'RESUME.PDF',   color: '#a855f7', glyph: '▦', desc: 'Résumé / CV' },
    { id: 'contact',  label: 'CONTACT.SH',   color: '#4ade80', glyph: '▣', desc: 'Get in touch' },
  ]
  const accents = { projects: '#38bdf8', resume: '#a855f7', contact: '#4ade80' }
  const titles = { projects: 'PROJECTS.EXE', resume: 'RESUME.PDF', contact: 'CONTACT.SH' }

  return (
    <group position={[0, 3.5, -1.5]} userData={{ interactive: true, type: 'computer' }}>
      <mesh castShadow>
        <boxGeometry args={[4.5, 2.8, 0.1]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[4.2, 2.5]} />
        <meshStandardMaterial
          ref={screenMat}
          emissive={pcOn ? "#0c1b3d" : "#000"}
          color="#000"
        />
      </mesh>

      {/* Screen UI rendered in 3D space — real DOM so links, the PDF viewer and
          scrolling all work natively */}
      {pcOn && isSitting && (
        <Html transform position={[0, 0, 0.08]} scale={0.21}>
          <div
            style={{
              width: '760px',
              height: '440px',
              background: '#0a0f1a',
              color: 'white',
              fontFamily: "'Courier New', monospace",
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 80px rgba(56, 189, 248, 0.1)',
              position: 'relative',
              pointerEvents: 'auto',
            }}
          >
            {/* HOME DESKTOP */}
            {screen === 'home' && (
              <div style={{ position: 'absolute', inset: 0, padding: '24px', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
                <h1 style={{ color: '#38bdf8', fontSize: '24px', textShadow: '0 0 15px #38bdf8', margin: '0 0 6px' }}>
                  {'>'} SYSTEM_ONLINE
                </h1>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 22px' }}>
                  Welcome to the portfolio terminal. Select a program.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  {apps.map(a => <AppTile key={a.id} app={a} onOpen={() => setScreen(a.id)} />)}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569', borderTop: '1px solid #1e3a5f', paddingTop: '8px' }}>
                  <span>USER: GUEST</span>
                  <span style={{ color: '#4ade80' }}>● ONLINE</span>
                  <span>ESC TO EXIT</span>
                </div>
              </div>
            )}

            {/* SUB-WINDOWS — each carries the top-left BACK button via WindowChrome */}
            {screen !== 'home' && (
              <WindowChrome
                title={titles[screen]}
                accent={accents[screen]}
                onBack={() => setScreen('home')}
                right={screen === 'resume' ? (
                  <a
                    href={RESUME_URL}
                    download
                    style={{ color: '#a855f7', border: '2px solid #a855f7', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', boxShadow: '0 0 10px #a855f755' }}
                  >
                    ↓ DOWNLOAD
                  </a>
                ) : null}
              >
                {screen === 'projects' && <ProjectsView />}
                {screen === 'resume' && <ResumeView />}
                {screen === 'contact' && <ContactView />}
              </WindowChrome>
            )}

            {/* CRT overlays — pointerEvents:none so they never block clicks */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
              pointerEvents: 'none', zIndex: 100, borderRadius: '8px',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
              pointerEvents: 'none', zIndex: 99, borderRadius: '8px',
            }} />
          </div>
        </Html>
      )}
    </group>
  )
}

const Peripherals = () => {
  return (
    <group position={[0, 1.7, 1.5]}>
      {/* Mechanical Keyboard */}
      <group position={[0, 0, 0]}>
        {/* Keyboard base */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[4, 0.1, 1.5]} />
          <meshStandardMaterial 
            color="#8b7355" 
            roughness={0.6}
            
          />
        </mesh>
        
        {/* Keyboard frame/bezel */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[4.1, 0.05, 1.6]} />
          <meshStandardMaterial 
            color="#b8a888" 
            roughness={0.7}
            
          />
        </mesh>

        {/* Keycaps - create a grid of keys */}
        {Array.from({ length: 6 }).map((_, row) => 
          Array.from({ length: 15 }).map((_, col) => {
            const x = -1.8 + col * 0.25
            const z = -0.5 + row * 0.25
            const isSpacebar = row === 5 && col >= 5 && col <= 9
            
            if (isSpacebar && col > 5) return null
            
            return (
              <mesh 
                key={`${row}-${col}`} 
                position={[x, 0.18, z]} 
                castShadow
              >
                <boxGeometry args={isSpacebar ? [1.2, 0.12, 0.2] : [0.2, 0.12, 0.2]} />
                <meshStandardMaterial 
                  color="#a0907a" 
                  roughness={0.5}
                  metalness={0.05}
                  
                />
              </mesh>
            )
          })
        )}
        
        {/* Mechanical switches visible between keys */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`switch-${i}`} position={[-1 + i * 0.7, 0.13, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.08, 8]} />
            <meshStandardMaterial 
              color="#8b7355" 
              metalness={0.4} 
              roughness={0.3}
              
            />
          </mesh>
        ))}

        {/* Keyboard cable */}
        <mesh position={[0, 0.05, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.3]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>

      {/* Mouse */}
      <group position={[3, 0, 0.3]}>
        {/* Mouse body */}
        <mesh position={[0, 0.08, 0]} castShadow>
          <boxGeometry args={[0.5, 0.16, 0.7]} />
          <meshStandardMaterial 
            color="#8b7355" 
            roughness={0.5}
            
          />
        </mesh>
        
        {/* Mouse top (slightly rounded) */}
        <mesh position={[0, 0.16, -0.05]} rotation={[-0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.48, 0.08, 0.55]} />
          <meshStandardMaterial 
            color="#a0907a" 
            roughness={0.4}
           
          />
        </mesh>

        {/* Left mouse button */}
        <mesh position={[-0.12, 0.17, -0.15]} castShadow>
          <boxGeometry args={[0.2, 0.02, 0.35]} />
          <meshStandardMaterial 
            color="#c2b49a" 
            roughness={0.5}
            
          />
        </mesh>

        {/* Right mouse button */}
        <mesh position={[0.12, 0.17, -0.15]} castShadow>
          <boxGeometry args={[0.2, 0.02, 0.35]} />
          <meshStandardMaterial 
            color="#c2b49a" 
            roughness={0.5}
           
          />
        </mesh>

        {/* Scroll wheel */}
        <mesh position={[0, 0.19, -0.15]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.12, 16]} />
          <meshStandardMaterial 
            color="#888" 
            roughness={0.4} 
            metalness={0.3}
            
          />
        </mesh>

        {/* Mouse cable */}
        <mesh position={[0, 0.04, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.25]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
    </group>
  )
}
const Snow = ({ count = 10000 }) => {
  const mesh = useRef(); const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    const temp = []; for (let i = 0; i < count; i++) temp.push({ speed: 0.02 + Math.random() * 0.03, pos: [Math.random() * 400 - 200, Math.random() * 100, Math.random() * 400 - 200] })
    return temp;
  }, [count])
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_DELTA) * BASELINE_FPS // baseline-equivalent step → same fall speed everywhere
    particles.forEach((particle, i) => { particle.pos[1] -= particle.speed * step; if (particle.pos[1] < 0) particle.pos[1] = 100; dummy.position.set(particle.pos[0], particle.pos[1], particle.pos[2]); dummy.updateMatrix(); mesh.current.setMatrixAt(i, dummy.matrix); });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[null, null, count]}><sphereGeometry args={[0.04, 4, 4]} /><meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.8} /></instancedMesh>
}
// ─── STATS COLLECTOR — reads renderer info each frame, pushes to the store so a
// plain DOM overlay (App.jsx) can render it. Toggled via the '+' key. ──────────
const StatsCollector = () => {
  const { gl } = useThree()
  const setStats = useStore((s) => s.setStats)
  const visible = useStore((s) => s.statsVisible)
  const acc = useRef({ t: 0, frames: 0 })

  useFrame((_, delta) => {
    acc.current.t += delta
    acc.current.frames++
    if (acc.current.t >= 0.5) {
      const fps = Math.round(acc.current.frames / acc.current.t)
      acc.current.t = 0; acc.current.frames = 0
      if (visible) {
        const r = gl.info.render, m = gl.info.memory
        setStats({
          fps,
          calls: r.calls,
          tris: Math.round(r.triangles / 1000),
          geometries: m.geometries,
          textures: m.textures,
          programs: gl.info.programs ? gl.info.programs.length : 0,
          heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0,
        })
      }
    }
  })

  return null
}
// ────────────────────────────────────────────────────────────────────────────

// Reusable scratch objects for the render loop — avoids allocating fresh
// Vector3 / Object3D every frame (less GC churn, zero visual change).
const _dir = new THREE.Vector3()
const _front = new THREE.Vector3()
const _side = new THREE.Vector3()
const _dummy = new THREE.Object3D()

export const Scene = () => {
  const { lampOn, toggleLamp, catPosition, moveCat, sitDown, sitAtPiano, view, standUp, pcOn, togglePc } = useStore()
  const isSitting = view === 'room' || view === 'piano'
  const { camera, raycaster, scene } = useThree()
  const [lookingAt, setLookingAt] = useState(null)
  const lookingAtRef = useRef(null)
  const [movement, setMovement] = useState({ forward: false, backward: false, left: false, right: false })
  // Sprint is a ref (not state): read every frame in useFrame, and toggling it
  // shouldn't re-render or re-bind the key handlers.
  const sprintRef = useRef(false)
  const spotlightRef = useRef()
  const lightTarget = useMemo(() => new THREE.Object3D(), [])
  const pianoLightTarget = useMemo(() => new THREE.Object3D(), [])
  const [pianoLightOn, setPianoLightOn] = useState(false)
  const pianoLightOnRef = useRef(false)
  const [zoomedIn, setZoomedIn] = useState(false)
  
  // Audio refs for sound effects
  const keyboardSound = useRef(null)
  const mouseClickSound = useRef(null)
  const catSound = useRef(null)
  const chairSound = useRef(null)
  const fireplaceSound = useRef(null)
  const lampSound = useRef(null)
  const mainMusic = useRef(null)
  const windSound = useRef(null)
  const windIntervalRef = useRef(null)
  const typingEffectSound = useRef(null)
  const shotMakeSound = useRef(null)
  const musicStartedRef = useRef(false)
  const prevCatPosition = useRef(catPosition)
  const prevView = useRef(view)
  const prevLampOn = useRef(lampOn)

  // Lamp hover animation refs
  const lampGroupRef = useRef()
  const lampScaleRef = useRef(1)
  const lampShadeMatRef = useRef()

  // Proximity prompt state
  const [proximityPrompt, setProximityPrompt] = useState(null)
  const proximityPromptRef = useRef(null)

  // Track first-interaction per object (for proximity prompts)
  const hasInteractedRef = useRef({ lamp: false, cat: false, chair: false, basketball: false, shot: false, pc: false, pianoBench: false, pianoKeys: false })

  // First piano note ever played dismisses the "click the keys" prompt
  const onPianoKeyPlayed = useCallback(() => { hasInteractedRef.current.pianoKeys = true }, [])

  // Snapshot of camera state taken the instant sitDown() fires — used to cancel the sit
  const preSitStateRef = useRef({ x: 0, y: 4, z: 0, rotX: 0, rotY: 0 })

  // Precomputed world positions for proximity checks
  const lampWorldPos = useMemo(() => new THREE.Vector3(-40 * STAGE_SCALE, 1.5, 50 * STAGE_SCALE), [])
  const chairWorldPos = useMemo(() => new THREE.Vector3(0, 0, 4.2 * STAGE_SCALE), [])

  // Basketball refs
  const basketballRef = useRef()
  const holdingBallRef = useRef(false)
  const chargingRef = useRef(false)
  const chargeLevelRef = useRef(0)
  const chargingUpRef = useRef(true)
  const ballInFlightRef = useRef(false)
  const flightTRef = useRef(0)
  const shotGoodRef = useRef(false)
  const ballStartRef = useRef(new THREE.Vector3())
  const cameraYOffsetRef = useRef(0)
  const chargeBarFillRef = useRef(null)
  const [holdingBall, setHoldingBall] = useState(false)
  const [confettiActive, setConfettiActive] = useState(false)

  const sitPos = useMemo(() => new THREE.Vector3(0, 3.8, 3.5 * STAGE_SCALE), [])
  const deskLookAt = useMemo(() => new THREE.Vector3(0, 3.5, 11.5 * STAGE_SCALE), [])

  // Helper: fade main music in on first user gesture
  const startMusicWithFade = () => {
    if (musicStartedRef.current || !mainMusic.current) return
    musicStartedRef.current = true
    mainMusic.current.volume = 0
    mainMusic.current.play().then(() => {
      const fadeDuration = 3000
      const fadeStart = Date.now()
      const fadeInterval = setInterval(() => {
        const progress = Math.min((Date.now() - fadeStart) / fadeDuration, 1)
        if (mainMusic.current) mainMusic.current.volume = progress * VOLUMES.mainMusic
        if (progress >= 1) clearInterval(fadeInterval)
      }, 50)
    }).catch(() => {})
  }

  // Initialize audio files
  useEffect(() => {
    keyboardSound.current = new Audio('/sounds/keyboard.mp3')
    keyboardSound.current.volume = VOLUMES.keyboard

    mouseClickSound.current = new Audio('/sounds/mouse.wav')
    mouseClickSound.current.volume = VOLUMES.mouseClick

    catSound.current = new Audio('/sounds/cat.wav')
    catSound.current.volume = VOLUMES.cat

    chairSound.current = new Audio('/sounds/chair.m4a')
    chairSound.current.volume = VOLUMES.chair

    lampSound.current = new Audio('/sounds/lamp.wav')
    lampSound.current.volume = VOLUMES.lamp

    fireplaceSound.current = new Audio('/sounds/fireplace.m4a')
    fireplaceSound.current.loop = true
    fireplaceSound.current.volume = VOLUMES.fireplace

    windSound.current = new Audio('/sounds/wind.mp3')
    windSound.current.volume = VOLUMES.wind

    mainMusic.current = new Audio('/sounds/mainMusic.mp3')
    mainMusic.current.loop = true
    mainMusic.current.volume = 0

    typingEffectSound.current = new Audio('/sounds/typingEffect.mp3')
    typingEffectSound.current.loop = true
    typingEffectSound.current.volume = VOLUMES.typingEffect

    shotMakeSound.current = new Audio('/sounds/shotMake.mp3')
    shotMakeSound.current.volume = 0.85

    // Attempt wind boost via Web Audio API GainNode (goes beyond HTMLAudio vol cap)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const gain = ctx.createGain()
      gain.gain.value = 3.0
      gain.connect(ctx.destination)
      const src = ctx.createMediaElementSource(windSound.current)
      src.connect(gain)
      // Resume context on first gesture (browser requirement)
      const resumeCtx = () => { ctx.resume(); window.removeEventListener('click', resumeCtx); window.removeEventListener('keydown', resumeCtx) }
      window.addEventListener('click', resumeCtx)
      window.addEventListener('keydown', resumeCtx)
    } catch (_) {
      // Web Audio API not supported — fall back to element volume (already set to 1.0)
    }
  }, [])

  // Fireplace sound: loop while fireplace is active (lamp off)
  useEffect(() => {
    if (!fireplaceSound.current) return
    if (!lampOn) {
      fireplaceSound.current.play().catch(() => {})
    } else {
      fireplaceSound.current.pause()
      fireplaceSound.current.currentTime = 0
    }
  }, [lampOn])

  // Wind sound: plays every 10–15 seconds
  useEffect(() => {
    const scheduleWind = () => {
      const delay = 10000 + Math.random() * 5000
      windIntervalRef.current = setTimeout(() => {
        if (windSound.current) {
          const s = windSound.current.cloneNode()
          s.volume = VOLUMES.wind
          s.play().catch(() => {})
        }
        scheduleWind()
      }, delay)
    }
    scheduleWind()
    return () => clearTimeout(windIntervalRef.current)
  }, [])

  // Typing effect sound: plays in sync with TypedText animation when prompt appears
  useEffect(() => {
    if (!typingEffectSound.current) return
    if (!proximityPrompt) {
      typingEffectSound.current.pause()
      typingEffectSound.current.currentTime = 0
      return
    }
    typingEffectSound.current.currentTime = 0
    typingEffectSound.current.play().catch(() => {})
    const duration = proximityPrompt.length * CHAR_DELAY_MS
    const timer = setTimeout(() => {
      if (typingEffectSound.current) {
        typingEffectSound.current.pause()
        typingEffectSound.current.currentTime = 0
      }
    }, duration)
    return () => {
      clearTimeout(timer)
      if (typingEffectSound.current) {
        typingEffectSound.current.pause()
        typingEffectSound.current.currentTime = 0
      }
    }
  }, [proximityPrompt])

  useEffect(() => {
    camera.position.set(-STAGE_BOUND, 4, STAGE_BOUND)
    camera.lookAt(0, 4, 0)
    camera.near = 0.05
    camera.far = 10000
    camera.updateProjectionMatrix()
    lightTarget.position.set(0, 0, -2 * STAGE_SCALE)
    scene.add(lightTarget)
    pianoLightTarget.position.set(PIANO_POS[0], 0, PIANO_POS[2])
    scene.add(pianoLightTarget)
  }, [camera, scene, lightTarget, pianoLightTarget])

  // Collect the ~handful of interactive objects once, so the per-frame crosshair
  // raycast tests only those instead of the ENTIRE scene graph (which includes the
  // 10k-instance snow mesh + 20k stars — ~30k ray tests/frame that murder fps on
  // weaker machines). Recollected if the scene structure changes.
  const interactiveObjsRef = useRef([])
  useEffect(() => {
    const list = []
    scene.traverse((o) => { if (o.userData && o.userData.interactive) list.push(o) })
    interactiveObjsRef.current = list
  }, [scene, catPosition, pcOn, lampOn, view])

  useEffect(() => {
const handleKeyDown = (e) => {
  startMusicWithFade()
  const keys = { KeyW: 'forward', KeyS: 'backward', KeyA: 'left', KeyD: 'right' }
  // The modifier flag is authoritative: true whether Shift was pressed before
  // or after WASD, false the moment it's released.
  sprintRef.current = e.shiftKey

  // Play keyboard sound if sitting (for ANY key press)
  if (isSitting && keyboardSound.current) {
    const sound = keyboardSound.current.cloneNode()
    sound.volume = VOLUMES.keyboard
    sound.play().catch(() => {})
  }

  if (keys[e.code] && !(isSitting && pcOn)) {
    setMovement(m => ({ ...m, [keys[e.code]]: true }))
    if (isSitting) {
      // Request pointer lock IMMEDIATELY while we still have user gesture
      if (!pcOn) {
        document.body.requestPointerLock()
          .then(() => {})
          .catch(() => {})
      }
      standUp()
      // Restore camera to the exact position + look-direction it had before sitting.
      // This prevents the partial sit animation leaving the camera at a wrong angle.
      const s = preSitStateRef.current
      camera.position.set(s.x, 4, s.z)
      camera.rotation.order = 'YXZ'
      camera.rotation.set(s.rotX, s.rotY, 0)
    }
  }
  if (e.code === 'Space') {
    e.preventDefault()
    if (isSitting) {
      togglePc()
      hasInteractedRef.current.pc = true
    } else if (holdingBallRef.current && !ballInFlightRef.current && !chargingRef.current) {
      // Start charging shot
      chargingRef.current = true
      chargingUpRef.current = true
    }
  }
}

  const handleKeyUp = (e) => {
    const keys = { KeyW: 'forward', KeyS: 'backward', KeyA: 'left', KeyD: 'right' }
    sprintRef.current = e.shiftKey
    if (keys[e.code]) {
      setMovement((m) => ({ ...m, [keys[e.code]]: false }))
    }
    if (e.code === 'Space' && chargingRef.current) {
      chargingRef.current = false
      if (!ballInFlightRef.current && basketballRef.current) {
        // Good shot if chargeLevel is within SHOT_GOOD_ZONE below 1.0
        shotGoodRef.current = chargeLevelRef.current >= (1.0 - SHOT_GOOD_ZONE)
        // Record ball world position as flight start
        basketballRef.current.getWorldPosition(ballStartRef.current)
        // Launch flight
        ballInFlightRef.current = true
        flightTRef.current = 0
        holdingBallRef.current = false
        setHoldingBall(false)
        // Mark shot as attempted (hide the SPACE prompt)
        hasInteractedRef.current.shot = true
        // Jump offset: camera pops up, then lerps back to 0
        cameraYOffsetRef.current = 0.6
      }
    }
  }

  const handleMouseDown = (e) => {
    startMusicWithFade()

    // Mouse click sound while PC is on (both left and right click)
    if (isSitting && pcOn && mouseClickSound.current) {
      const s = mouseClickSound.current.cloneNode()
      s.volume = VOLUMES.mouseClick
      s.play().catch(() => {})
    }

    // Don't handle scene clicks when PC is on - let the UI overlay handle them
    if (isSitting && pcOn) return

    // Pick up basketball
    if (lookingAtRef.current === 'basketball' && !holdingBallRef.current && !ballInFlightRef.current) {
      holdingBallRef.current = true
      setHoldingBall(true)
      hasInteractedRef.current.basketball = true
      return
    }

    // If holding ball and interacting with something else, drop it first
    if (holdingBallRef.current && lookingAtRef.current !== 'basketball') {
      holdingBallRef.current = false
      setHoldingBall(false)
      chargingRef.current = false
      chargeLevelRef.current = 0
    }

    if (lookingAtRef.current === 'lamp') {
      toggleLamp()
      hasInteractedRef.current.lamp = true
      if (lampSound.current) {
        const s = lampSound.current.cloneNode()
        s.volume = VOLUMES.lamp
        s.play().catch(() => {})
      }
    } else if (lookingAtRef.current === 'cat' && !lampOn) {
      moveCat()
      hasInteractedRef.current.cat = true
      if (catSound.current) {
        const s = catSound.current.cloneNode()
        s.volume = VOLUMES.cat
        s.play().catch(() => {})
      }
    } else if (lookingAtRef.current === 'chair' && catPosition === 'fireplace') {
      // Snapshot camera so we can restore if the player cancels mid-animation
      preSitStateRef.current = { x: camera.position.x, y: camera.position.y, z: camera.position.z, rotX: camera.rotation.x, rotY: camera.rotation.y }
      sitDown()
      hasInteractedRef.current.chair = true
      if (chairSound.current) {
        const s = chairSound.current.cloneNode()
        s.volume = VOLUMES.chair
        s.play().catch(() => {})
      }
    } else if (lookingAtRef.current === 'chair') {
      // Chair clicked but can't sit yet — no sound
      preSitStateRef.current = { x: camera.position.x, y: camera.position.y, z: camera.position.z, rotX: camera.rotation.x, rotY: camera.rotation.y }
      sitDown()
    } else if (lookingAtRef.current === 'pianoBench') {
      preSitStateRef.current = { x: camera.position.x, y: camera.position.y, z: camera.position.z, rotX: camera.rotation.x, rotY: camera.rotation.y }
      sitAtPiano()
      hasInteractedRef.current.pianoBench = true
      if (chairSound.current) {
        const s = chairSound.current.cloneNode()
        s.volume = VOLUMES.chair
        s.play().catch(() => {})
      }
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('mousedown', handleMouseDown)

  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('mousedown', handleMouseDown)
  }
}, [lampOn, catPosition, isSitting, toggleLamp, moveCat, sitDown, sitAtPiano, standUp, camera, togglePc, pcOn])

useEffect(() => {
  if (pcOn) {
    const timer = setTimeout(() => {
      setZoomedIn(true)
    }, 600)
    return () => clearTimeout(timer)
  } else {
    setZoomedIn(false)
  }
}, [pcOn])

// Release pointer lock the moment the player sits — ensures mouse is free for the PC
useEffect(() => {
  if (isSitting && document.pointerLockElement) {
    document.exitPointerLock()
  }
}, [isSitting])


// Add this useEffect after your other useEffects
useEffect(() => {
  const handleMouseMove = (e) => {
    if (document.pointerLockElement === document.body && !isSitting) {
      const sensitivity = 0.002
      
      camera.rotation.order = 'YXZ'
      camera.rotation.y -= e.movementX * sensitivity
      camera.rotation.x -= e.movementY * sensitivity
      
      // Clamp pitch
      camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x))
    }
  }

  window.addEventListener('mousemove', handleMouseMove)
  return () => window.removeEventListener('mousemove', handleMouseMove)
}, [camera, isSitting])

  useFrame((state, delta) => {
    if (isSitting) {
      let lookAtTarget
      if (view === 'piano') {
        state.camera.position.lerp(PIANO_BENCH_SIT_POS, fpsSlerpFactor(0.03, delta))
        lookAtTarget = PIANO_BENCH_LOOK_AT
      } else if (zoomedIn) {
        const zoomedPos = new THREE.Vector3(0, 3.5, -1.3 * STAGE_SCALE)
        state.camera.position.lerp(zoomedPos, fpsSlerpFactor(0.05, delta))
        lookAtTarget = deskLookAt
      } else {
        state.camera.position.lerp(sitPos, fpsSlerpFactor(0.03, delta))
        lookAtTarget = deskLookAt
      }

      const dummy = _dummy
      dummy.position.copy(state.camera.position)
      dummy.lookAt(lookAtTarget)

      state.camera.quaternion.slerp(dummy.quaternion, fpsSlerpFactor(0.03, delta))
      state.camera.updateMatrixWorld()
    } else {
      const dt = Math.min(delta, MAX_DELTA)
      // Distance travelled this frame = speed(units/sec) × seconds elapsed → frame-rate independent
      const velocity = MOVE_SPEED * (sprintRef.current ? SPRINT_MULTIPLIER : 1) * dt
      const direction = _dir
      const frontVector = _front.set(0, 0, Number(movement.backward) - Number(movement.forward))
      const sideVector = _side.set(Number(movement.left) - Number(movement.right), 0, 0)
      direction.subVectors(frontVector, sideVector).normalize().multiplyScalar(velocity).applyEuler(state.camera.rotation)
      state.camera.position.x = Math.max(-STAGE_BOUND, Math.min(STAGE_BOUND, state.camera.position.x + direction.x))
      state.camera.position.z = Math.max(-STAGE_BOUND, Math.min(STAGE_BOUND, state.camera.position.z + direction.z))

      // ── BASKETBALL PHYSICS ──────────────────────────────────────────────
      // Ball scale: full size (1.6) on floor, normal size (1.0) when held or in flight
      if (basketballRef.current) {
        const targetBallScale = (holdingBallRef.current || ballInFlightRef.current) ? 1.0 : 1.6
        const curScale = basketballRef.current.scale.x
        basketballRef.current.scale.setScalar(fpsLerp(curScale, targetBallScale, 0.12, dt))
      }

      // Ball held: float in front of camera
      if (holdingBallRef.current && basketballRef.current && !ballInFlightRef.current) {
        const forward = new THREE.Vector3(0, -0.25, -BALL_HOLD_DISTANCE)
        forward.applyQuaternion(state.camera.quaternion)
        basketballRef.current.position.copy(state.camera.position).add(forward)
        // Clamp to scene bounds even while held
        basketballRef.current.position.x = Math.max(-STAGE_BOUND, Math.min(STAGE_BOUND, basketballRef.current.position.x))
        basketballRef.current.position.z = Math.max(-STAGE_BOUND, Math.min(STAGE_BOUND, basketballRef.current.position.z))
      }

      // Charging: oscillate charge bar + crouch camera
      if (chargingRef.current && !ballInFlightRef.current) {
        cameraYOffsetRef.current = fpsLerp(cameraYOffsetRef.current, -0.5, 0.1, dt)
        if (chargingUpRef.current) {
          chargeLevelRef.current = Math.min(1.0, chargeLevelRef.current + SHOT_METER_SPEED * delta)
          if (chargeLevelRef.current >= 1.0) chargingUpRef.current = false
        } else {
          chargeLevelRef.current = Math.max(0.0, chargeLevelRef.current - SHOT_METER_SPEED * delta)
          if (chargeLevelRef.current <= 0.0) chargingUpRef.current = true
        }
        if (chargeBarFillRef.current) {
          chargeBarFillRef.current.style.height = `${chargeLevelRef.current * 100}%`
        }
      } else {
        // Lerp camera Y offset back to 0 (return from crouch or settle after jump)
        cameraYOffsetRef.current = fpsLerp(cameraYOffsetRef.current, 0, 0.08, dt)
      }

      // Ball in flight: quadratic Bezier arc
      if (ballInFlightRef.current && basketballRef.current) {
        flightTRef.current += delta / FLIGHT_DURATION
        const t = Math.min(flightTRef.current, 1.0)
        const start = ballStartRef.current
        const target = shotGoodRef.current
          ? HOOP_RIM_WORLD.clone()
          : HOOP_RIM_WORLD.clone().add(new THREE.Vector3(0.9, 0.4, 0.9))
        const peak = new THREE.Vector3(
          (start.x + target.x) * 0.5,
          Math.max(start.y, target.y) + 7.0,
          (start.z + target.z) * 0.5
        )
        const q = 1 - t
        basketballRef.current.position.set(
          q * q * start.x + 2 * q * t * peak.x + t * t * target.x,
          q * q * start.y + 2 * q * t * peak.y + t * t * target.y,
          q * q * start.z + 2 * q * t * peak.z + t * t * target.z
        )
        basketballRef.current.rotation.x += 0.06 * dt * BASELINE_FPS

        if (t >= 1.0) {
          ballInFlightRef.current = false
          flightTRef.current = 0
          chargeLevelRef.current = 0
          if (chargeBarFillRef.current) chargeBarFillRef.current.style.height = '0%'
          // Rest ball near hoop at ground-ish level
          basketballRef.current.position.set(
            target.x + (shotGoodRef.current ? 0 : 1.5),
            0.55,
            target.z + (shotGoodRef.current ? 0 : 1.5)
          )
          if (shotGoodRef.current) {
            // Play make sound
            if (shotMakeSound.current) {
              shotMakeSound.current.currentTime = 0
              shotMakeSound.current.play().catch(() => {})
            }
            // Trigger confetti burst (auto-clears after 3 s)
            setConfettiActive(true)
            setTimeout(() => setConfettiActive(false), 3000)
          }
        }
      }

      // Camera Y with crouch/jump offset
      state.camera.position.y = 4 + cameraYOffsetRef.current
    }

    raycaster.setFromCamera({ x: 0, y: 0 }, camera)
    const rayTargets = interactiveObjsRef.current.length ? interactiveObjsRef.current : scene.children
    const intersects = raycaster.intersectObjects(rayTargets, true)
    const hit = intersects.find(i => i.object.userData.interactive || i.object.parent?.userData.interactive)
    const type = hit?.object.userData.type || hit?.object.parent?.userData.type
    setLookingAt(type)
    lookingAtRef.current = type

    // Lamp hover scale + emissive lerp
    const isLampHoverable = lookingAtRef.current === 'lamp'
    lampScaleRef.current = fpsLerp(lampScaleRef.current, isLampHoverable ? 1.08 : 1.0, 0.1, delta)
    if (lampGroupRef.current) lampGroupRef.current.scale.setScalar(lampScaleRef.current)
    if (lampShadeMatRef.current) {
      const baseIntensity = lampOn ? 2 : 0.1
      const targetIntensity = isLampHoverable ? baseIntensity + 2.0 : baseIntensity
      lampShadeMatRef.current.emissiveIntensity = fpsLerp(lampShadeMatRef.current.emissiveIntensity, targetIntensity, 0.1, delta)
    }

    // Piano overhead spotlight — xz-plane distance only (per user request, ignore height)
    const distPianoXZ = Math.hypot(state.camera.position.x - PIANO_POS[0], state.camera.position.z - PIANO_POS[2])
    const pianoShouldLight = distPianoXZ < PIANO_LIGHT_RADIUS
    if (pianoShouldLight !== pianoLightOnRef.current) {
      pianoLightOnRef.current = pianoShouldLight
      setPianoLightOn(pianoShouldLight)
      if (lampSound.current) {
        const s = lampSound.current.cloneNode()
        s.volume = VOLUMES.lamp
        s.play().catch(() => {})
      }
    }

    // Proximity prompts
    if (!isSitting) {
      const camPos = state.camera.position
      const catPos = catPosition === 'chair' ? new THREE.Vector3(0, 1.8, 4.2 * STAGE_SCALE) : new THREE.Vector3(7 * STAGE_SCALE, 0.4, -1 * STAGE_SCALE)
      const distLamp = camPos.distanceTo(lampWorldPos)
      const distCat = camPos.distanceTo(catPos)
      const distChair = camPos.distanceTo(chairWorldPos)

      // Basketball proximity — use ball's current world position
      const ballPos = basketballRef.current ? basketballRef.current.position : new THREE.Vector3(...BALL_SPAWN)
      const distBall = (!holdingBallRef.current && !ballInFlightRef.current)
        ? camPos.distanceTo(ballPos) : Infinity

      let prompt = null
      if (!hasInteractedRef.current.lamp && distLamp < 15) prompt = 'Click to interact with the lamp..'
      if (!hasInteractedRef.current.cat && !lampOn && distCat < 9) prompt = 'Click on the cat!'
      if (!hasInteractedRef.current.chair && catPosition === 'fireplace' && distChair < 9) prompt = 'Click on the chair..'
      if (!hasInteractedRef.current.basketball && distBall < 16) prompt = 'Click on the basketball..'
      // Piano: the overhead spotlight switching on doubles as the invitation
      if (!hasInteractedRef.current.pianoBench && pianoShouldLight) prompt = 'Sit at the piano bench..'
      // Override with shot hint when holding (highest priority)
      if (holdingBallRef.current && !hasInteractedRef.current.shot) prompt = 'Hold spacebar to shoot!'

      if (prompt !== proximityPromptRef.current) {
        proximityPromptRef.current = prompt
        setProximityPrompt(prompt)
      }
    } else {
      // Sitting at the desk: prompt to boot the PC until the player has pressed Space once.
      // Sitting at the piano: prompt to click the keys until the first note is played.
      const prompt = (view === 'room' && !pcOn && !hasInteractedRef.current.pc) ? 'Press SPACE to use the computer!'
        : (view === 'piano' && !hasInteractedRef.current.pianoKeys) ? 'Click the piano keys!'
        : null
      if (prompt !== proximityPromptRef.current) {
        proximityPromptRef.current = prompt
        setProximityPrompt(prompt)
      }
    }
  })

  const canInteract = {
    lamp: true,
    cat: !lampOn,
    chair: catPosition === 'fireplace',
    pianoBench: true,
  }
  const isHovered = {
    lamp: lookingAt === 'lamp' && canInteract.lamp,
    cat:  lookingAt === 'cat'  && canInteract.cat,
    chair: lookingAt === 'chair' && canInteract.chair,
    pianoBench: lookingAt === 'pianoBench' && canInteract.pianoBench,
  }

  return (
    <>
      <StatsCollector />
      {!isSitting && <PointerLockControls />}

      <Snow />
      <Aurora />
      <MountainRange />
      <Fireplace position={[7 * STAGE_SCALE, 0, -6 * STAGE_SCALE]} active={!lampOn} />

      <Html calculatePosition={() => [0, 0, 0]} style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh' }}>
        <style>{`
          @keyframes promptPulse {
            0%, 100% { opacity: 0.75; transform: translateX(-50%) scale(1); }
            50% { opacity: 1; transform: translateX(-50%) scale(1.05); }
          }
        `}</style>
        {!(isSitting && pcOn) && (
          <div style={{ position: 'relative', width: '20px', height: '20px' }}>
            <div style={{ position: 'absolute', top: '50%', left: '0', width: '100%', height: '2px', backgroundColor: lookingAt ? '#a855f7' : 'white', boxShadow: lookingAt ? '0 0 8px #a855f7' : 'none', transition: 'all 0.1s' }} />
            <div style={{ position: 'absolute', left: '50%', top: '0', width: '2px', height: '100%', backgroundColor: lookingAt ? '#a855f7' : 'white', boxShadow: lookingAt ? '0 0 8px #a855f7' : 'none', transition: 'all 0.1s' }} />
          </div>
        )}
        {proximityPrompt && !(isSitting && pcOn) && (
          <div style={{
            position: 'absolute',
            top: PROMPT_TOP_PX + 'px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#a855f7',
            fontFamily: "'Courier New', monospace",
            fontSize: '20px',
            letterSpacing: '3px',
            textShadow: '0 0 14px #a855f7, 0 0 32px #a855f7',
            animation: 'promptPulse 1.5s ease-in-out infinite',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            // Same background box as the instructions overlay
            padding: '10px 22px',
            background: 'rgba(5, 5, 5, 0.80)',
            border: '1px solid rgba(168, 85, 247, 0.55)',
            boxShadow: '0 0 18px rgba(168, 85, 247, 0.25), inset 0 0 16px rgba(168, 85, 247, 0.06)',
            backdropFilter: 'blur(4px)',
            borderRadius: '4px',
          }}>
            <TypedText text={proximityPrompt} />
          </div>
        )}
        {/* Basketball charge bar — right side, updated via ref from useFrame */}
        {holdingBall && !isSitting && (
          <div style={{
            position: 'absolute',
            right: '48px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '30px',
            height: '220px',
            background: 'rgba(0,0,0,0.65)',
            border: '2px solid rgba(168,85,247,0.7)',
            boxShadow: '0 0 14px rgba(168,85,247,0.4)',
            borderRadius: '4px',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}>
            {/* Green fill — anchored at BOTTOM, grows UP as chargeLevel rises */}
            <div
              ref={chargeBarFillRef}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '0%',
                background: 'linear-gradient(to top, #22dd44, #aaff88)',
                boxShadow: '0 0 12px #44ff66',
              }}
            />
            {/* Good-zone band at TOP — release here for a MAKE */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: `${SHOT_GOOD_ZONE * 100}%`,
              background: 'rgba(255,255,80,0.18)',
              borderBottom: '2px solid #ffff44',
              boxShadow: '0 0 6px #ffff44',
            }} />
          </div>
        )}
      </Html>

      <Sky sunPosition={[100, -30, 100]} />
      <Stars radius={1500} depth={100} count={20000} factor={70} fade />
      <ambientLight intensity={0.15} />

      {!lampOn && (
        <spotLight
            ref={spotlightRef}
            position={[0, 25, 12 * STAGE_SCALE]}
            target={lightTarget}
            angle={0.8}
            penumbra={1}
            intensity={15}
            distance={0}
            decay={0}
            color="#ffdaab"
            castShadow
            shadow-mapSize={[1024, 1024]}
        />
      )}

      {[[60, 60], [-60, 60], [60, -60], [-60, -60]].map(([x, z], i) => (
        <mesh key={i} position={[x * STAGE_SCALE, 10, z * STAGE_SCALE]}><cylinderGeometry args={[0.2, 0.2, 20]} /><meshStandardMaterial emissive="#a855f7" emissiveIntensity={2} color="#a855f7" transparent opacity={0.3} /></mesh>
      ))}

      {/* purple border strip tracing the reachable square, connecting the corner pillars — only while the lamp is on */}
      {lampOn && [
        { pos: [0, 0.05, 60 * STAGE_SCALE], size: [120 * STAGE_SCALE + 0.4, 0.1, 0.6] },   // +z edge
        { pos: [0, 0.05, -60 * STAGE_SCALE], size: [120 * STAGE_SCALE + 0.4, 0.1, 0.6] },  // -z edge
        { pos: [60 * STAGE_SCALE, 0.05, 0], size: [0.6, 0.1, 120 * STAGE_SCALE + 0.4] },   // +x edge
        { pos: [-60 * STAGE_SCALE, 0.05, 0], size: [0.6, 0.1, 120 * STAGE_SCALE + 0.4] },  // -x edge
      ].map((edge, i) => (
        <mesh key={i} position={edge.pos}><boxGeometry args={edge.size} /><meshStandardMaterial emissive="#a855f7" emissiveIntensity={2} color="#a855f7" transparent opacity={0.3} /></mesh>
      ))}


      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[120 * STAGE_SCALE, 120 * STAGE_SCALE]} /><meshStandardMaterial color="#0a0a0a" roughness={0.8} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow><planeGeometry args={[5000, 5000]} /><meshStandardMaterial color="#391b1b" roughness={1} /></mesh>

      <group position={[0, 0, -2 * STAGE_SCALE]}>
        <mesh position={[0, 1.5, 0]} receiveShadow castShadow><boxGeometry args={[9, 0.2, 5]} /><meshStandardMaterial color="#2d1b0d" /></mesh>
        <Computer pcOn={pcOn} isSitting={view === 'room'} />
        <Peripherals />
      </group>

      <Chair position={[0, 0, 4.2 * STAGE_SCALE]} isInteractive={true} isHovered={isHovered.chair} />

      <group ref={lampGroupRef} position={[-40 * STAGE_SCALE, 1.5, 50 * STAGE_SCALE]} userData={{ interactive: true, type: 'lamp' }}>
        <mesh position={[0, 3, 0]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.5, 1, 1.5]} />
          <meshStandardMaterial ref={lampShadeMatRef} emissive={lampOn ? "#ccae3b" : "#442200"} emissiveIntensity={lampOn ? 2 : 0.1} color="#111" />
          {lampOn && <pointLight color="#dcd0b2" intensity={5} distance={20} />}
        </mesh>
        <mesh position={[0, 1, 0]}><cylinderGeometry args={[0.05, 0.05, 4]} /><meshStandardMaterial color="#111" /></mesh>
      </group>

      <DetailedCat
        targetPosition={catPosition === 'chair' ? [0, 1.8, 4.2 * STAGE_SCALE] : [7 * STAGE_SCALE, 0.4, -1 * STAGE_SCALE]}
        active={!lampOn}
        isAtFireplace={catPosition === 'fireplace'}
        isHovered={isHovered.cat}
        canInteract={canInteract.cat}
      />

      <HoopWithThrusters />
      <BasketballMesh meshRef={basketballRef} />
      <ConfettiEmitter active={confettiActive} />
      <GrandPiano playable={view === 'piano'} onKeyPlayed={onPianoKeyPlayed} />
      <PianoBench isHovered={isHovered.pianoBench} />
      {pianoLightOn && (
        <spotLight
            position={[PIANO_POS[0], 25, PIANO_POS[2]]}
            target={pianoLightTarget}
            angle={0.6}
            penumbra={1}
            intensity={15}
            distance={0}
            decay={0}
            color="#ffdaab"
            castShadow
            shadow-mapSize={[1024, 1024]}
        />
      )}

      {/* multisampling default is 8; the post HDR target's memory scales with
          sample count. Bloom already softens edges, so 4x is ~indistinguishable
          while roughly halving that buffer. Drop to 2 (or 0) for more savings. */}
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.5} luminanceThreshold={0.8} />
        <Vignette eskil={false} offset={0.7} darkness={0.6} />
      </EffectComposer>
    </>
  )
}
