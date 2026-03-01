import { Droplets, Download, KeyRound, Monitor } from 'lucide-react';
import { productInfo } from '../../../shared/marketing-content';

const steps = [
  {
    icon: Download,
    number: '1',
    title: 'Download',
    description: 'Install on each computer',
  },
  {
    icon: KeyRound,
    number: '2',
    title: 'Buy a License',
    description: 'One-time purchase, no subscription',
  },
  {
    icon: Monitor,
    number: '3',
    title: 'Activate',
    description: "Activate your PC's and Mac's",
  },
];

export function Hero() {
  return (
    <section className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-teal/10 border border-teal/20 rounded-full px-4 py-1.5 mb-8">
          <Droplets className="h-4 w-4 text-teal" />
          <span className="text-sm text-teal">Peer-to-peers. No cloud. No accounts.</span>
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

        <p className="text-sm text-gray-500 mt-4 mb-14">
          {productInfo.supportedPlatforms.join(' and ')} supported. One-time purchase, no subscription.
        </p>

        {/* Get Started steps */}
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-4 sm:gap-0">
            {steps.map((step, i) => (
              <div key={step.title} className="flex items-center">
                <div className="flex flex-col items-center text-center px-2 sm:px-6">
                  <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal/10 text-teal mb-3">
                    <step.icon className="h-6 w-6" />
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-teal-dark text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {step.number}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-gray-200">{step.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 max-w-[140px]">{step.description}</div>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden sm:block w-12 h-px bg-gray-700 mb-8 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
