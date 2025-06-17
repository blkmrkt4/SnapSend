import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Check, Zap, Shield, Cloud, Users, FileText, Smartphone, Wifi, Menu, X } from 'lucide-react';

export default function LandingPage() {
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const features = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Lightning Fast Sending",
      description: "Snap and send files, clipboard, and screenshots instantly with real-time technology"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "End-to-End Security",
      description: "Your files are encrypted and secure with advanced authentication protocols"
    },
    {
      icon: <Cloud className="h-6 w-6" />,
      title: "Cross-Platform",
      description: "Works seamlessly across all your devices - desktop, mobile, and tablet"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Multi-Device Sync",
      description: "Connect and sync files across unlimited devices with ease"
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Everything Supported",
      description: "Send files, clipboard text, images, and screenshots - no file type restrictions"
    },
    {
      icon: <Wifi className="h-6 w-6" />,
      title: "Real-Time Collaboration",
      description: "Collaborate in real-time with live file updates and notifications"
    }
  ];

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: '/month',
      description: 'Perfect for personal use',
      features: [
        '2 connected devices',
        '100MB file size limit',
        'Basic file transfer',
        'Email support'
      ],
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$9.99',
      period: '/month',
      description: 'For professionals and teams',
      features: [
        'Unlimited devices',
        '10GB file size limit',
        'Advanced security features',
        'Priority support',
        'File history & versioning',
        'Custom device names'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$29.99',
      period: '/month',
      description: 'For large organizations',
      features: [
        'Everything in Pro',
        'Unlimited file size',
        'Advanced admin controls',
        'SSO integration',
        '24/7 phone support',
        'Custom integrations',
        'Compliance reporting'
      ],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/10">
      {/* Prominent Hamburger Menu */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetTrigger asChild>
          <Button 
            size="lg" 
            className="fixed top-4 left-4 z-50 bg-purple-900 hover:bg-purple-800 text-white border-2 border-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b bg-gradient-to-r from-primary/10 to-secondary/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">SnapSend</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsMenuOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Instantly send files, clipboard, and screenshots
              </p>
            </div>

            {/* Menu Items */}
            <div className="flex-1 p-4">
              <nav className="space-y-2">
                <Link href="/">
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left hover:bg-muted"
                  >
                    <Smartphone className="h-5 w-5" />
                    <span className="font-medium">Home</span>
                  </button>
                </Link>
                <Link href="/auth">
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left hover:bg-muted"
                  >
                    <Users className="h-5 w-5" />
                    <span className="font-medium">Sign In</span>
                  </button>
                </Link>
                <Link href="/auth">
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Zap className="h-5 w-5" />
                    <span className="font-medium">Get Started</span>
                  </button>
                </Link>
              </nav>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Navigation */}
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 ml-16">
              <Smartphone className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">SnapSend</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-6xl font-bold mb-6">
            Send Files, Clipboard &{' '}
            <span className="text-primary">Screenshots</span>{' '}
            Instantly
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            The fastest way to snap and send anything between your devices. 
            Files, clipboard content, and screenshots - all transferred instantly with zero hassle.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth">
              <Button size="lg" className="text-lg px-8 py-3">
                Start Free Trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8 py-3">
              Watch Demo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • 14-day free trial
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need for instant sharing
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built for speed, security, and simplicity. Snap and send anything, anywhere.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg bg-background/60 backdrop-blur-sm">
                <CardHeader>
                  <div className="text-primary mb-4">{feature.icon}</div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that's right for you. Upgrade or downgrade at any time.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  plan.popular 
                    ? 'border-primary shadow-lg scale-105' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedPlan(plan.id as any)}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription className="text-base mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link href="/auth" className="block w-full">
                    <Button 
                      className="w-full mt-6" 
                      variant={plan.popular ? 'default' : 'outline'}
                      size="lg"
                    >
                      {plan.price === '$0' ? 'Get Started Free' : 'Start Free Trial'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to snap and send instantly?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of users who snap and send files, clipboard, and screenshots 
            across their devices effortlessly.
          </p>
          <Link href="/auth">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t bg-background/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Smartphone className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">SnapSend</span>
            </div>
            <div className="flex space-x-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © 2025 SnapSend. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}