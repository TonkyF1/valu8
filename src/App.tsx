import { lazy, Suspense } from "react";
import { lazyWithPreload } from "@/lib/lazyPreload";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { RouteScrollTop } from "@/components/RouteScrollTop";
import { StartGate } from "@/components/StartGate";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ReportErrorBoundary } from "@/components/ReportErrorBoundary";
import { PostHogTracker } from "@/components/PostHogTracker";
import { MetaPixelTracker } from "@/components/MetaPixelTracker";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { trackLanded } from "@/lib/funnel";

trackLanded();
const NewValuation = lazy(() => import("./pages/NewValuation"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const EmailAnswer = lazy(() => import("./pages/EmailAnswer"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Analysing = lazy(() => import("./pages/Analysing"));
const Report = lazy(() => import("./pages/Report"));
const EditValuation = lazy(() => import("./pages/EditValuation"));
const Profile = lazy(() => import("./pages/Profile"));
const Privacy = lazyWithPreload(() => import("./pages/Privacy"));
const Bot = lazyWithPreload(() => import("./pages/Bot"));
const Terms = lazyWithPreload(() => import("./pages/Terms"));
const Disclaimers = lazyWithPreload(() => import("./pages/Disclaimers"));
const About = lazyWithPreload(() => import("./pages/About"));
const NotFound = lazyWithPreload(() => import("./pages/NotFound"));
import Landing from "./pages/Landing";
const Compare = lazy(() => import("./pages/Compare"));
const Admin = lazy(() => import("./pages/Admin"));
const Pricing = lazyWithPreload(() => import("./pages/Pricing"));
import { CookieConsent } from "@/components/CookieConsent";
const Check = lazyWithPreload(() => import("./pages/Check"));
const Accuracy = lazyWithPreload(() => import("./pages/Accuracy"));
const CarValue = lazyWithPreload(() => import("./pages/CarValue"));
const CarValuesIndex = lazyWithPreload(() => import("./pages/CarValuesIndex"));
const ModelValue = lazyWithPreload(() => import("./pages/ModelValue"));
const ValueIndex = lazyWithPreload(() => import("./pages/ModelValue").then((m) => ({ default: m.ValueIndex })));
const ModelYearValue = lazyWithPreload(() => import("./pages/ModelValue").then((m) => ({ default: m.ModelYearValue })));
const HowItWorksPage = lazyWithPreload(() => import("./pages/HowItWorksPage"));
const FaqPage = lazyWithPreload(() => import("./pages/FaqPage"));
const ExampleReportPage = lazyWithPreload(() => import("./pages/ExampleReportPage"));
const GuidesIndex = lazyWithPreload(() => import("./pages/GuidesIndex"));
const Guide = lazyWithPreload(() => import("./pages/Guide"));
const EmbedInfo = lazyWithPreload(() => import("./pages/EmbedInfo"));

/** Fetch the code for a prerendered public page before React mounts (main.tsx), so the static HTML stays on screen
 * until identical React content replaces it: no blank loading shell, and the largest text is measured once (LCP). */
export function preloadRoute(path: string): Promise<unknown> {
  const p = path.replace(/\/+$/, "") || "/";
  const table: [RegExp, { preload: () => Promise<void> }][] = [
    [/^\/value$/, ValueIndex], [/^\/value\/[^/]+$/, ModelValue], [/^\/value\/[^/]+\/\d{4}$/, ModelYearValue],
    [/^\/car-values$/, CarValuesIndex], [/^\/car-values\/[^/]+\/[^/]+$/, CarValue],
    [/^\/guides$/, GuidesIndex], [/^\/guides\/[^/]+$/, Guide], [/^\/(about|contact)$/, About],
    [/^\/how-it-works$/, HowItWorksPage], [/^\/faq$/, FaqPage], [/^\/pricing$/, Pricing], [/^\/check$/, Check],
    [/^\/accuracy$/, Accuracy], [/^\/example-report$/, ExampleReportPage], [/^\/embed-info$/, EmbedInfo],
    [/^\/privacy$/, Privacy], [/^\/terms$/, Terms], [/^\/disclaimers$/, Disclaimers], [/^\/bot$/, Bot],
  ];
  const hit = table.find(([re]) => re.test(p));
  return hit ? hit[1].preload() : Promise.resolve();
}

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
    <span className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden />
    <span className="sr-only">Loading…</span>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ConfirmProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <RouteScrollTop />
          <PostHogTracker />
          <MetaPixelTracker />
          <SiteAnalytics />
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            {/* Unprotected: guests can get a full valuation without an account (capped per day server-side). */}
            <Route path="/valuation/new" element={<StartGate><NewValuation /></StartGate>} />
            <Route path="/buyer" element={<Navigate to="/check" replace />} />
            <Route path="/check-an-advert" element={<Navigate to="/check" replace />} />
            <Route path="/check" element={<Check />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/valuation/:id/analysing" element={<ProtectedRoute><Analysing /></ProtectedRoute>} />
            {/* Unprotected so guests can open their own report; Report loads guest reports via get-shared-valuation. */}
            <Route path="/valuation/:id" element={<ReportErrorBoundary><Report /></ReportErrorBoundary>} />
            <Route path="/shared/:id" element={<ReportErrorBoundary><Report /></ReportErrorBoundary>} />
            <Route path="/valuation/:id/edit" element={<ProtectedRoute><EditValuation /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/value" element={<ValueIndex />} />
            <Route path="/value/:slug" element={<ModelValue />} />
            <Route path="/value/:slug/:year" element={<ModelYearValue />} />
            <Route path="/car-values" element={<CarValuesIndex />} />
            <Route path="/car-values/:make/:model" element={<CarValue />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/example-report" element={<ExampleReportPage />} />
            <Route path="/guides" element={<GuidesIndex />} />
            <Route path="/guides/:slug" element={<Guide />} />
            <Route path="/embed-info" element={<EmbedInfo />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/bot" element={<Bot />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/email-answer" element={<EmailAnswer />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/disclaimers" element={<Disclaimers />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <CookieConsent />
        </AuthProvider>
      </BrowserRouter>
      </ConfirmProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
