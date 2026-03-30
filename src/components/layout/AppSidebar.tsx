import { useLocation, Link, useNavigate } from "react-router-dom";
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
  Stethoscope,
  ChevronDown,
  UserCircle,
  Wrench,
  CalendarDays,
  Timer,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";

const menuGroups = [
  {
    label: "Geral",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/" },
      { title: "Funcionários", icon: Users, path: "/funcionarios" },
      { title: "Documentos", icon: FileText, path: "/documentos" },
    ],
  },
  {
    label: "Ponto & Presenças",
    icon: Clock,
    items: [
      { title: "Relógio de Ponto", icon: Clock, path: "/ponto" },
      { title: "Relatório de Ponto", icon: BarChart3, path: "/relatorios/ponto" },
      { title: "Registro de Faltas", icon: CalendarX, path: "/faltas" },
    ],
  },
  {
    label: "Pessoas",
    icon: UserCircle,
    items: [
      { title: "Mapa de Férias", icon: Palmtree, path: "/ferias" },
      { title: "Advertências", icon: AlertTriangle, path: "/advertencias" },
      { title: "Avaliações", icon: ClipboardCheck, path: "/avaliacoes" },
      { title: "Formações", icon: GraduationCap, path: "/formacoes" },
      { title: "Medicina do Trabalho", icon: Stethoscope, path: "/medicina-trabalho" },
    ],
  },
  {
    label: "Equipamentos & Veículos",
    icon: Wrench,
    items: [
      { title: "Equipamentos", icon: HardHat, path: "/equipamentos" },
      { title: "Veículos", icon: Car, path: "/veiculos" },
    ],
  },
  {
    label: "Comunicação",
    icon: Handshake,
    items: [
      { title: "Reuniões", icon: Handshake, path: "/reunioes" },
      { title: "Memorando", icon: CalendarDays, path: "/reunioes/memorando" },
      { title: "Sugestões", icon: MessageSquare, path: "/sugestoes" },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pb-2">
        <Link to="/" className="flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <h1 className="font-display text-base font-bold leading-tight">RH UP Móveis</h1>
            <p className="text-[11px] text-muted-foreground">Gestão de Pessoas</p>
          </div>
        </Link>
      </SidebarHeader>

      <Separator className="mx-4 w-auto" />

      <SidebarContent className="pt-2">
        {menuGroups.map((group) => {
          const groupActive = group.items.some((item) => location.pathname === item.path);
          return (
            <Collapsible key={group.label} defaultOpen={groupActive} className="group/collapsible">
              <SidebarGroup className="py-0.5">
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer select-none hover:text-foreground transition-colors">
                    <group.icon className="mr-1.5 h-3.5 w-3.5" />
                    {group.label}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
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
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <Separator className="mb-2" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Configurações" isActive={location.pathname === "/configuracoes"}>
              <Link to="/configuracoes">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              onClick={handleSignOut}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
