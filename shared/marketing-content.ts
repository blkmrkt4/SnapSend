// Shared marketing content — single source of truth for product copy.
// Both the in-app HomePage and the public website import from here.
// Icon references use string names so each consumer can resolve them
// from their own icon library (lucide-react, etc.).

export const productInfo = {
  name: 'Liquid Relay',
  tagline: 'Send Files & Clipboard Instantly',
  description:
    'Transfer files, clipboard text, and screenshots between devices on your local network. Direct peer-to-peers — no internet required, nothing leaves your network.',
  supportedPlatforms: ['macOS 12+', 'Windows 10+'],
  checkoutPersonalUrl: 'https://store.liquid-relay.com/checkout/buy/a4ae54ef-1ff6-43cd-9262-4a57685ffc80',
  checkoutTeamUrl: 'https://store.liquid-relay.com/checkout/buy/57c61884-aca7-46b7-b514-d7a165a16b9c',
  storeUrl: 'https://store.liquid-relay.com',
  downloadMacArmUrl: 'https://github.com/blkmrkt4/SnapSend/releases/download/v3.75.1/LiquidRelay-Mac-arm64-3.75.1.dmg',
  downloadMacIntelUrl: '#download',
  downloadWindowsUrl: 'https://github.com/blkmrkt4/SnapSend/releases/download/v3.75.1/LiquidRelaySetup-3.75.1.exe',
};

export interface HeroSlide {
  headline: string;
  subtitle: string;
}

export const heroSlides: HeroSlide[] = [
  {
    headline: 'Two Computers. One Desk. Zero Friction.',
    subtitle:
      'Build on your Mac, deliver from your PC — or the other way around. Liquid Relay moves files and clipboard between machines instantly over your local network. No cloud, no cables, no hassle.',
  },
  {
    headline: 'Stop Emailing Files to Yourself',
    subtitle:
      "Whether you're moving code output from your Mac to your work PC or pulling docs between a locked-down laptop and your personal machine — Liquid Relay transfers files across your desk in seconds. Nothing leaves your network.",
  },
  {
    headline: 'Bridge the Gap Between Your Machines',
    subtitle:
      'Dev tools on one computer, work on another. Liquid Relay lets you move files and clipboard between them instantly — direct transfer over your local network, no accounts, no cloud, nothing to configure.',
  },
  {
    headline: 'Work on Any Machine. Move Files Between All of Them.',
    subtitle:
      'Mac to PC, personal to corporate, dev to production — drag, drop, done. Tag and organize everything you transfer. Peer-to-peer over your local network. No internet required.',
  },
];

export interface Feature {
  icon: string;
  title: string;
  description: string;
}

export const features: Feature[] = [
  {
    icon: 'Zap',
    title: 'Lightning Fast',
    description:
      'Direct peer-to-peers transfers over your local network. No cloud relay, no waiting.',
  },
  {
    icon: 'Shield',
    title: 'Private & Secure',
    description:
      'Files never leave your network. No accounts, no tracking, no data collection.',
  },
  {
    icon: 'Wifi',
    title: 'No Internet Required',
    description:
      'Works on any local network, even air-gapped. Just connect your devices to the same Wi-Fi.',
  },
  {
    icon: 'Users',
    title: 'Multi-Device',
    description:
      'Connect as many devices as you need. Auto-discovery finds peers on your network.',
  },
  {
    icon: 'Tags',
    title: 'Tag & Organize',
    description:
      'Tag your files, filter by type or date, search by name. Build a catalog of everything you transfer.',
  },
  {
    icon: 'Sparkles',
    title: 'AI Smart Naming',
    description:
      'Clipboard pastes and screenshots get descriptive AI-generated filenames automatically. Rename any file on demand with one click.',
  },
];

export interface TutorialSlide {
  icon: string;
  title: string;
  description: string;
}

export const tutorialSlides: TutorialSlide[] = [
  {
    icon: 'MousePointerClick',
    title: 'Drag & Drop to Send',
    description:
      "Drag files onto the drop zone or click to browse. They'll be sent to your connected device instantly.",
  },
  {
    icon: 'Clipboard',
    title: 'Clipboard Sync',
    description:
      'Press \u2318V (or Ctrl+V) anywhere to send your clipboard. Text and images transfer automatically.',
  },
  {
    icon: 'Camera',
    title: 'Capture Screenshots',
    description:
      'Take full-screen shots, capture a window, or select a region to crop. Screenshots save and transfer instantly.',
  },
  {
    icon: 'PenLine',
    title: 'Rename Files Inline',
    description:
      "Click any filename to edit it. The extension stays locked — just type the new name and click away.",
  },
  {
    icon: 'LayoutGrid',
    title: 'File Actions',
    description:
      'Eye = preview. Down-arrow = download. Square-with-arrow = open in new tab. Pencil = rename. Trash = delete.',
  },
  {
    icon: 'Tags',
    title: 'Tag & Filter Files',
    description:
      'Add tags to organize your files. Filter by type (screenshots, PDFs, images), by date range, or search by name.',
  },
  {
    icon: 'MonitorSmartphone',
    title: 'Connect Devices',
    description:
      'Devices discover each other automatically. If discovery fails, switch to Client Mode in Settings to connect manually.',
  },
];

export interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  machineLimit: string;
  features: string[];
  popular: boolean;
  checkoutUrl: string;
}

export const pricingPlans: PricingPlan[] = [
  {
    name: 'Personal',
    price: '$24.99',
    period: 'one-time',
    description: 'For individuals with a few machines',
    machineLimit: '3 machines',
    features: [
      'Unlimited file transfers',
      'All file types supported',
      'Clipboard & screenshot sharing',
      'Free updates',
    ],
    checkoutUrl: productInfo.checkoutPersonalUrl,
    popular: true,
  },
  {
    name: 'Team',
    price: '$59.99',
    period: 'one-time',
    description: 'For teams and studios',
    machineLimit: '10 machines',
    features: [
      'Unlimited file transfers',
      'All file types supported',
      'Clipboard & screenshot sharing',
      'Free updates',
      'Priority support',
    ],
    checkoutUrl: productInfo.checkoutTeamUrl,
    popular: false,
  },
];

export interface HowItWorksStep {
  icon: string;
  title: string;
  description: string;
}

export const howItWorksSteps: HowItWorksStep[] = [
  {
    icon: 'Search',
    title: 'Discover',
    description:
      'Devices on your network find each other automatically via mDNS. No setup, no server.',
  },
  {
    icon: 'Link',
    title: 'Connect',
    description:
      'Pair devices with one click. A direct peer-to-peers connection is established instantly.',
  },
  {
    icon: 'Send',
    title: 'Transfer',
    description:
      'Drag files, paste clipboard, or capture screenshots. Everything moves at full network speed.',
  },
];

export interface FAQItem {
  question: string;
  answer: string;
}

export const licensingFAQ: FAQItem[] = [
  {
    question: 'Is this a subscription?',
    answer:
      'No. Liquid Relay is a one-time purchase. You pay once and own it forever — no recurring fees.',
  },
  {
    question: 'How many machines can I install on?',
    answer:
      'The Personal license ($24.99) covers up to 3 machines. The Team license ($59.99) covers up to 10. All machines must be yours or your organization\'s.',
  },
  {
    question: 'What platforms are supported?',
    answer:
      'macOS 12+ (Apple Silicon and Intel) and Windows 10+. Linux support is on the roadmap.',
  },
  {
    question: 'Do I need internet to use it?',
    answer:
      'No. Liquid Relay works entirely on your local network. No internet connection required — it even works on air-gapped networks.',
  },
  {
    question: 'What\'s included in free updates?',
    answer:
      'All feature updates and bug fixes for the major version you purchased. We ship updates regularly.',
  },
  {
    question: 'Can I get a refund?',
    answer:
      'Yes — within 14 days of purchase if the app doesn\'t work for your use case. Contact us and we\'ll sort it out.',
  },
];
