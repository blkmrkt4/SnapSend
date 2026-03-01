import { useState } from 'react';
import { Droplets, Menu, X } from 'lucide-react';
import { productInfo } from '../../../shared/marketing-content';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <a href="#" className="flex items-center space-x-2">
            <Droplets className="h-8 w-8 text-teal" />
            <span className="text-xl font-bold">Liquid Relay</span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#videos" className="text-gray-400 hover:text-white transition-colors">Videos</a>
            <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
            <a href="#download" className="text-gray-400 hover:text-white transition-colors">Download</a>
            <a
              href={productInfo.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-teal-dark hover:bg-teal text-white px-5 py-2 rounded-lg font-medium transition-colors"
            >
              Buy License
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-950 px-4 py-4 space-y-3">
          <a href="#features" onClick={() => setMenuOpen(false)} className="block text-gray-400 hover:text-white py-2">Features</a>
          <a href="#videos" onClick={() => setMenuOpen(false)} className="block text-gray-400 hover:text-white py-2">Videos</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="block text-gray-400 hover:text-white py-2">How It Works</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} className="block text-gray-400 hover:text-white py-2">Pricing</a>
          <a href="#download" onClick={() => setMenuOpen(false)} className="block text-gray-400 hover:text-white py-2">Download</a>
          <a
            href={productInfo.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-teal-dark hover:bg-teal text-white text-center px-5 py-2 rounded-lg font-medium transition-colors"
          >
            Buy License
          </a>
        </div>
      )}
    </nav>
  );
}
