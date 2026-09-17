import { Hero } from './components/Hero';
import { BlurPlayground } from './components/BlurPlayground';

export default function App() {
  return (
    <main className="tool-page min-h-screen bg-page">
      <nav className="nav nav-content">
        <a className="home" href="/playground">← Back</a>
      </nav>
      <Hero
        title="Blur Presets & How They Work"
        subtitle="I'm a visual learner — after reading Dan Hollick's “How Gaussian Blurs Work,” I wanted to try it myself: pick a blur intensity and watch exactly how it reshapes the image, pass by pass."
      />
      <BlurPlayground />
    </main>
  );
}
