import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Documents from "./pages/Documents";
import TimeClock from "./pages/TimeClock";
import Warnings from "./pages/Warnings";
import Vacations from "./pages/Vacations";
import Absences from "./pages/Absences";
import Meetings from "./pages/Meetings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/funcionarios" element={<Employees />} />
          <Route path="/documentos" element={<Documents />} />
          <Route path="/ponto" element={<TimeClock />} />
          <Route path="/advertencias" element={<Warnings />} />
          <Route path="/ferias" element={<Vacations />} />
          <Route path="/faltas" element={<Absences />} />
          <Route path="/reunioes" element={<Meetings />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
