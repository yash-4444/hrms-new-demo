import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppStateProvider } from "@/components/app-state";
import { ConsoleStateProvider } from "@/components/console/console-state";
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

/* Runs before first paint: when this tab restored a non-default persona, hide
   the page body until AppStateProvider has swapped it in, so the static HR
   Admin HTML never flashes (or flashes "Access denied") on a reload. The
   provider clears the flag; the timeout is a safety net if hydration fails. */
const PERSONA_BOOT = `try{var r=sessionStorage.getItem("hrms.persona");if(r&&r!=="hr_admin"){var d=document.documentElement;d.setAttribute("data-persona-restoring","");setTimeout(function(){d.removeAttribute("data-persona-restoring")},2000)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PERSONA_BOOT }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AppStateProvider>
            {/* Root-level so console edits survive a support session's trip into a tenant. */}
            <ConsoleStateProvider>
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
            </ConsoleStateProvider>
          </AppStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
