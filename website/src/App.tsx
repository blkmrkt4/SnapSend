import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Screenshots } from './components/Screenshots';
import { Videos } from './components/Videos';
import { HowItWorks } from './components/HowItWorks';
import { Pricing } from './components/Pricing';
import { Download } from './components/Download';
import { LicensingFAQ } from './components/LicensingFAQ';
import { CTA } from './components/CTA';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <Hero />
      <Features />
      <Screenshots />
      <Videos />
      <HowItWorks />
      <Pricing />
      <Download />
      <LicensingFAQ />
      <CTA />
      <Footer />
    </div>
  );
}
