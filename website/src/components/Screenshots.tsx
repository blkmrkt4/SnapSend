import { MonitorSmartphone } from 'lucide-react';

export function Screenshots() {
  return (
    <section id="screenshots" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See it in action
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            A clean, focused interface designed for fast transfers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {['File Transfer', 'Device Discovery'].map((label) => (
            <div
              key={label}
              className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
            >
              <div className="aspect-video flex items-center justify-center bg-gray-800/50">
                <div className="text-center text-gray-500">
                  <MonitorSmartphone className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs mt-1 opacity-60">Screenshot coming soon</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
