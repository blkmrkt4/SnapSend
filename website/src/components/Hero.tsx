import { Droplets } from 'lucide-react';
import { productInfo } from '../../../shared/marketing-content';

export function Hero() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-teal/10 border border-teal/20 rounded-full px-4 py-1.5 mb-8">
          <Droplets className="h-4 w-4 text-teal" />
          <span className="text-sm text-teal">Peer-to-peer. No cloud. No accounts.</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
          Send Files & Clipboard{' '}
          <span className="bg-gradient-to-r from-teal to-teal-dark bg-clip-text text-transparent">
            Instantly
          </span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
          {productInfo.description}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#download"
            className="bg-teal-dark hover:bg-teal text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors inline-flex items-center justify-center"
          >
            Download for Mac
          </a>
          <a
            href="#download"
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors inline-flex items-center justify-center"
          >
            Download for Windows
          </a>
          <a
            href={productInfo.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-teal text-teal hover:bg-teal/10 px-8 py-3 rounded-lg text-lg font-medium transition-colors inline-flex items-center justify-center"
          >
            Buy License
          </a>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          {productInfo.supportedPlatforms.join(' and ')} supported. One-time purchase, no subscription.
        </p>
      </div>
    </section>
  );
}
