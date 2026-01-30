import { useStore } from '../store'
import { motion } from 'framer-motion'

export const Overlay = () => {
  const { view } = useStore()
  if (view !== 'monitor') return null

  return (
    <div className="os-window">
      <div className="crt-lines" />
      
      {/* OS Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        borderBottom: '2px solid #4ade80', 
        paddingBottom: '5px',
        marginBottom: '20px',
        fontSize: '0.9rem'
      }}>
        <span>USER: GUEST</span>
        <span>COZY_OS v1.0.4</span>
        <span>23:55:04</span>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
      >
        <h2 style={{ color: '#4ade80' }}>{'>'} INITIALIZING PORTFOLIO...</h2>
        <p style={{ lineHeight: '1.6' }}>
          Welcome to my digital workspace. I specialize in 3D creative development 
          and immersive web interfaces.
        </p>
        
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #4ade80', display: 'inline-block' }}>
            [ DIRECTORY ]
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
            <button className="os-button">PROJECTS.EXE</button>
            <button className="os-button">ABOUT_ME.TXT</button>
            <button className="os-button">SKILLS.LOG</button>
            <button className="os-button">CONTACT.SH</button>
          </div>
        </div>
      </motion.div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', opacity: 0.7, fontSize: '0.8rem' }}>
        <span>STATUS: ONLINE</span>
        <span>PRESS [ESC] TO EXIT TERMINAL</span>
      </div>
      
      <style>{`
        .os-button {
          background: transparent;
          color: #4ade80;
          border: 1px solid #4ade80;
          padding: 12px;
          font-family: 'Courier New', monospace;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .os-button:hover {
          background: #4ade80;
          color: #000;
          box-shadow: 0 0 15px rgba(74, 222, 128, 0.5);
        }
      `}</style>
    </div>
  )
}