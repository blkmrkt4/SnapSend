import { Mail, MessageSquarePlus } from 'lucide-react';

export function Contact({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-3xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
      <button onClick={onBack} className="text-teal hover:text-teal-dark mb-8 text-sm">&larr; Back to home</button>
      <h1 className="text-3xl font-bold mb-4">Contact</h1>
      <p className="text-gray-400 mb-10">Get in touch with the Liquid Relay team.</p>

      <div className="space-y-6">
        <a
          href="mailto:Support-LR@byzyb.ai"
          className="flex items-start gap-4 bg-gray-900/50 border border-gray-800 hover:border-teal/40 rounded-xl p-6 transition-colors"
        >
          <Mail className="h-6 w-6 text-teal flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Support</h3>
            <p className="text-sm text-gray-400">Technical help, licensing, setup issues</p>
            <p className="text-sm text-teal mt-2">Support-LR@byzyb.ai</p>
          </div>
        </a>

        <a
          href="mailto:Feedback-LR@byzyb.ai"
          className="flex items-start gap-4 bg-gray-900/50 border border-gray-800 hover:border-teal/40 rounded-xl p-6 transition-colors"
        >
          <MessageSquarePlus className="h-6 w-6 text-teal flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Feedback & Feature Requests</h3>
            <p className="text-sm text-gray-400">Ideas, suggestions, bug reports, general feedback</p>
            <p className="text-sm text-teal mt-2">Feedback-LR@byzyb.ai</p>
          </div>
        </a>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-800">
        <p className="text-sm text-gray-500">
          Liquid Relay is built by{' '}
          <a href="https://byzyb.ai" target="_blank" rel="noopener noreferrer" className="text-teal hover:text-teal-dark">
            byzyb.ai
          </a>
        </p>
      </div>
    </div>
  );
}
