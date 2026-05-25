import { Component, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ReportErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("Report render error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col">
        <TestModeBanner />
        <Header />
        <main className="flex-1 grid place-items-center px-4 py-12">
          <div className="max-w-md text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 grid place-items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <h1 className="text-xl font-semibold mb-2">We couldn't open this report</h1>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              The valuation data couldn't be displayed — it may be from an older format or partially saved. Your other valuations are unaffected.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild variant="hero" size="sm">
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/valuation/new">Start a new valuation</Link>
              </Button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-6 text-left text-[10px] text-muted-foreground/60 overflow-auto max-h-40 p-2 bg-muted/30 rounded">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </main>
      </div>
    );
  }
}
