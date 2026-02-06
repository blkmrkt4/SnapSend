import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import {
  Zap,
  Shield,
  Wifi,
  Users,
  FileText,
  Smartphone,
  MousePointerClick,
  Clipboard,
  Camera,
  PenLine,
  LayoutGrid,
  MonitorSmartphone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const heroSlides = [
  {
    headline: 'Two Computers. One Desk. Zero Friction.',
    subtitle:
      'Build on your Mac, deliver from your PC — or the other way around. Liquid Relay moves files and clipboard between machines instantly over your local network. No cloud, no cables, no hassle.',
  },
  {
    headline: 'Stop Emailing Files to Yourself',
    subtitle:
      'Whether you\'re moving code output from your Mac to your work PC or pulling docs between a locked-down laptop and your personal machine — Liquid Relay transfers files across your desk in seconds. Nothing leaves your network.',
  },
  {
    headline: 'Bridge the Gap Between Your Machines',
    subtitle:
      'Dev tools on one computer, work on another. Liquid Relay lets you move files and clipboard between them instantly — direct transfer over your local network, no accounts, no cloud, nothing to configure.',
  },
  {
    headline: 'Work on Any Machine. Move Files Between All of Them.',
    subtitle:
      'Mac to PC, personal to corporate, dev to production — drag, drop, done. Peer-to-peer transfer over your local network. No internet required.',
  },
];

const features = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Direct peer-to-peer transfers over your local network. No cloud relay, no waiting.',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'Files never leave your network. No accounts, no tracking, no data collection.',
  },
  {
    icon: Wifi,
    title: 'No Internet Required',
    description: 'Works on any local network, even air-gapped. Just connect your devices to the same Wi-Fi.',
  },
  {
    icon: Users,
    title: 'Multi-Device',
    description: 'Connect as many devices as you need. Auto-discovery finds peers on your network.',
  },
  {
    icon: FileText,
    title: 'Files & Clipboard',
    description: 'Send files, images, and clipboard text between machines seamlessly.',
  },
  {
    icon: Smartphone,
    title: 'Cross-Platform',
    description: 'Runs on macOS, Windows, and Linux. Any device on the network can participate.',
  },
];

const tutorialSlides = [
  {
    icon: MousePointerClick,
    title: 'Drag & Drop to Send',
    description:
      'Drag files onto the drop zone or click to browse. They\'ll be sent to your connected device instantly.',
  },
  {
    icon: Clipboard,
    title: 'Clipboard Sync',
    description:
      'Copy text on one machine and it appears on the other. Paste images too — they transfer automatically.',
  },
  {
    icon: Camera,
    title: 'Take Screenshots',
    description:
      'Use the screenshot tool to capture and crop a region of your screen. It\'s sent and saved immediately.',
  },
  {
    icon: PenLine,
    title: 'Rename Files Inline',
    description:
      'Click any filename to edit it. The extension stays locked — just type the new name and click away.',
  },
  {
    icon: LayoutGrid,
    title: 'File Actions',
    description:
      'Eye = preview. Down-arrow = download to disk. Square-with-arrow = open in new tab. Pencil = rename. Trash = delete.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Connect Devices',
    description:
      'Devices on the same network discover each other automatically. Go to Devices tab to see and pair with them.',
  },
];

export function HomePage() {
  // Hero carousel state
  const [heroApi, setHeroApi] = useState<CarouselApi>();
  const [heroCurrent, setHeroCurrent] = useState(0);

  const onHeroSelect = useCallback(() => {
    if (!heroApi) return;
    setHeroCurrent(heroApi.selectedScrollSnap());
  }, [heroApi]);

  useEffect(() => {
    if (!heroApi) return;
    onHeroSelect();
    heroApi.on('select', onHeroSelect);
    heroApi.on('reInit', onHeroSelect);
    return () => {
      heroApi.off('select', onHeroSelect);
      heroApi.off('reInit', onHeroSelect);
    };
  }, [heroApi, onHeroSelect]);

  // Tutorial carousel state
  const [tutorialApi, setTutorialApi] = useState<CarouselApi>();
  const [tutorialCurrent, setTutorialCurrent] = useState(0);

  const onTutorialSelect = useCallback(() => {
    if (!tutorialApi) return;
    setTutorialCurrent(tutorialApi.selectedScrollSnap());
  }, [tutorialApi]);

  useEffect(() => {
    if (!tutorialApi) return;
    onTutorialSelect();
    tutorialApi.on('select', onTutorialSelect);
    tutorialApi.on('reInit', onTutorialSelect);
    return () => {
      tutorialApi.off('select', onTutorialSelect);
      tutorialApi.off('reInit', onTutorialSelect);
    };
  }, [tutorialApi, onTutorialSelect]);

  return (
    <div className="space-y-10 pb-8">
      {/* Hero Carousel */}
      <section
        className="-mx-4 px-4 py-8 rounded-xl border"
        style={{
          borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
          background: 'linear-gradient(to top, color-mix(in srgb, var(--primary) 25%, transparent), color-mix(in srgb, var(--primary) 8%, transparent))',
        }}
      >
        <div className="relative flex items-center">
          <button
            onClick={() => heroApi?.scrollPrev()}
            className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Previous headline"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <Carousel
            setApi={setHeroApi}
            opts={{ loop: true }}
            plugins={[Autoplay({ delay: 8000, stopOnInteraction: true })]}
            className="flex-1"
          >
            <CarouselContent>
              {heroSlides.map((slide, index) => (
                <CarouselItem key={index}>
                  <div className="text-center px-6">
                    <h1 className="text-3xl font-bold tracking-tight">
                      {slide.headline}
                    </h1>
                    <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                      {slide.subtitle}
                    </p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          <button
            onClick={() => heroApi?.scrollNext()}
            className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Next headline"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Hero dots */}
        <div className="flex justify-center gap-2 mt-5">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => heroApi?.scrollTo(index)}
              className="h-2.5 w-2.5 rounded-full transition-all"
              style={{
                backgroundColor: index === heroCurrent
                  ? 'var(--primary)'
                  : 'color-mix(in srgb, var(--foreground) 35%, transparent)',
              }}
              aria-label={`Go to headline ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Feature Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-md bg-primary/10 p-2 shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Tutorial Carousel */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-center">How to Use Liquid <em>Relay</em></h2>
        <div className="px-12">
          <Carousel setApi={setTutorialApi} opts={{ loop: true, align: 'center' }}>
            <CarouselContent>
              {tutorialSlides.map((slide, index) => {
                const Icon = slide.icon;
                const isCurrent = index === tutorialCurrent;
                return (
                  <CarouselItem key={index} className="basis-1/3 pl-4">
                    <Card
                      className={`transition-all duration-200 ${
                        isCurrent
                          ? 'ring-2 ring-primary shadow-lg scale-[1.02]'
                          : 'opacity-60'
                      }`}
                    >
                      <CardContent className="flex flex-col items-center text-center p-6 space-y-3">
                        <div className="rounded-full bg-primary/10 p-3">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-semibold text-sm">{slide.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {slide.description}
                        </p>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>

          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {tutorialSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => tutorialApi?.scrollTo(index)}
                className="h-2.5 w-2.5 rounded-full transition-all"
                style={{
                  backgroundColor: index === tutorialCurrent
                    ? 'var(--primary)'
                    : 'color-mix(in srgb, var(--foreground) 35%, transparent)',
                }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
