export function Privacy({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-3xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
      <button onClick={onBack} className="text-teal hover:text-teal-dark mb-8 text-sm">&larr; Back to home</button>
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300 leading-relaxed">
        <p><strong>Last updated:</strong> March 2026</p>

        <h2 className="text-xl font-semibold text-white mt-8">What we collect</h2>
        <p>Liquid Relay is designed to be private by default. We collect <strong>no usage data, no analytics, no telemetry, and no file contents</strong>. Your files never leave your local network.</p>

        <h2 className="text-xl font-semibold text-white mt-8">License activation</h2>
        <p>When you activate a license, your license key and a machine identifier are sent to our licensing provider (LemonSqueezy) to verify your purchase. No other data is transmitted.</p>

        <h2 className="text-xl font-semibold text-white mt-8">AI Smart Naming</h2>
        <p>If you enable Smart Naming, file contents are processed <strong>locally on your machine</strong> using Ollama. No data is sent to external AI services. The AI model runs entirely on your hardware.</p>

        <h2 className="text-xl font-semibold text-white mt-8">Website</h2>
        <p>This website is hosted on Vercel. Standard web server logs (IP address, browser type, pages visited) may be collected by the hosting provider. We do not use cookies, tracking pixels, or analytics tools.</p>

        <h2 className="text-xl font-semibold text-white mt-8">Data storage</h2>
        <p>All transferred files, tags, and device information are stored locally on your machine. Nothing is stored on our servers. Uninstalling the app removes all data.</p>

        <h2 className="text-xl font-semibold text-white mt-8">Contact</h2>
        <p>Questions about privacy? Email <a href="mailto:Support-LR@byzyb.ai" className="text-teal hover:text-teal-dark">Support-LR@byzyb.ai</a>.</p>
      </div>
    </div>
  );
}
