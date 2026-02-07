import { Smartphone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Smartphone className="h-6 w-6 text-purple-500" />
            <span className="text-lg font-semibold">SnapSend</span>
          </div>
          <div className="flex space-x-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Support</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Contact</a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-600">
          &copy; {new Date().getFullYear()} SnapSend. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
