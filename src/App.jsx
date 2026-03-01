import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './components/Scene'
import { Overlay } from './components/Overlay'
import { useStore } from './store'

// Wake up / eye opening animation component
const WakeUpOverlay = ({ onComplete }) => {
  const [phase, setPhase] = useState('closed') // closed, opening, open
  const [opacity, setOpacity] = useState(1)
  
  useEffect(() => {
    // Sequence: eyes closed -> blink open -> fully open
    const timeline = [
      { delay: 500, action: () => setPhase('opening') },
      { delay: 1500, action: () => setPhase('closed') },
      { delay: 2000, action: () => setPhase('opening') },
      { delay: 2800, action: () => setPhase('open') },
      { delay: 3500, action: () => setOpacity(0) },
      { delay: 4500, action: onComplete },
    ]
    
    const timers = timeline.map(({ delay, action }) => 
      setTimeout(action, delay)
    )
    
    return () => timers.forEach(clearTimeout)
  }, [onComplete])
  
  if (phase === 'open' && opacity === 0) return null
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      pointerEvents: 'none',
      transition: 'opacity 1s ease-out',
      opacity,
    }}>
      {/* Top eyelid */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: phase === 'closed' ? '50%' : phase === 'opening' ? '15%' : '0%',
        background: 'linear-gradient(to bottom, #000 0%, #000 80%, #1a0a0a 100%)',
        transition: 'height 0.8s ease-in-out',
        boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
      }} />
      
      {/* Bottom eyelid */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: phase === 'closed' ? '50%' : phase === 'opening' ? '15%' : '0%',
        background: 'linear-gradient(to top, #000 0%, #000 80%, #1a0a0a 100%)',
        transition: 'height 0.8s ease-in-out',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
      }} />
      
      {/* Blur overlay for grogginess effect */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backdropFilter: phase === 'open' ? 'blur(0px)' : 'blur(4px)',
        transition: 'backdrop-filter 1s ease-out',
      }} />
    </div>
  )
}

// Instructions overlay component
const InstructionsOverlay = ({ visible }) => {
  const [show, setShow] = useState(false)
  
  useEffect(() => {
    if (visible) setShow(true)
  }, [visible])
  
  if (!visible || !show) return null

  return (
    <div style={{
      position: 'fixed',
      left: '24px',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 100,
      padding: '16px 20px',
      background: 'rgba(5, 5, 5, 0.80)',
      border: '1px solid rgba(168, 85, 247, 0.55)',
      boxShadow: '0 0 18px rgba(168, 85, 247, 0.25), inset 0 0 16px rgba(168, 85, 247, 0.06)',
      backdropFilter: 'blur(4px)',
    }}>
    <div style={{
      fontFamily: "'Courier New', monospace",
      color: '#a855f7',
      textShadow: '0 0 10px #a855f7, 0 0 20px #a855f7',
      animation: 'pulse 2s ease-in-out infinite',
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .instruction-line {
          animation: slideIn 0.5s ease-out forwards;
          opacity: 0;
          margin: 12px 0;
          font-size: 14px;
          letter-spacing: 2px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .key-box {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 28px;
          padding: 0 8px;
          border: 2px solid #a855f7;
          background: rgba(168, 85, 247, 0.1);
          font-weight: bold;
          font-size: 12px;
        }
        .key-group {
          display: flex;
          gap: 4px;
        }
      `}</style>
      
      <div className="instruction-line" style={{ animationDelay: '0s' }}>
        <div className="key-group">
          <span className="key-box">W</span>
          <span className="key-box">A</span>
          <span className="key-box">S</span>
          <span className="key-box">D</span>
        </div>
        <span>MOVE</span>
      </div>
      
      <div className="instruction-line" style={{ animationDelay: '0.2s' }}>
        <div className="key-box" style={{ minWidth: '60px' }}>MOUSE</div>
        <span>LOOK</span>
      </div>
      
      <div className="instruction-line" style={{ animationDelay: '0.4s' }}>
        <div className="key-box" style={{ minWidth: '60px' }}>CLICK</div>
        <span>INTERACT</span>
      </div>
      
      <div className="instruction-line" style={{ animationDelay: '0.6s' }}>
        <div className="key-box">SPACE</div>
        <span>BOOT PC</span>
      </div>
      
      <div className="instruction-line" style={{ animationDelay: '0.8s' }}>
        <div className="key-box">ESC</div>
        <span>STAND UP</span>
      </div>
    </div>
    </div>
  )
}

function App() {
  const standUp = useStore((state) => state.standUp)
  const pcOn = useStore((state) => state.pcOn)
  const view = useStore((state) => state.view)
  const [wakeUpComplete, setWakeUpComplete] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)
  
  const isSitting = view === 'room'

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') standUp() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [standUp])

  // Hide instructions when PC is on or player starts moving
  useEffect(() => {
    const handleInteraction = () => {
      setTimeout(() => setShowInstructions(false), 3000)
    }
    window.addEventListener('click', handleInteraction, { once: true })
    window.addEventListener('keydown', handleInteraction, { once: true })
    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', cursor: pcOn && isSitting ? 'none' : 'auto' }}>
      <WakeUpOverlay onComplete={() => setWakeUpComplete(true)} />
      <Canvas>
        <Scene />
      </Canvas>
      <Overlay />
      <InstructionsOverlay visible={wakeUpComplete && !pcOn && view === 'orbit'} />
    </div>
  )
}

export default App