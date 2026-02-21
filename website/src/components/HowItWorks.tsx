import { Search, Link, Send, type LucideIcon } from 'lucide-react';
import { howItWorksSteps } from '../../../shared/marketing-content';

const iconMap: Record<string, LucideIcon> = { Search, Link, Send };

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-900/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How it works
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Three steps. Zero configuration. Just works.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {howItWorksSteps.map((step, index) => {
            const Icon = iconMap[step.icon];
            return (
              <div key={step.title} className="text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal/10 text-teal mb-6">
                  {Icon && <Icon className="h-7 w-7" />}
                  <span className="absolute -top-2 -right-2 w-7 h-7 bg-teal-dark text-white text-sm font-bold rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
