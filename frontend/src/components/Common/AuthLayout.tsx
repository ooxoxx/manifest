import { Appearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2 relative overflow-hidden">
      {/* Left panel - Laboratory visual */}
      <div className="bg-gradient-to-br from-background via-muted/50 to-background dark:from-[#0a0e17] dark:via-[#0f1521] dark:to-[#141b2d] relative hidden lg:flex lg:items-center lg:justify-center overflow-hidden">
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
              linear-gradient(rgba(0, 240, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 240, 255, 0.1) 1px, transparent 1px)
            `,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Animated circuit lines */}
        <div className="absolute inset-0 opacity-30">
          <svg
            className="absolute top-20 left-20 w-64 h-64 text-primary/20"
            viewBox="0 0 200 200"
          >
            <circle
              cx="100"
              cy="100"
              r="80"
              stroke="currentColor"
              strokeWidth="0.5"
              fill="none"
            />
            <circle
              cx="100"
              cy="100"
              r="60"
              stroke="currentColor"
              strokeWidth="0.5"
              fill="none"
            />
            <circle
              cx="100"
              cy="100"
              r="40"
              stroke="currentColor"
              strokeWidth="0.5"
              fill="none"
              className="animate-spin"
              style={{ animationDuration: "20s" }}
            />
            <line
              x1="100"
              y1="20"
              x2="100"
              y2="180"
              stroke="currentColor"
              strokeWidth="0.5"
            />
            <line
              x1="20"
              y1="100"
              x2="180"
              y2="100"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </svg>
        </div>

        {/* Glowing accents */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

        {/* Logo with enhanced styling */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="glow-cyan-sm p-8 rounded-2xl bg-card/10 backdrop-blur-sm border border-primary/20">
            <Logo variant="full" className="h-16" asLink={false} />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
              AI Laboratory Asset Management
            </p>
            <p className="text-sm text-primary font-semibold">
              Secure • Distributed • Scalable
            </p>
          </div>
        </div>

        {/* Corner decorations */}
        <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-primary/30" />
        <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-primary/30" />
      </div>

      {/* Right panel - Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10 relative">
        <div className="flex justify-end">
          <Appearance />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <div className="terminal-border bg-card/50 backdrop-blur-sm p-8 rounded-lg">
              {children}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  )
}
