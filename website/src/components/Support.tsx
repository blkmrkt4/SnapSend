import { Mail, MessageSquarePlus, Bug, HelpCircle } from 'lucide-react';

export function Support({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-3xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
      <button onClick={onBack} className="text-teal hover:text-teal-dark mb-8 text-sm">&larr; Back to home</button>
      <h1 className="text-3xl font-bold mb-4">Support</h1>
      <p className="text-gray-400 mb-10">We're here to help. Reach out using any of the options below.</p>

      <div className="grid sm:grid-cols-2 gap-6">
        <a
          href="mailto:Support-LR@byzyb.ai"
          className="flex items-start gap-4 bg-gray-900/50 border border-gray-800 hover:border-teal/40 rounded-xl p-6 transition-colors"
        >
          <Mail className="h-6 w-6 text-teal flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Email Support</h3>
            <p className="text-sm text-gray-400">Get help with setup, troubleshooting, or licensing issues.</p>
            <p className="text-sm text-teal mt-2">Support-LR@byzyb.ai</p>
          </div>
        </a>

        <a
          href="mailto:Feedback-LR@byzyb.ai?subject=Bug Report"
          className="flex items-start gap-4 bg-gray-900/50 border border-gray-800 hover:border-teal/40 rounded-xl p-6 transition-colors"
        >
          <Bug className="h-6 w-6 text-teal flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Report a Bug</h3>
            <p className="text-sm text-gray-400">Found something that's not working? Let us know and we'll fix it.</p>
            <p className="text-sm text-teal mt-2">Feedback-LR@byzyb.ai</p>
          </div>
        </a>

        <a
          href="mailto:Feedback-LR@byzyb.ai?subject=Feature Suggestion"
          className="flex items-start gap-4 bg-gray-900/50 border border-gray-800 hover:border-teal/40 rounded-xl p-6 transition-colors"
        >
          <MessageSquarePlus className="h-6 w-6 text-teal flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Suggest a Feature</h3>
            <p className="text-sm text-gray-400">Have an idea that would make Liquid Relay better? We'd love to hear it.</p>
            <p className="text-sm text-teal mt-2">Feedback-LR@byzyb.ai</p>
          </div>
        </a>

        <a
          href="#faq"
          className="flex items-start gap-4 bg-gray-900/50 border border-gray-800 hover:border-teal/40 rounded-xl p-6 transition-colors"
        >
          <HelpCircle className="h-6 w-6 text-teal flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">FAQ</h3>
            <p className="text-sm text-gray-400">Check the frequently asked questions on our home page for quick answers.</p>
          </div>
        </a>
      </div>
    </div>
  );
}
