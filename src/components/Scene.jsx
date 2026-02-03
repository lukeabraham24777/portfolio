import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars, PointerLockControls, Float, Sky, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { useStore } from '../store'
import * as THREE from 'three'

// 1. CHAIR COMPONENT
const Chair = ({ position, isInteractive }) => (
  <group position={position} rotation={[0, Math.PI, 0]} userData={{ interactive: isInteractive, type: 'chair' }}>
    <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
      <boxGeometry args={[2.5, 0.4, 2.5]} />
      <meshStandardMaterial color="#3d260b" />
    </mesh>
    <mesh position={[0, 2.2, -1.1]} castShadow>
      <boxGeometry args={[2.5, 2.5, 0.3]} />
      <meshStandardMaterial color="#3d260b" />
    </mesh>
    {[[-1, 0.4, 1], [1, 0.4, 1], [-1, 0.4, -1], [1, 0.4, -1]].map((p, i) => (
      <mesh key={i} position={p}>
        <boxGeometry args={[0.3, 0.8, 0.3]} />
        <meshStandardMaterial color="#1a1105" />
      </mesh>
    ))}
  </group>
)

const DetailedCat = ({ targetPosition, active, isAtFireplace }) => {
  const groupRef = useRef()
  const tailRef = useRef()
  const earLeftRef = useRef()
  const earRightRef = useRef()
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
        float dynamicHeightFade = smoothstep(0.15 + bottomWave, 0.35, vUv.y) * smoothstep(0.75, 0.45 + bottomWave * 0.5, vUv.y);
        
        float intensityNoise = snoise(vec3(normalizedAngle * 3.0, time * 0.2, 1.0)) * 0.5 + 0.5;
        
        float alpha = ribbons * dynamicHeightFade * (0.3 + intensityNoise * 0.4);
        alpha *= curtainEffect * 0.5 + 0.7;
        alpha = clamp(alpha * 0.5, 0.0, 0.6);
        
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
  return (<mesh position={[0, -100, 0]}><sphereGeometry args={[1800, 64, 64]} /><primitive object={material} attach="material" /></mesh>)
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
  
  useFrame((state) => {
    if (screenMat.current) {
      const targetIntensity = pcOn ? 0.8 : 0
      screenMat.current.emissiveIntensity = THREE.MathUtils.lerp(screenMat.current.emissiveIntensity, targetIntensity, 0.1)
    }
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
    </group>
  )
}

// Separate component for the computer UI overlay - rendered outside of Three.js
const ComputerUIOverlay = ({ pcOn, isSitting }) => {
  const [isHovering, setIsHovering] = useState(false)
  const containerRef = useRef(null)
  const cursorRef = useRef(null)
  
  // Release pointer lock when PC turns on
  useEffect(() => {
    if (pcOn && isSitting) {
      if (document.pointerLockElement) {
        document.exitPointerLock()
      }
    }
  }, [pcOn, isSitting])

  // Track mouse movement using direct DOM manipulation for performance
  useEffect(() => {
    if (!pcOn || !isSitting) return

    const handleMouseMove = (e) => {
      if (!containerRef.current || !cursorRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      
      // Calculate position in pixels relative to container
      let x = e.clientX - rect.left
      let y = e.clientY - rect.top
      
      // Clamp to container bounds
      x = Math.max(0, Math.min(rect.width, x))
      y = Math.max(0, Math.min(rect.height, y))
      
      // Direct DOM update - no React state, no re-render
      cursorRef.current.style.transform = `translate(${x - 2}px, ${y - 2}px)`
    }

    // Use passive listener for better performance
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [pcOn, isSitting])

  if (!pcOn || !isSitting) return null

  const buttonStyle = (color) => ({
    padding: '12px 24px',
    background: 'transparent',
    border: `2px solid ${color}`,
    cursor: 'none',
    fontSize: '14px',
    fontFamily: "'Courier New', monospace",
    fontWeight: 'bold',
    color: color,
    textShadow: `0 0 5px ${color}`,
    transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
    boxShadow: `0 0 10px ${color}33`,
    position: 'relative',
    zIndex: 10,
  })

  const handleButtonClick = (action) => {
    alert(action)
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '60vw',
        maxWidth: '800px',
        height: '45vh',
        maxHeight: '500px',
        background: '#0a0f1a',
        color: 'white',
        fontFamily: "'Courier New', monospace",
        padding: '30px',
        borderRadius: '12px',
        border: '4px solid #1e3a5f',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'none',
        overflow: 'hidden',
        boxShadow: '0 0 60px rgba(56, 189, 248, 0.3), inset 0 0 100px rgba(56, 189, 248, 0.1)',
        zIndex: 1000,
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

      {/* Retro Cursor - using ref for direct DOM updates */}
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
            fill={isHovering ? "#38bdf8" : "#fff"}
            stroke="#000"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Content */}
      <h1 style={{ 
        color: '#38bdf8', 
        fontSize: '28px',
        textShadow: '0 0 15px #38bdf8',
        marginBottom: '10px',
        position: 'relative',
        zIndex: 10,
      }}>
        {'>'} SYSTEM_ONLINE
      </h1>
      <p style={{ 
        fontSize: '14px', 
        color: '#94a3b8',
        marginBottom: '20px',
        position: 'relative',
        zIndex: 10,
      }}>
        Welcome to the portfolio terminal. Select an option below.
      </p>
      
      <div style={{ 
        marginTop: 'auto', 
        display: 'flex', 
        gap: '20px',
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 10,
      }}>
        <button 
          onClick={() => handleButtonClick("Project Alpha Loaded")}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={buttonStyle('#38bdf8')}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#38bdf8'
            e.currentTarget.style.color = '#0a0f1a'
            e.currentTarget.style.boxShadow = '0 0 25px rgba(56, 189, 248, 0.7)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#38bdf8'
            e.currentTarget.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.3)'
          }}
        >
          [PROJECTS.EXE]
        </button>
        <button 
          onClick={() => handleButtonClick("Resume.pdf downloaded")}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={buttonStyle('#a855f7')}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#a855f7'
            e.currentTarget.style.color = '#0a0f1a'
            e.currentTarget.style.boxShadow = '0 0 25px rgba(168, 85, 247, 0.7)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#a855f7'
            e.currentTarget.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.3)'
          }}
        >
          [RESUME.PDF]
        </button>
        <button 
          onClick={() => handleButtonClick("Contact info loaded")}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={buttonStyle('#4ade80')}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#4ade80'
            e.currentTarget.style.color = '#0a0f1a'
            e.currentTarget.style.boxShadow = '0 0 25px rgba(74, 222, 128, 0.7)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#4ade80'
            e.currentTarget.style.boxShadow = '0 0 10px rgba(74, 222, 128, 0.3)'
          }}
        >
          [CONTACT.SH]
        </button>
      </div>
      
      {/* Bottom status bar */}
      <div style={{
        marginTop: '20px',
        paddingTop: '10px',
        borderTop: '1px solid #1e3a5f',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: '#475569',
        position: 'relative',
        zIndex: 10,
      }}>
        <span>USER: GUEST</span>
        <span style={{ color: '#4ade80' }}>● ONLINE</span>
        <span>ESC TO EXIT</span>
      </div>
    </div>
  )
}

// Export for use in App.jsx
export { ComputerUIOverlay }

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
  
  const sitPos = useMemo(() => new THREE.Vector3(0, 3.8, 3.5), []) 
  const deskLookAt = useMemo(() => new THREE.Vector3(0, 3.5, 11.5), [])

  // Initialize audio files
  useEffect(() => {
    keyboardSound.current = new Audio('/sounds/keyboard.mp3')
    mouseClickSound.current = new Audio('/sounds/mouse.wav')
    keyboardSound.current.volume = 0.3
    mouseClickSound.current.volume = 0.85 + Math.random() * 0.15;

    keyboardSound.current.onerror = () => console.error('Failed to load keyboard.mp3')
    mouseClickSound.current.onerror = () => console.error('Failed to load mouse-click.mp3')
  
    console.log('Audio files initialized')
  }, [])

// Add this new useEffect after your existing useEffects


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
  const keys = { KeyW: 'forward', KeyS: 'backward', KeyA: 'left', KeyD: 'right' }
  
  // Play keyboard sound if sitting (for ANY key press)
  if (isSitting && keyboardSound.current) {
    const sound = keyboardSound.current.cloneNode()
    sound.volume = 0.3
    sound.play().catch(err => console.log('Audio play failed:', err))
  }
  
  if (keys[e.code] && !(isSitting && pcOn)) {
    setMovement(m => ({ ...m, [keys[e.code]]: true }))
    if (isSitting) {
      // Request pointer lock IMMEDIATELY while we still have user gesture
      if (!pcOn) {
        console.log('Attempting pointer lock...')
        document.body.requestPointerLock()
          .then(() => console.log('Pointer lock SUCCESS'))
          .catch(err => console.error('Pointer lock FAILED:', err))
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
  
  const handleClick = () => {
    // Don't handle scene clicks when PC is on - let the UI overlay handle them
    if (isSitting && pcOn) {
      return
    }
    
    if (lookingAtRef.current === 'lamp') toggleLamp()
    else if (lookingAtRef.current === 'cat' && !lampOn) moveCat()
    else if (lookingAtRef.current === 'chair') sitDown()
  }
  
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('mousedown', handleClick)
  
  return () => { 
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('mousedown', handleClick) 
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
  })

  return (
    <>
      {!isSitting && <PointerLockControls />}
      
      <Snow />
      <Aurora />
      <MountainRange />
      <Fireplace position={[7, 0, -6]} active={!lampOn} />
      
      <Html calculatePosition={() => [0, 0, 0]} style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh' }}>
        {!(isSitting && pcOn) && (
          <div style={{ position: 'relative', width: '20px', height: '20px' }}>
            <div style={{ position: 'absolute', top: '50%', left: '0', width: '100%', height: '2px', backgroundColor: lookingAt ? '#a855f7' : 'white', boxShadow: lookingAt ? '0 0 8px #a855f7' : 'none', transition: 'all 0.1s' }} />
            <div style={{ position: 'absolute', left: '50%', top: '0', width: '2px', height: '100%', backgroundColor: lookingAt ? '#a855f7' : 'white', boxShadow: lookingAt ? '0 0 8px #a855f7' : 'none', transition: 'all 0.1s' }} />
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

      <Chair position={[0, 0, 4.2]} isInteractive={true} />

      <group position={[-40, 1.5, 50]} userData={{ interactive: true, type: 'lamp' }}>
        <mesh position={[0, 3, 0]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.5, 1, 1.5]} /><meshStandardMaterial emissive={lampOn ? "#ccae3b" : "#000000"} emissiveIntensity={lampOn ? 2 : 0.1} color="#111" />
          {lampOn && <pointLight color="#dcd0b2" intensity={5} distance={20} />}
        </mesh>
        <mesh position={[0, 1, 0]}><cylinderGeometry args={[0.05, 0.05, 4]} /><meshStandardMaterial color="#111" /></mesh>
      </group>

      <DetailedCat 
        targetPosition={catPosition === 'chair' ? [0, 1.8, 4.2] : [7, 0.4, -1]} 
        active={!lampOn}
        isAtFireplace={catPosition === 'fireplace'} 
      />

      <EffectComposer>
        <Bloom intensity={1.5} luminanceThreshold={0.8} />
        <Vignette eskil={false} offset={0.7} darkness={0.6} />
      </EffectComposer>
    </>
  )
}
