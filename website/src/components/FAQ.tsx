import { licensingFAQ } from '../../../shared/marketing-content';

const generalFAQ = [
  {
    question: 'What is Liquid Relay?',
    answer:
      'Liquid Relay is a desktop app that lets you transfer files and clipboard content between your computers on the same network. Everything stays local — no cloud, no internet required.',
  },
  {
    question: 'How does it work?',
    answer:
      'Install the app on each computer you want to connect. They automatically discover each other on your network using mDNS. Pair two machines, then drag-and-drop files, paste clipboard content, or take screenshots to send instantly.',
  },
  {
    question: 'Is my data sent to the cloud?',
    answer:
      'No. Liquid Relay is 100% local. Files transfer directly between your machines over your network. Nothing is uploaded, stored, or routed through any external server.',
  },
  {
    question: 'What is AI Smart Naming?',
    answer:
      'Smart Naming uses a local AI model (via Ollama) to automatically give meaningful names to screenshots and clipboard pastes. For example, a screenshot might be renamed from "screenshot-1709312400.png" to "login-page-dark-mode.png". The AI runs entirely on your machine — nothing is sent externally.',
  },
  {
    question: 'Do I need to install Ollama for the app to work?',
    answer:
      'No. Ollama is optional and only needed if you want the AI Smart Naming feature. The core file transfer functionality works without it.',
  },
  {
    question: 'Can I use it between Mac and Windows?',
    answer:
      'Yes. Liquid Relay works across macOS and Windows. You can transfer files between any combination of Mac and Windows machines on the same network.',
  },
  {
    question: 'How many files can I transfer at once?',
    answer:
      'There is no hard limit. You can drag and drop multiple files or an entire folder and they will transfer sequentially. Large files transfer directly over your local network, so speed depends on your network connection.',
  },
  {
    question: 'Does it work without Wi-Fi?',
    answer:
      'It works on any local network — Wi-Fi, Ethernet, or a mix of both. As long as the machines can see each other on the network, Liquid Relay will work. It does not require internet access.',
  },
];

export function FAQ({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-3xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
      <button onClick={onBack} className="text-teal hover:text-teal-dark mb-8 text-sm">&larr; Back to home</button>
      <h1 className="text-3xl font-bold mb-4">Frequently Asked Questions</h1>
      <p className="text-gray-400 mb-12">Everything you need to know about Liquid Relay.</p>

      <div className="mb-16">
        <h2 className="text-xl font-semibold mb-6 text-teal">General</h2>
        <div className="space-y-5">
          {generalFAQ.map((item) => (
            <div
              key={item.question}
              className="border border-gray-800 rounded-xl p-6 bg-gray-900/30"
            >
              <h3 className="text-lg font-semibold mb-2">{item.question}</h3>
              <p className="text-gray-400 leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-6 text-teal">Licensing & Pricing</h2>
        <div className="space-y-5">
          {licensingFAQ.map((item) => (
            <div
              key={item.question}
              className="border border-gray-800 rounded-xl p-6 bg-gray-900/30"
            >
              <h3 className="text-lg font-semibold mb-2">{item.question}</h3>
              <p className="text-gray-400 leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
