import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Clock,
  AlertTriangle,
  Palmtree,
  CalendarX,
  Handshake,
  BarChart3,
  Settings,
  LogOut,
  MessageSquare,
  ClipboardCheck,
  GraduationCap,
  HardHat,
  Car,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/" },
  { title: "Funcionários", icon: Users, path: "/funcionarios" },
  { title: "Documentos", icon: FileText, path: "/documentos" },
  { title: "Relógio de Ponto", icon: Clock, path: "/ponto" },
  { title: "Advertências", icon: AlertTriangle, path: "/advertencias" },
  { title: "Mapa de Férias", icon: Palmtree, path: "/ferias" },
  { title: "Registro de Faltas", icon: CalendarX, path: "/faltas" },
  { title: "Reuniões", icon: Handshake, path: "/reunioes" },
  { title: "Relatório de Ponto", icon: BarChart3, path: "/relatorios/ponto" },
  { title: "Sugestões", icon: MessageSquare, path: "/sugestoes" },
  { title: "Avaliações", icon: ClipboardCheck, path: "/avaliacoes" },
  { title: "Formações", icon: GraduationCap, path: "/formacoes" },
  { title: "Equipamentos", icon: HardHat, path: "/equipamentos" },
  { title: "Veículos", icon: Car, path: "/veiculos" },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold leading-tight">RH System</h1>
            <p className="text-xs text-muted-foreground">Gestão de Pessoas</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path}
                    tooltip={item.title}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Configurações">
              <Link to="/configuracoes">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
