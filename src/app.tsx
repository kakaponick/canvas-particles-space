import { Analytics } from '@vercel/analytics/react'
import ParticleCanvas from './components/particle_canvas'
import ControlPanel from './components/control_panel'
import BlackHoleIndicator from './components/controls/blackhole_indicator'
import ScrollIndicator from './components/controls/scroll_indicator'

function App () {
  return (
    <div className="min-h-screen" style={{ height: '300vh' }}>
      <Analytics />
      <ParticleCanvas />
      <BlackHoleIndicator />
      <ScrollIndicator />
      <ControlPanel />
    </div>
  )
}

export default App

