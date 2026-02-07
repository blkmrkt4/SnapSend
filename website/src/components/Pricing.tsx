import { Check } from 'lucide-react';

const CHECKOUT_URL = 'https://snapsend.lemonsqueezy.com/buy';

const plans = [
  {
    name: 'Personal',
    price: '$9.99',
    period: 'one-time',
    description: 'For individuals with a few machines',
    features: [
      'Install on up to 3 machines',
      'Unlimited file transfers',
      'All file types supported',
      'Clipboard & screenshot sharing',
      'Free updates',
    ],
    popular: true,
  },
  {
    name: 'Team',
    price: '$24.99',
    period: 'one-time',
    description: 'For teams and studios',
    features: [
      'Install on up to 10 machines',
      'Unlimited file transfers',
      'All file types supported',
      'Clipboard & screenshot sharing',
      'Free updates',
      'Priority support',
    ],
    popular: false,
  },
];

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
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border p-8 ${
                plan.popular
                  ? 'border-purple-500 bg-gray-900/80 shadow-lg shadow-purple-500/10'
                  : 'border-gray-800 bg-gray-900/50'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <p className="text-gray-400 mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-purple-400 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full text-center py-3 rounded-lg font-medium transition-colors ${
                  plan.popular
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
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
