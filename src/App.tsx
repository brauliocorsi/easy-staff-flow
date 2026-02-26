import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Documents from "./pages/Documents";
import TimeClock from "./pages/TimeClock";
import Warnings from "./pages/Warnings";
import Vacations from "./pages/Vacations";
import Absences from "./pages/Absences";
import Meetings from "./pages/Meetings";
import MeetingDetail from "./pages/MeetingDetail";
import MeetingPublic from "./pages/MeetingPublic";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import TimeClockReport from "./pages/TimeClockReport";
import VacationPublic from "./pages/VacationPublic";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/ponto" element={<TimeClock />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/funcionarios" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/documentos" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/advertencias" element={<ProtectedRoute><Warnings /></ProtectedRoute>} />
            <Route path="/ferias" element={<ProtectedRoute><Vacations /></ProtectedRoute>} />
            <Route path="/faltas" element={<ProtectedRoute><Absences /></ProtectedRoute>} />
            <Route path="/reunioes" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
            <Route path="/reunioes/:id" element={<ProtectedRoute><MeetingDetail /></ProtectedRoute>} />
            <Route path="/reuniao-publica/:id" element={<MeetingPublic />} />
            <Route path="/ferias-publica/:token" element={<VacationPublic />} />
            <Route path="/relatorios/ponto" element={<ProtectedRoute><TimeClockReport /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
