import { productInfo } from '../../../shared/marketing-content';

export function CTA() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-teal-dark/30 to-navy/40">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-6">
          Ready to bridge your machines?
        </h2>
        <p className="text-xl text-gray-300 mb-8">
          Download Liquid Relay and start transferring files across your devices instantly.
          No sign-up, no cloud, no hassle.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#download"
            className="bg-white text-gray-900 hover:bg-gray-200 px-8 py-3 rounded-lg text-lg font-medium transition-colors inline-flex items-center justify-center"
          >
            Download Now
          </a>
          <a
            href={productInfo.checkoutPersonalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/30 text-white hover:bg-white/10 px-8 py-3 rounded-lg text-lg font-medium transition-colors inline-flex items-center justify-center"
          >
            Buy Personal
          </a>
          <a
            href={productInfo.checkoutTeamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/20 text-gray-300 hover:bg-white/10 px-8 py-3 rounded-lg text-lg font-medium transition-colors inline-flex items-center justify-center"
          >
            Buy Team
          </a>
        </div>
      </div>
    </section>
  );
}
