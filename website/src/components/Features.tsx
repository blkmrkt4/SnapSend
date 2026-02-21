import {
  Zap, Shield, Wifi, Users, Tags, Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { features } from '../../../shared/marketing-content';

const iconMap: Record<string, LucideIcon> = {
  Zap, Shield, Wifi, Users, Tags, Smartphone,
};

export function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need for instant sharing
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Built for speed, privacy, and simplicity. To optimize your workflow and organize your screenshots.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = iconMap[feature.icon];
            return (
              <div
                key={feature.title}
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-teal/40 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-teal/10 text-teal mb-4">
                  {Icon && <Icon className="h-6 w-6" />}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
