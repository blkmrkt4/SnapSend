import { licensingFAQ } from '../../../shared/marketing-content';

export function LicensingFAQ() {
  return (
    <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Frequently asked questions
          </h2>
          <p className="text-xl text-gray-400">
            Everything you need to know about licensing and support.
          </p>
        </div>

        <div className="space-y-6">
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
    </section>
  );
}
