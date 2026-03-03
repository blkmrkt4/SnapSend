import { Droplets } from 'lucide-react';

export function Demo({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-4xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
      <button onClick={onBack} className="text-teal hover:text-teal-dark mb-8 text-sm">&larr; Back to home</button>
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-4">
          <Droplets className="h-8 w-8 text-teal" />
          <h1 className="text-3xl font-bold">Liquid Relay</h1>
        </div>
        <p className="text-gray-400">
          Transfer files, clipboard text, and screenshots between devices on your local network.
          No cloud. No accounts. No internet required.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-800 bg-black">
        <video
          controls
          autoPlay
          className="w-full"
          poster=""
        >
          <source src="/videos/Overall-LR.mp4" type="video/mp4" />
          Your browser does not support video playback.
        </video>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        2 minute overview — file transfer, screenshots, clipboard sync, and device discovery.
      </div>
    </div>
  );
}
