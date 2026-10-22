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
import NewValuation from "./pages/NewValuation";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Analysing from "./pages/Analysing";
import Report from "./pages/Report";
import EditValuation from "./pages/EditValuation";
import Profile from "./pages/Profile";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Disclaimers from "./pages/Disclaimers";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Buyer from "./pages/Buyer";
import Compare from "./pages/Compare";
import Admin from "./pages/Admin";
import Pricing from "./pages/Pricing";
import { CookieConsent } from "@/components/CookieConsent";

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
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            {/* Unprotected so anonymous visitors can enter a reg; NewValuation stores the intent and sends them to /auth. */}
            <Route path="/valuation/new" element={<NewValuation />} />
            <Route path="/buyer" element={<Buyer />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/valuation/:id/analysing" element={<ProtectedRoute><Analysing /></ProtectedRoute>} />
            <Route path="/valuation/:id" element={<ProtectedRoute><ReportErrorBoundary><Report /></ReportErrorBoundary></ProtectedRoute>} />
            <Route path="/shared/:id" element={<ReportErrorBoundary><Report /></ReportErrorBoundary>} />
            <Route path="/valuation/:id/edit" element={<ProtectedRoute><EditValuation /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/disclaimers" element={<Disclaimers />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieConsent />
        </AuthProvider>
      </BrowserRouter>
      </ConfirmProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
