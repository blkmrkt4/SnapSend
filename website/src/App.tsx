import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Pricing } from './components/Pricing';
import { CTA } from './components/CTA';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <Hero />
      <Features />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
