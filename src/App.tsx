import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ReportErrorBoundary } from "@/components/ReportErrorBoundary";
import { PostHogTracker } from "@/components/PostHogTracker";
const NewValuation = lazy(() => import("./pages/NewValuation"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Analysing = lazy(() => import("./pages/Analysing"));
const Report = lazy(() => import("./pages/Report"));
const EditValuation = lazy(() => import("./pages/EditValuation"));
const Profile = lazy(() => import("./pages/Profile"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Disclaimers = lazy(() => import("./pages/Disclaimers"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));
import Landing from "./pages/Landing";
const Compare = lazy(() => import("./pages/Compare"));
const Admin = lazy(() => import("./pages/Admin"));
const Pricing = lazy(() => import("./pages/Pricing"));
import { CookieConsent } from "@/components/CookieConsent";
const Check = lazy(() => import("./pages/Check"));
const Accuracy = lazy(() => import("./pages/Accuracy"));
const CarValue = lazy(() => import("./pages/CarValue"));
const CarValuesIndex = lazy(() => import("./pages/CarValuesIndex"));

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
          <PostHogTracker />
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            {/* Unprotected so anonymous visitors can enter a reg; NewValuation stores the intent and sends them to /auth. */}
            <Route path="/valuation/new" element={<NewValuation />} />
            <Route path="/buyer" element={<Navigate to="/check" replace />} />
            <Route path="/check" element={<Check />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/valuation/:id/analysing" element={<ProtectedRoute><Analysing /></ProtectedRoute>} />
            <Route path="/valuation/:id" element={<ProtectedRoute><ReportErrorBoundary><Report /></ReportErrorBoundary></ProtectedRoute>} />
            <Route path="/shared/:id" element={<ReportErrorBoundary><Report /></ReportErrorBoundary>} />
            <Route path="/valuation/:id/edit" element={<ProtectedRoute><EditValuation /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/car-values" element={<CarValuesIndex />} />
            <Route path="/car-values/:make/:model" element={<CarValue />} />
            <Route path="/privacy" element={<Privacy />} />
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
