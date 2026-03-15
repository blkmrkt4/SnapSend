import { Apple, Monitor } from 'lucide-react';
import { productInfo } from '../../../shared/marketing-content';


export function Download() {
  return (
    <section id="download" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-900/30">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Download Liquid Relay
        </h2>
        <p className="text-xl text-gray-400 mb-12">
          Available for macOS and Windows. One-time purchase, no subscription.
        </p>

        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <a
            href={productInfo.downloadMacArmUrl}
            className="flex flex-col items-center gap-3 bg-gray-900/50 border border-gray-800 hover:border-teal/40 rounded-xl p-6 transition-colors"
          >
            <Apple className="h-10 w-10 text-gray-300" />
            <div>
              <p className="font-semibold">Mac (Apple Silicon)</p>
              <p className="text-sm text-gray-500">M1, M2, M3, M4</p>
            </div>
          </a>

          <a
            href={productInfo.downloadWindowsUrl}
            className="flex flex-col items-center gap-3 bg-gray-900/50 border border-gray-800 hover:border-teal/40 rounded-xl p-6 transition-colors"
          >
            <Monitor className="h-10 w-10 text-gray-300" />
            <div>
              <p className="font-semibold">Windows</p>
              <p className="text-sm text-gray-500">Windows 10+</p>
            </div>
          </a>
        </div>

        <p className="text-sm text-gray-500 mt-8">
          Need a license? <a href="#pricing" className="text-teal hover:text-teal-dark underline">See pricing</a> — then download and activate.
        </p>
      </div>
    </section>
  );
}
