import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppStateProvider } from "@/components/app-state";
import { TooltipProvider } from "@/components/ui/primitives";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HRMS-NEW · Stellar Technologies",
    template: "%s · HRMS-NEW",
  },
  description:
    "HRMS-NEW — enterprise HR management for the full employee lifecycle. Interactive demo build.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning className={inter.variable}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AppStateProvider>
            <TooltipProvider delayDuration={250} skipDelayDuration={300}>
              {children}
              <Toaster
                position="bottom-right"
                closeButton
                toastOptions={{
                  classNames: {
                    toast:
                      "!bg-popover !text-popover-foreground !border-border !rounded-md !text-xs !shadow-lg",
                    description: "!text-muted-foreground !text-xs",
                    actionButton: "!bg-primary !text-primary-foreground !text-xs",
                  },
                }}
              />
            </TooltipProvider>
          </AppStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
