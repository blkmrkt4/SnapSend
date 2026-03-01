import { useState } from 'react';
import { Play, X, ImageIcon, Film } from 'lucide-react';

const screenshots = [
  {
    src: '/screenshots/Choose-Select-Devices-or-All.png',
    title: 'Choose Devices',
    description: 'Select specific devices or send to all at once.',
  },
  {
    src: '/screenshots/Smart-naming-or-renaming.png',
    title: 'Smart Naming',
    description: 'AI suggests descriptive filenames automatically.',
  },
  {
    src: '/screenshots/GhostMod-and-OnTop.png',
    title: 'Ghost Mode',
    description: 'Translucent, always-on-top window for quick access.',
  },
  {
    src: '/screenshots/Tagging-Files-for-QuickFinds.png',
    title: 'File Tagging',
    description: 'Tag files for fast search and organization.',
  },
  {
    src: '/screenshots/Take-Screen-Shots.png',
    title: 'Screenshots',
    description: 'Capture and share screenshots directly from the app.',
  },
  {
    src: '/screenshots/Versatile-Settings-for-Firewall.png',
    title: 'Settings & Diagnostics',
    description: 'Connection modes, firewall tools, and more.',
  },
];

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

type Tab = 'screenshots' | 'videos';

export function Screenshots() {
  const [tab, setTab] = useState<Tab>('screenshots');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<'image' | 'video'>('image');

  const openLightbox = (src: string, type: 'image' | 'video') => {
    setLightboxSrc(src);
    setLightboxType(type);
  };

  return (
    <section id="screenshots" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See it in action
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            A clean, focused interface designed for fast transfers.
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-lg border border-gray-700 bg-gray-900/50 p-1">
            <button
              onClick={() => setTab('screenshots')}
              className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === 'screenshots'
                  ? 'bg-teal-dark text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              Screenshots
            </button>
            <button
              onClick={() => setTab('videos')}
              className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === 'videos'
                  ? 'bg-teal-dark text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Film className="h-4 w-4" />
              Videos
            </button>
          </div>
        </div>

        {/* Screenshots grid */}
        {tab === 'screenshots' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {screenshots.map((shot) => (
              <button
                key={shot.src}
                onClick={() => openLightbox(shot.src, 'image')}
                className="group bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden hover:border-teal/40 transition-all text-left"
              >
                <div className="aspect-video relative bg-gray-800/50">
                  <img
                    src={shot.src}
                    alt={shot.title}
                    loading="lazy"
                    className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-1">{shot.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{shot.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Videos grid */}
        {tab === 'videos' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {videos.map((video) => (
              <button
                key={video.src}
                onClick={() => openLightbox(video.src, 'video')}
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
        )}
      </div>

      {/* Lightbox modal */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          <div
            className="relative flex flex-col items-center max-w-5xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-12 right-0 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            {lightboxType === 'video' ? (
              <video
                src={lightboxSrc}
                controls
                autoPlay
                playsInline
                className="w-full rounded-xl shadow-2xl"
              />
            ) : (
              <img
                src={lightboxSrc}
                alt=""
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
