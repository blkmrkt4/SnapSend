import { useState } from 'react';
import { Play, X } from 'lucide-react';

const videos = [
  {
    src: '/videos/Move-File.mp4',
    title: 'Move a File',
    description: 'Drag and drop a file to send it to another device instantly.',
  },
  {
    src: '/videos/ChooseDevices.mp4',
    title: 'Choose Devices',
    description: 'Select which device to send to from automatically discovered peers.',
  },
  {
    src: '/videos/Ghost-Mode.mp4',
    title: 'Ghost Mode',
    description: 'Minimal floating window that stays out of your way while you work.',
  },
  {
    src: '/videos/ClipboardinGhost.mp4',
    title: 'Clipboard in Ghost Mode',
    description: 'Paste clipboard content and send it without leaving your workflow.',
  },
  {
    src: '/videos/TExt-Drop-Better.mp4',
    title: 'Text Drop',
    description: 'Drop text snippets to share them across your devices.',
  },
  {
    src: '/videos/Screen-Tag-Final.mp4',
    title: 'Screenshot & Tag',
    description: 'Capture a screenshot and tag it for easy organization.',
  },
  {
    src: '/videos/Tagging-Final.mp4',
    title: 'Tagging Files',
    description: 'Add tags to any file to keep your transfers organized.',
  },
  {
    src: '/videos/Tagging-Full-Screen.mp4',
    title: 'Full Screen Tagging',
    description: 'Tag and manage files in the full file explorer view.',
  },
];

export function Videos() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  return (
    <section id="videos" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-900/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Watch it in action
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            See how Liquid Relay makes file and clipboard sharing effortless.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {videos.map((video) => (
            <button
              key={video.src}
              onClick={() => setActiveVideo(video.src)}
              className="group bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden hover:border-teal/40 transition-all text-left"
            >
              <div className="aspect-video relative bg-gray-800/50">
                <video
                  src={video.src}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-teal/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="h-5 w-5 text-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-1">{video.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{video.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox modal */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="relative w-full max-w-4xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute -top-12 right-0 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <video
              src={activeVideo}
              controls
              autoPlay
              playsInline
              className="w-full rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </section>
  );
}
