import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import { ActivationScreen } from "@/components/ActivationScreen";

function App() {
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    async function checkLicense() {
      if (window.electronAPI?.validateLicense) {
        const result = await window.electronAPI.validateLicense();
        setIsActivated(result.isActivated);
      } else {
        // Browser dev mode — skip activation
        setIsActivated(true);
      }
      setLicenseChecked(true);
    }
    checkLicense();
  }, []);

  if (!licenseChecked) {
    return null; // Loading
  }

  if (!isActivated) {
    return (
      <TooltipProvider>
        <ActivationScreen onActivated={() => setIsActivated(true)} />
      </TooltipProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Home />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
