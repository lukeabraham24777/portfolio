import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars, PointerLockControls, Float, Sky, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { useStore } from '../store'
import * as THREE from 'three'

// ─── VOLUME CONSTANTS — adjust these to change relative audio levels ───────
const VOLUMES = {
  mainMusic:  0.40,
  fireplace:  0.55,
  wind:       0.45,
  cat:        0.70,
  lamp:       0.60,
  chair:      0.65,
  mouseClick: 0.50,
  keyboard:   0.30,
}
// ────────────────────────────────────────────────────────────────────────────

// 1. CHAIR COMPONENT
const Chair = ({ position, isInteractive, isHovered }) => {
  const groupRef = useRef()
  const scaleRef = useRef(1)
  const seatMatRef = useRef()
  const backMatRef = useRef()

  useFrame(() => {
    const target = isHovered ? 1.07 : 1.0
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, target, 0.1)
    if (groupRef.current) groupRef.current.scale.setScalar(scaleRef.current)
    const emTarget = isHovered ? 0.35 : 0.0
    if (seatMatRef.current) seatMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(seatMatRef.current.emissiveIntensity, emTarget, 0.1)
    if (backMatRef.current) backMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(backMatRef.current.emissiveIntensity, emTarget, 0.1)
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
  const targetVec = new THREE.Vector3()

  useFrame((state) => {
    if (!groupRef.current) return
    targetVec.set(...targetPosition)
    groupRef.current.position.lerp(targetVec, 0.05)
    const distance = groupRef.current.position.distanceTo(targetVec)
    if (distance > 0.1) {
      const lookTarget = new THREE.Vector3(targetVec.x, groupRef.current.position.y, targetVec.z)
      groupRef.current.lookAt(lookTarget)
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 10) * 0.05
    } else {
      const targetRotation = isAtFireplace ? Math.PI : 0
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation, 0.1)
    }
    if (isAtFireplace && distance < 0.2) {
      groupRef.current.position.y = targetPosition[1] + Math.sin(state.clock.elapsedTime * 1.5) * 0.04
      if (tailRef.current) tailRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.3
      // Ear twitching when relaxed
      if (earLeftRef.current) earLeftRef.current.rotation.z = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.05
      if (earRightRef.current) earRightRef.current.rotation.z = -0.3 + Math.sin(state.clock.elapsedTime * 3.5) * 0.05
    }
    // Hover bulge
    const scaleTarget = (isHovered && canInteract) ? 1.08 : 1.0
    catScaleRef.current = THREE.MathUtils.lerp(catScaleRef.current, scaleTarget, 0.1)
    groupRef.current.scale.setScalar(catScaleRef.current)
  })

  const furColor = "#4a3520"
  const furColorLight = "#6b4c2a"
  const furColorDark = "#2d1f12"

  return (
    <group ref={groupRef} userData={{ interactive: true, type: 'cat' }}>
      {/* Body - elongated ellipsoid */}
      <mesh castShadow position={[0, 0, 0]}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0, -0.2]} scale={[0.9, 0.85, 1.3]}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>
      
      {/* Head */}
      <group position={[0, 0.25, 0.55]}>
        {/* Main head sphere */}
        <mesh castShadow>
          <sphereGeometry args={[0.35, 16, 12]} />
          <meshStandardMaterial color={furColor} roughness={0.9} />
        </mesh>
        
        {/* Cheeks */}
        <mesh castShadow position={[-0.15, -0.08, 0.15]} scale={[0.7, 0.6, 0.5]}>
          <sphereGeometry args={[0.2, 12, 8]} />
          <meshStandardMaterial color={furColorLight} roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0.15, -0.08, 0.15]} scale={[0.7, 0.6, 0.5]}>
          <sphereGeometry args={[0.2, 12, 8]} />
          <meshStandardMaterial color={furColorLight} roughness={0.9} />
        </mesh>
        
        {/* Muzzle */}
        <mesh castShadow position={[0, -0.1, 0.25]} scale={[0.6, 0.5, 0.5]}>
          <sphereGeometry args={[0.15, 12, 8]} />
          <meshStandardMaterial color={furColorLight} roughness={0.9} />
        </mesh>
        
        {/* Nose */}
        <mesh position={[0, -0.05, 0.35]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color="#ffaaaa" roughness={0.5} />
        </mesh>
        
        {/* Eyes */}
        <group position={[-0.12, 0.05, 0.28]}>
          <mesh>
            <sphereGeometry args={[0.07, 12, 8]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0.02, 0.02, 0.05]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshStandardMaterial color="#ffdd44" emissive="#443300" emissiveIntensity={0.3} />
          </mesh>
        </group>
        <group position={[0.12, 0.05, 0.28]}>
          <mesh>
            <sphereGeometry args={[0.07, 12, 8]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[-0.02, 0.02, 0.05]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshStandardMaterial color="#ffdd44" emissive="#443300" emissiveIntensity={0.3} />
          </mesh>
        </group>
        
        {/* Ears */}
        <group ref={earLeftRef} position={[-0.2, 0.3, 0]} rotation={[0.2, 0, 0.3]}>
          <mesh castShadow>
            <coneGeometry args={[0.12, 0.25, 4]} />
            <meshStandardMaterial color={furColorDark} roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.02, 0.02]} scale={[0.6, 0.8, 0.6]}>
            <coneGeometry args={[0.1, 0.2, 4]} />
            <meshStandardMaterial color="#ffcccc" roughness={0.8} />
          </mesh>
        </group>
        <group ref={earRightRef} position={[0.2, 0.3, 0]} rotation={[0.2, 0, -0.3]}>
          <mesh castShadow>
            <coneGeometry args={[0.12, 0.25, 4]} />
            <meshStandardMaterial color={furColorDark} roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.02, 0.02]} scale={[0.6, 0.8, 0.6]}>
            <coneGeometry args={[0.1, 0.2, 4]} />
            <meshStandardMaterial color="#ffcccc" roughness={0.8} />
          </mesh>
        </group>
        
        {/* Whiskers (thin cylinders) */}
        {[-1, 0, 1].map((i) => (
          <mesh key={`wl${i}`} position={[-0.2, -0.08 + i * 0.03, 0.28]} rotation={[0, 0, 0.2 + i * 0.1]}>
            <cylinderGeometry args={[0.003, 0.003, 0.25, 4]} />
            <meshStandardMaterial color="#ddd" />
          </mesh>
        ))}
        {[-1, 0, 1].map((i) => (
          <mesh key={`wr${i}`} position={[0.2, -0.08 + i * 0.03, 0.28]} rotation={[0, 0, -0.2 - i * 0.1]}>
            <cylinderGeometry args={[0.003, 0.003, 0.25, 4]} />
            <meshStandardMaterial color="#ddd" />
          </mesh>
        ))}
      </group>
      
      {/* Front legs */}
      <mesh castShadow position={[-0.2, -0.35, 0.2]} scale={[0.4, 1, 0.4]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.2, -0.35, 0.2]} scale={[0.4, 1, 0.4]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>
      
      {/* Back legs (tucked under) */}
      <mesh castShadow position={[-0.25, -0.25, -0.35]} scale={[0.5, 0.7, 0.6]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.25, -0.25, -0.35]} scale={[0.5, 0.7, 0.6]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>
      
      {/* Tail */}
      <group ref={tailRef} position={[0, 0.1, -0.7]} rotation={[-0.3, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.06, 0.04, 0.6, 8]} />
          <meshStandardMaterial color={furColorDark} roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0, 0.35, 0.1]} rotation={[0.5, 0, 0]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color={furColorDark} roughness={0.9} />
        </mesh>
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
const Computer = ({ pcOn, isSitting }) => {
  const screenMat = useRef()
  const [hoveredButton, setHoveredButton] = useState(null)
  const containerRef = useRef(null)
  const cursorRef = useRef(null)

  // Store cursor position
  const cursorPosRef = useRef({ x: 350, y: 200 })

  // Button hitboxes (x, y, width, height) - positions relative to container
  // These will be at the bottom of the screen in the button area
  const buttons = [
    { id: 'projects', label: '[PROJECTS.EXE]', color: '#38bdf8', x: 24, y: 340, width: 120, height: 36, action: 'Project Alpha Loaded' },
    { id: 'resume', label: '[RESUME.PDF]', color: '#a855f7', x: 160, y: 340, width: 110, height: 36, action: 'Resume.pdf downloaded' },
    { id: 'contact', label: '[CONTACT.SH]', color: '#4ade80', x: 286, y: 340, width: 110, height: 36, action: 'Contact info loaded' },
  ]

  // Check if cursor is within a button's bounds
  const getButtonAtCursor = (cx, cy) => {
    for (const btn of buttons) {
      if (cx >= btn.x && cx <= btn.x + btn.width && cy >= btn.y && cy <= btn.y + btn.height) {
        return btn
      }
    }
    return null
  }

  // Track mouse movement and clicks
  useEffect(() => {
    if (!pcOn || !isSitting) return

    const CONTAINER_WIDTH = 760
    const CONTAINER_HEIGHT = 440
    const CURSOR_SIZE = 24

    const handleMouseMove = (e) => {
      if (!cursorRef.current) return

      // Update cursor position
      cursorPosRef.current.x += (e.movementX || 0)
      cursorPosRef.current.y += (e.movementY || 0)

      // Clamp to container bounds
      cursorPosRef.current.x = Math.max(0, Math.min(CONTAINER_WIDTH - CURSOR_SIZE, cursorPosRef.current.x))
      cursorPosRef.current.y = Math.max(0, Math.min(CONTAINER_HEIGHT - CURSOR_SIZE, cursorPosRef.current.y))

      cursorRef.current.style.transform = `translate(${cursorPosRef.current.x}px, ${cursorPosRef.current.y}px)`

      // Check hover state
      const hovered = getButtonAtCursor(cursorPosRef.current.x + CURSOR_SIZE / 2, cursorPosRef.current.y + CURSOR_SIZE / 2)
      setHoveredButton(hovered?.id || null)
    }

    const handleClick = () => {
      // Check which button (if any) the cursor is over
      const btn = getButtonAtCursor(cursorPosRef.current.x + 12, cursorPosRef.current.y + 12)
      if (btn) {
        alert(btn.action)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mousedown', handleClick)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [pcOn, isSitting])

  useFrame((state) => {
    if (screenMat.current) {
      const targetIntensity = pcOn ? 0.8 : 0
      screenMat.current.emissiveIntensity = THREE.MathUtils.lerp(screenMat.current.emissiveIntensity, targetIntensity, 0.1)
    }
  })

  const getButtonStyle = (btn) => ({
    position: 'absolute',
    left: btn.x + 'px',
    top: btn.y + 'px',
    width: btn.width + 'px',
    height: btn.height + 'px',
    background: hoveredButton === btn.id ? btn.color : 'transparent',
    border: `2px solid ${btn.color}`,
    color: hoveredButton === btn.id ? '#0a0f1a' : btn.color,
    fontSize: '12px',
    fontFamily: "'Courier New', monospace",
    fontWeight: 'bold',
    textShadow: hoveredButton === btn.id ? 'none' : `0 0 5px ${btn.color}`,
    boxShadow: hoveredButton === btn.id ? `0 0 25px ${btn.color}` : `0 0 10px ${btn.color}33`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 10,
  })

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

      {/* Screen UI rendered in 3D space */}
      {pcOn && isSitting && (
        <Html
          transform
          position={[0, 0, 0.08]}
          scale={0.21}
        >
          <div
            ref={containerRef}
            style={{
              width: '760px',
              height: '440px',
              background: '#0a0f1a',
              color: 'white',
              fontFamily: "'Courier New', monospace",
              padding: '24px',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 80px rgba(56, 189, 248, 0.1)',
              userSelect: 'none',
              cursor: 'none',
              position: 'relative',
            }}
          >
            {/* CRT Scanlines */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
              pointerEvents: 'none',
              zIndex: 100,
              borderRadius: '8px',
            }} />

            {/* CRT Vignette */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
              pointerEvents: 'none',
              zIndex: 99,
              borderRadius: '8px',
            }} />

            {/* Retro Cursor */}
            <div
              ref={cursorRef}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '24px',
                height: '28px',
                pointerEvents: 'none',
                zIndex: 1000,
                willChange: 'transform',
              }}
            >
              <svg width="24" height="28" viewBox="0 0 20 24">
                <polygon
                  points="0,0 0,20 5,15 9,23 12,22 8,14 14,14"
                  fill={hoveredButton ? "#38bdf8" : "#fff"}
                  stroke="#000"
                  strokeWidth="1.5"
                />
              </svg>
            </div>

            {/* Content */}
            <h1 style={{
              color: '#38bdf8',
              fontSize: '24px',
              textShadow: '0 0 15px #38bdf8',
              marginBottom: '8px',
              position: 'relative',
              zIndex: 10,
            }}>
              {'>'} SYSTEM_ONLINE
            </h1>
            <p style={{
              fontSize: '12px',
              color: '#94a3b8',
              marginBottom: '16px',
              position: 'relative',
              zIndex: 10,
            }}>
              Welcome to the portfolio terminal. Select an option below.
            </p>

            {/* Button hitboxes - rendered as divs */}
            {buttons.map(btn => (
              <div key={btn.id} style={getButtonStyle(btn)}>
                {btn.label}
              </div>
            ))}

            {/* Bottom status bar */}
            <div style={{
              position: 'absolute',
              bottom: '24px',
              left: '24px',
              right: '24px',
              paddingTop: '8px',
              borderTop: '1px solid #1e3a5f',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#475569',
              zIndex: 10,
            }}>
              <span>USER: GUEST</span>
              <span style={{ color: '#4ade80' }}>● ONLINE</span>
              <span>ESC TO EXIT</span>
            </div>
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
  useFrame(() => {
    particles.forEach((particle, i) => { particle.pos[1] -= particle.speed; if (particle.pos[1] < 0) particle.pos[1] = 100; dummy.position.set(particle.pos[0], particle.pos[1], particle.pos[2]); dummy.updateMatrix(); mesh.current.setMatrixAt(i, dummy.matrix); });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[null, null, count]}><sphereGeometry args={[0.04, 4, 4]} /><meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.8} /></instancedMesh>
}
export const Scene = () => {
  const { lampOn, toggleLamp, catPosition, moveCat, sitDown, view, standUp, pcOn, togglePc } = useStore()
  const isSitting = view === 'room'
  const { camera, raycaster, scene } = useThree()
  const [lookingAt, setLookingAt] = useState(null)
  const lookingAtRef = useRef(null)
  const [movement, setMovement] = useState({ forward: false, backward: false, left: false, right: false })
  const spotlightRef = useRef()
  const lightTarget = useMemo(() => new THREE.Object3D(), [])
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
  const hasInteractedRef = useRef({ lamp: false, cat: false, chair: false })

  // Precomputed world positions for proximity checks
  const lampWorldPos = useMemo(() => new THREE.Vector3(-40, 1.5, 50), [])
  const chairWorldPos = useMemo(() => new THREE.Vector3(0, 0, 4.2), [])
  
  const sitPos = useMemo(() => new THREE.Vector3(0, 3.8, 3.5), []) 
  const deskLookAt = useMemo(() => new THREE.Vector3(0, 3.5, 11.5), [])

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

  useEffect(() => {
    camera.position.set(-55, 4, 55)
    camera.lookAt(0, 4, 0)
    camera.near = 0.05
    camera.far = 10000
    camera.updateProjectionMatrix()
    lightTarget.position.set(0, 0, -2)
    scene.add(lightTarget)
  }, [camera, scene, lightTarget])

  useEffect(() => {
const handleKeyDown = (e) => {
  startMusicWithFade()
  const keys = { KeyW: 'forward', KeyS: 'backward', KeyA: 'left', KeyD: 'right' }

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
      camera.position.y = 4
    }
  }
  if (e.code === 'Space' && isSitting) {
    e.preventDefault()
    togglePc()
  }
}

  const handleKeyUp = (e) => {
    const keys = { KeyW: 'forward', KeyS: 'backward', KeyA: 'left', KeyD: 'right' }
    if (keys[e.code]) {
      setMovement((m) => ({ ...m, [keys[e.code]]: false }))
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
      sitDown()
      hasInteractedRef.current.chair = true
      if (chairSound.current) {
        const s = chairSound.current.cloneNode()
        s.volume = VOLUMES.chair
        s.play().catch(() => {})
      }
    } else if (lookingAtRef.current === 'chair') {
      // Chair clicked but can't sit yet — no sound
      sitDown()
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
}, [lampOn, catPosition, isSitting, toggleLamp, moveCat, sitDown, standUp, camera, togglePc, pcOn])

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

  useFrame((state) => {
    if (isSitting) {
      if (zoomedIn) {
        const zoomedPos = new THREE.Vector3(0, 3.5, -1.3)
        state.camera.position.lerp(zoomedPos, 0.05)
      } else {
        state.camera.position.lerp(sitPos, 0.03)
      }
      
      const dummy = new THREE.Object3D()
      dummy.position.copy(state.camera.position)
      dummy.lookAt(deskLookAt)
      
      state.camera.quaternion.slerp(dummy.quaternion, 0.03)
      state.camera.updateMatrixWorld()
    } else {
      const velocity = 0.1
      const direction = new THREE.Vector3()
      const frontVector = new THREE.Vector3(0, 0, Number(movement.backward) - Number(movement.forward))
      const sideVector = new THREE.Vector3(Number(movement.left) - Number(movement.right), 0, 0)
      direction.subVectors(frontVector, sideVector).normalize().multiplyScalar(velocity).applyEuler(state.camera.rotation)
      state.camera.position.x = Math.max(-55, Math.min(55, state.camera.position.x + direction.x))
      state.camera.position.z = Math.max(-55, Math.min(55, state.camera.position.z + direction.z))
      state.camera.position.y = 4
    }

    raycaster.setFromCamera({ x: 0, y: 0 }, camera)
    const intersects = raycaster.intersectObjects(scene.children, true)
    const hit = intersects.find(i => i.object.userData.interactive || i.object.parent?.userData.interactive)
    const type = hit?.object.userData.type || hit?.object.parent?.userData.type
    setLookingAt(type)
    lookingAtRef.current = type

    // Lamp hover scale + emissive lerp
    const isLampHoverable = lookingAtRef.current === 'lamp'
    lampScaleRef.current = THREE.MathUtils.lerp(lampScaleRef.current, isLampHoverable ? 1.08 : 1.0, 0.1)
    if (lampGroupRef.current) lampGroupRef.current.scale.setScalar(lampScaleRef.current)
    if (lampShadeMatRef.current) {
      const baseIntensity = lampOn ? 2 : 0.1
      const targetIntensity = isLampHoverable ? baseIntensity + 2.0 : baseIntensity
      lampShadeMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(lampShadeMatRef.current.emissiveIntensity, targetIntensity, 0.1)
    }

    // Proximity prompts
    if (!isSitting) {
      const camPos = state.camera.position
      const catPos = catPosition === 'chair' ? new THREE.Vector3(0, 1.8, 4.2) : new THREE.Vector3(7, 0.4, -1)
      const distLamp = camPos.distanceTo(lampWorldPos)
      const distCat = camPos.distanceTo(catPos)
      const distChair = camPos.distanceTo(chairWorldPos)

      let prompt = null
      if (!hasInteractedRef.current.lamp && distLamp < 15) prompt = 'the LAMP'
      if (!hasInteractedRef.current.cat && !lampOn && distCat < 9) prompt = 'the CAT'
      if (!hasInteractedRef.current.chair && catPosition === 'fireplace' && distChair < 9) prompt = 'the CHAIR'

      if (prompt !== proximityPromptRef.current) {
        proximityPromptRef.current = prompt
        setProximityPrompt(prompt)
      }
    } else if (proximityPromptRef.current !== null) {
      proximityPromptRef.current = null
      setProximityPrompt(null)
    }
  })

  const canInteract = {
    lamp: true,
    cat: !lampOn,
    chair: catPosition === 'fireplace',
  }
  const isHovered = {
    lamp: lookingAt === 'lamp' && canInteract.lamp,
    cat:  lookingAt === 'cat'  && canInteract.cat,
    chair: lookingAt === 'chair' && canInteract.chair,
  }

  return (
    <>
      {!isSitting && <PointerLockControls />}

      <Snow />
      <Aurora />
      <MountainRange />
      <Fireplace position={[7, 0, -6]} active={!lampOn} />

      <Html calculatePosition={() => [0, 0, 0]} style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh' }}>
        <style>{`
          @keyframes promptPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
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
            top: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#a855f7',
            fontFamily: "'Courier New', monospace",
            fontSize: '15px',
            letterSpacing: '2px',
            textShadow: '0 0 10px #a855f7, 0 0 20px #a855f7',
            animation: 'promptPulse 1.5s ease-in-out infinite',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            ▶ CLICK to interact with {proximityPrompt}
          </div>
        )}
      </Html>

      <Sky sunPosition={[100, -30, 100]} />
      <Stars radius={1500} depth={100} count={20000} factor={70} fade />
      <ambientLight intensity={0.15} />

      {!lampOn && (
        <spotLight
            ref={spotlightRef}
            position={[0, 25, 12]}
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
        <mesh key={i} position={[x, 10, z]}><cylinderGeometry args={[0.2, 0.2, 20]} /><meshStandardMaterial emissive="#a855f7" emissiveIntensity={2} color="#a855f7" transparent opacity={0.3} /></mesh>
      ))}


      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[120, 120]} /><meshStandardMaterial color="#0a0a0a" roughness={0.8} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow><planeGeometry args={[5000, 5000]} /><meshStandardMaterial color="#391b1b" roughness={1} /></mesh>

      <group position={[0, 0, -2]}>
        <mesh position={[0, 1.5, 0]} receiveShadow castShadow><boxGeometry args={[9, 0.2, 5]} /><meshStandardMaterial color="#2d1b0d" /></mesh>
        <Computer pcOn={pcOn} isSitting={isSitting} />
        <Peripherals />
      </group>

      <Chair position={[0, 0, 4.2]} isInteractive={true} isHovered={isHovered.chair} />

      <group ref={lampGroupRef} position={[-40, 1.5, 50]} userData={{ interactive: true, type: 'lamp' }}>
        <mesh position={[0, 3, 0]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.5, 1, 1.5]} />
          <meshStandardMaterial ref={lampShadeMatRef} emissive={lampOn ? "#ccae3b" : "#442200"} emissiveIntensity={lampOn ? 2 : 0.1} color="#111" />
          {lampOn && <pointLight color="#dcd0b2" intensity={5} distance={20} />}
        </mesh>
        <mesh position={[0, 1, 0]}><cylinderGeometry args={[0.05, 0.05, 4]} /><meshStandardMaterial color="#111" /></mesh>
      </group>

      <DetailedCat
        targetPosition={catPosition === 'chair' ? [0, 1.8, 4.2] : [7, 0.4, -1]}
        active={!lampOn}
        isAtFireplace={catPosition === 'fireplace'}
        isHovered={isHovered.cat}
        canInteract={canInteract.cat}
      />

      <EffectComposer>
        <Bloom intensity={1.5} luminanceThreshold={0.8} />
        <Vignette eskil={false} offset={0.7} darkness={0.6} />
      </EffectComposer>
    </>
  )
}
