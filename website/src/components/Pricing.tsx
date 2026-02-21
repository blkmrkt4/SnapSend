import { Check, Monitor } from 'lucide-react';
import { pricingPlans, productInfo } from '../../../shared/marketing-content';

export function Pricing() {
  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-900/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, one-time pricing
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Pay once, use forever. No subscriptions, no recurring fees.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border p-8 ${
                plan.popular
                  ? 'border-teal bg-gray-900/80 shadow-lg shadow-teal/10'
                  : 'border-gray-800 bg-gray-900/50'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-dark text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <p className="text-gray-400 mt-2">{plan.description}</p>
              </div>

              {/* Machine limit callout */}
              <div className="flex items-center justify-center gap-2 bg-teal/10 border border-teal/20 rounded-lg py-3 px-4 mb-6">
                <Monitor className="h-5 w-5 text-teal flex-shrink-0" />
                <span className="text-lg font-semibold text-teal">{plan.machineLimit}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-teal flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={productInfo.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full text-center py-3 rounded-lg font-medium transition-colors ${
                  plan.popular
                    ? 'bg-teal-dark hover:bg-teal text-white'
                    : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white'
                }`}
              >
                Buy {plan.name} License
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
