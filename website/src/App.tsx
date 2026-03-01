import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Screenshots } from './components/Screenshots';
import { HowItWorks } from './components/HowItWorks';
import { Pricing } from './components/Pricing';
import { Download } from './components/Download';
import { LicensingFAQ } from './components/LicensingFAQ';
import { CTA } from './components/CTA';
import { Footer } from './components/Footer';
import { Privacy } from './components/Privacy';
import { Terms } from './components/Terms';
import { Support } from './components/Support';
import { Contact } from './components/Contact';
import { FAQ } from './components/FAQ';

export type Page = 'home' | 'privacy' | 'terms' | 'support' | 'contact' | 'faq';

export default function App() {
  const [page, setPage] = useState<Page>('home');

  const navigate = (p: Page) => {
    setPage(p);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar onNavigate={navigate} />
      {page === 'home' && (
        <>
          <Hero />
          <Features />
          <Screenshots />
          <HowItWorks />
          <Pricing />
          <Download />
          <LicensingFAQ />
          <CTA />
        </>
      )}
      {page === 'privacy' && <Privacy onBack={() => navigate('home')} />}
      {page === 'terms' && <Terms onBack={() => navigate('home')} />}
      {page === 'support' && <Support onBack={() => navigate('home')} onNavigate={navigate} />}
      {page === 'contact' && <Contact onBack={() => navigate('home')} />}
      {page === 'faq' && <FAQ onBack={() => navigate('home')} />}
      <Footer onNavigate={navigate} />
    </div>
  );
}
