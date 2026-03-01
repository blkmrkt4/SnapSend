export function Terms({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-3xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
      <button onClick={onBack} className="text-teal hover:text-teal-dark mb-8 text-sm">&larr; Back to home</button>
      <h1 className="text-3xl font-bold mb-8">Terms of Use</h1>
      <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300 leading-relaxed">
        <p><strong>Last updated:</strong> March 2026</p>

        <h2 className="text-xl font-semibold text-white mt-8">License</h2>
        <p>Liquid Relay is licensed software, not sold. A valid license key grants you the right to use the software on the number of machines specified by your plan (Personal: 3 machines, Team: 10 machines).</p>

        <h2 className="text-xl font-semibold text-white mt-8">Permitted use</h2>
        <p>You may install and use Liquid Relay on machines you own or control. You may not redistribute, sublicense, reverse engineer, or modify the software.</p>

        <h2 className="text-xl font-semibold text-white mt-8">Updates</h2>
        <p>Your license includes free updates for the major version you purchased. We may release new major versions that require a separate purchase.</p>

        <h2 className="text-xl font-semibold text-white mt-8">Refunds</h2>
        <p>We offer a 14-day refund policy from the date of purchase if the software does not work for your use case. Contact <a href="mailto:Support-LR@byzyb.ai" className="text-teal hover:text-teal-dark">Support-LR@byzyb.ai</a> to request a refund.</p>

        <h2 className="text-xl font-semibold text-white mt-8">Disclaimer</h2>
        <p>Liquid Relay is provided "as is" without warranty of any kind. We are not liable for any data loss, damages, or issues arising from the use of the software. You are responsible for your own data and backups.</p>

        <h2 className="text-xl font-semibold text-white mt-8">Changes</h2>
        <p>We may update these terms from time to time. Continued use of the software constitutes acceptance of the updated terms.</p>
      </div>
    </div>
  );
}
