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
import { Demo } from './components/Demo';

export type Page = 'home' | 'privacy' | 'terms' | 'support' | 'contact' | 'faq' | 'demo';

const validPages: Page[] = ['home', 'privacy', 'terms', 'support', 'contact', 'faq', 'demo'];

function getPageFromHash(): Page {
  const hash = window.location.hash.replace('#', '');
  return validPages.includes(hash as Page) ? (hash as Page) : 'home';
}

export default function App() {
  const [page, setPage] = useState<Page>(getPageFromHash);

  const navigate = (p: Page) => {
    setPage(p);
    window.location.hash = p === 'home' ? '' : p;
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
      {page === 'demo' && <Demo onBack={() => navigate('home')} />}
      <Footer onNavigate={navigate} />
    </div>
  );
}
