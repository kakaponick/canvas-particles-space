import { Analytics } from '@vercel/analytics/react'
import ParticleCanvas from './components/particle_canvas'
import ControlPanel from './components/control_panel'
import IntroDebugger from './components/controls/intro_debugger'
import BlackHoleIndicator from './components/controls/blackhole_indicator'
import InteractionHints from './components/controls/interaction_hints'

function App () {
  return (
    <div className="min-h-screen">
      <Analytics />
      <ParticleCanvas />
      <BlackHoleIndicator />
      <InteractionHints />
      <ControlPanel />
      <IntroDebugger />
    </div>
  )
}

export default App

