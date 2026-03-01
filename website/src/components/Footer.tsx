import { Droplets } from 'lucide-react';
import type { Page } from '../App';

export function Footer({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Droplets className="h-6 w-6 text-teal" />
            <span className="text-lg font-semibold">Liquid Relay</span>
          </div>
          <div className="flex space-x-6 text-sm text-gray-500">
            <button onClick={() => onNavigate('faq')} className="hover:text-gray-300 transition-colors">FAQ</button>
            <button onClick={() => onNavigate('privacy')} className="hover:text-gray-300 transition-colors">Privacy</button>
            <button onClick={() => onNavigate('terms')} className="hover:text-gray-300 transition-colors">Terms</button>
            <button onClick={() => onNavigate('support')} className="hover:text-gray-300 transition-colors">Support</button>
            <button onClick={() => onNavigate('contact')} className="hover:text-gray-300 transition-colors">Contact</button>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col items-center gap-4">
          <a
            href="https://byzyb.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors group"
          >
            <img src="/byzyb-logo.png" alt="byzyb.ai" className="h-12 opacity-60 group-hover:opacity-90 transition-opacity" />
            <span className="text-sm">Built by byzyb.ai</span>
          </a>
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Liquid Relay. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
