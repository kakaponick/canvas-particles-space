import ParticleCanvas from './components/particle_canvas'
import ControlPanel from './components/control_panel'
import StartOverlay from './components/start_overlay'
import BlackHoleIndicator from './components/blackhole_indicator'
import ScrollIndicator from './components/scroll_indicator'

function App () {
  return (
    <div className="min-h-screen" style={{ height: '300vh' }}>
      <ParticleCanvas />
      <StartOverlay />
      <BlackHoleIndicator />
      <ScrollIndicator />
      <ControlPanel />
    </div>
  )
}

export default App

