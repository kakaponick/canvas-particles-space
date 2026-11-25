import { Analytics } from '@vercel/analytics/react'
import ParticleCanvas from './components/particle_canvas'
import ControlPanel from './components/control_panel'
import IntroDebugger from './components/controls/intro_debugger'
import BlackHoleIndicator from './components/controls/blackhole_indicator'
import InteractionHints from './components/controls/interaction_hints'
import FractalMode from './components/fractal_mode'
import FilmMode, { FilmDrop } from './components/film_mode'
import { useFractalStore } from './store/fractal_store'
import { useFilmStore } from './store/film_store'

// What is drawn over the particle scene to talk about it; the Mandelbrot and film modes stand in front of
// the scene and have none of it
function SceneOverlays () {
  const fractal = useFractalStore(state => state.open)
  const film = useFilmStore(state => state.open)
  if (fractal || film) return null
  return (
    <>
      <BlackHoleIndicator />
      <InteractionHints />
    </>
  )
}

function App () {
  return (
    <div className="min-h-screen">
      <Analytics />
      <ParticleCanvas />
      <SceneOverlays />
      <FractalMode />
      <FilmMode />
      <FilmDrop />
      <ControlPanel />
      <IntroDebugger />
    </div>
  )
}

export default App

