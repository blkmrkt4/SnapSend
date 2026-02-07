import { Zap, Shield, Wifi, Users, FileText, Smartphone } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Direct peer-to-peer transfer over your local network. No upload/download — files move at LAN speed.',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'Data never leaves your network. No cloud servers, no accounts, no tracking. Your files stay yours.',
  },
  {
    icon: Wifi,
    title: 'No Internet Required',
    description: 'Works on air-gapped networks. Devices discover each other via mDNS — zero configuration needed.',
  },
  {
    icon: Users,
    title: 'Multi-Device',
    description: 'Connect any number of machines on your LAN. Send to one or broadcast to all.',
  },
  {
    icon: FileText,
    title: 'Files & Clipboard',
    description: 'Send any file type, clipboard text, or screenshots. Drag, paste, or pick — it just works.',
  },
  {
    icon: Smartphone,
    title: 'Cross-Platform',
    description: 'Native desktop app for macOS and Windows. Same experience on every machine.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need for instant sharing
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Built for speed, privacy, and simplicity. Drag or paste to send anything on your network.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-purple-500/40 transition-colors"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/10 text-purple-400 mb-4">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
