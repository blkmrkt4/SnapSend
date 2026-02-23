import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, CheckCircle2, XCircle, Download, ExternalLink, Loader2 } from 'lucide-react';
import type { OllamaStatus } from '@/types/electron';

interface SmartNamingSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'welcome' | 'ollama-check' | 'model-pull' | 'done';

const IMAGE_MODEL = 'llava';
const TEXT_MODEL = 'phi3:mini';

export function SmartNamingSetupModal({ open, onOpenChange }: SmartNamingSetupModalProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [pullProgress, setPullProgress] = useState<Record<string, { status: string; percent: number }>>({});
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullComplete, setPullComplete] = useState<Record<string, boolean>>({});

  const checkOllama = useCallback(async () => {
    if (!window.electronAPI?.isElectron) return;
    setChecking(true);
    try {
      const status = await window.electronAPI.checkOllamaStatus();
      setOllamaStatus(status);
      if (status.running && step === 'ollama-check') {
        setStep('model-pull');
      }
    } catch {
      setOllamaStatus({ running: false, models: [] });
    }
    setChecking(false);
  }, [step]);

  useEffect(() => {
    if (open && step === 'ollama-check') {
      checkOllama();
    }
  }, [open, step, checkOllama]);

  // Listen for pull progress events
  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;
    window.electronAPI.onOllamaPullProgress((data) => {
      setPullProgress((prev) => ({
        ...prev,
        [data.model]: { status: data.status, percent: data.percent ?? 0 },
      }));
      if (data.status === 'success') {
        setPullComplete((prev) => ({ ...prev, [data.model]: true }));
        setPullingModel(null);
      }
    });
  }, []);

  const handlePullModel = async (modelName: string) => {
    if (!window.electronAPI?.isElectron || pullingModel) return;
    setPullingModel(modelName);
    setPullProgress((prev) => ({ ...prev, [modelName]: { status: 'starting...', percent: 0 } }));
    try {
      await window.electronAPI.pullOllamaModel(modelName);
      setPullComplete((prev) => ({ ...prev, [modelName]: true }));
    } catch {
      setPullProgress((prev) => ({ ...prev, [modelName]: { status: 'failed', percent: 0 } }));
    }
    setPullingModel(null);
  };

  const handleEnable = async () => {
    if (!window.electronAPI?.isElectron) return;
    await window.electronAPI.setSmartNaming(true);
    onOpenChange(false);
    // Reset for next open
    setStep('welcome');
  };

  const isModelAvailable = (modelName: string): boolean => {
    if (pullComplete[modelName]) return true;
    if (!ollamaStatus) return false;
    return ollamaStatus.models.some(
      (m) => m === modelName || m.startsWith(`${modelName}:`)
    );
  };

  const allModelsAvailable = isModelAvailable(IMAGE_MODEL) && isModelAvailable(TEXT_MODEL);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('welcome');
      setPullProgress({});
      setPullingModel(null);
      setPullComplete({});
      setOllamaStatus(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Naming Setup
          </DialogTitle>
        </DialogHeader>

        {step === 'welcome' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Smart Naming uses local AI models via <strong>Ollama</strong> to automatically suggest
              descriptive names for transferred files.
            </p>
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                <span>Images analyzed with <strong>LLaVA</strong> vision model (~4.7GB)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                <span>Text files analyzed with <strong>Phi-3 Mini</strong> language model (~2.3GB)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                <span>All processing runs <strong>locally</strong> on your machine — nothing sent to the cloud</span>
              </div>
            </div>
            <Button className="w-full" onClick={() => setStep('ollama-check')}>
              Continue
            </Button>
          </div>
        )}

        {step === 'ollama-check' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Checking if Ollama is running on your machine...
            </p>

            {checking ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking for Ollama (will auto-start if installed)...
              </div>
            ) : ollamaStatus?.running ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Ollama is running
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <XCircle className="h-4 w-4" />
                  Ollama not detected
                </div>
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <p className="font-medium">To install Ollama:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>
                      Visit{' '}
                      <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-1"
                      >
                        ollama.com <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>Download and install for your platform</li>
                    <li>Start the Ollama app</li>
                  </ol>
                </div>
                <Button variant="outline" className="w-full" onClick={checkOllama}>
                  Check Again
                </Button>
              </div>
            )}

            {ollamaStatus?.running && (
              <Button className="w-full" onClick={() => setStep('model-pull')}>
                Continue
              </Button>
            )}
          </div>
        )}

        {step === 'model-pull' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The following models are needed for Smart Naming:
            </p>

            <div className="space-y-3">
              {[
                { name: IMAGE_MODEL, label: 'LLaVA (Vision)', size: '~4.7GB' },
                { name: TEXT_MODEL, label: 'Phi-3 Mini (Text)', size: '~2.3GB' },
              ].map(({ name, label, size }) => {
                const available = isModelAvailable(name);
                const progress = pullProgress[name];
                const pulling = pullingModel === name;

                return (
                  <div key={name} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{size}</span>
                      </div>
                      {available ? (
                        <Badge className="bg-green-600 text-xs">Available</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not Pulled</Badge>
                      )}
                    </div>

                    {!available && !pulling && !progress && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs"
                        onClick={() => handlePullModel(name)}
                        disabled={!!pullingModel}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Pull Model
                      </Button>
                    )}

                    {(pulling || (progress && !available)) && (
                      <div className="space-y-1.5">
                        <Progress value={progress?.percent ?? 0} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{progress?.status || 'Starting...'}</span>
                          <span>{progress?.percent ?? 0}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {allModelsAvailable ? (
              <Button className="w-full" onClick={() => setStep('done')}>
                Continue
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Pull at least one model to continue, or pull both for full coverage.
              </p>
            )}

            {(isModelAvailable(IMAGE_MODEL) || isModelAvailable(TEXT_MODEL)) && !allModelsAvailable && (
              <Button variant="outline" className="w-full" onClick={() => setStep('done')}>
                Skip — use available models only
              </Button>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Ready to go!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Smart Naming will automatically suggest descriptive names for your transferred files.
              </p>
            </div>
            <Button className="w-full" onClick={handleEnable}>
              Enable Smart Naming
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
