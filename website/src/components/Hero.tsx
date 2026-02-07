import { Smartphone } from 'lucide-react';

const DOWNLOAD_MAC_URL = '#download';
const DOWNLOAD_WIN_URL = '#download';
const CHECKOUT_URL = 'https://snapsend.lemonsqueezy.com/buy';

export function Hero() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-8">
          <Smartphone className="h-4 w-4 text-purple-400" />
          <span className="text-sm text-purple-300">Peer-to-peer. No cloud. No accounts.</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
          Send Files & Clipboard{' '}
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Instantly
          </span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
          Transfer files, clipboard text, and screenshots between devices on your local
          network. Direct peer-to-peer — no internet required, nothing leaves your LAN.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={DOWNLOAD_MAC_URL}
            className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors inline-flex items-center justify-center"
          >
            Download for Mac
          </a>
          <a
            href={DOWNLOAD_WIN_URL}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors inline-flex items-center justify-center"
          >
            Download for Windows
          </a>
          <a
            href={CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-purple-500 text-purple-400 hover:bg-purple-500/10 px-8 py-3 rounded-lg text-lg font-medium transition-colors inline-flex items-center justify-center"
          >
            Buy License
          </a>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          macOS 12+ and Windows 10+ supported. One-time purchase, no subscription.
        </p>
      </div>
    </section>
  );
}
