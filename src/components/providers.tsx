"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";
import type { ReactNode } from "react";
import { useMounted } from "@/lib/use-mounted";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  if (!mounted) return null;
  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      closeButton
      richColors
      duration={3500}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      {children}
      <ThemedToaster />
    </ThemeProvider>
  );
}
