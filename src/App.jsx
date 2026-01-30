import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './components/Scene'
import { Overlay } from './components/Overlay'
import { useStore } from './store'

function App() {
  const standUp = useStore((state) => state.standUp)

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') standUp() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [standUp])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas>
        <Scene />
      </Canvas>
      <Overlay />
      <div style={{ position: 'absolute', bottom: 20, left: 20, color: 'white', opacity: 0.4 }}>
        Lamp On -> Click Cat -> Click Desk
      </div>
    </div>
  )
}

export default App