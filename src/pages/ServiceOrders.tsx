import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wrench, Loader2, Store, ChevronRight, ArrowLeft, CalendarIcon, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ServiceOrder {
  id: string;
  codigo: string;
  data_entrada: string;
  data_saida: string;
  nome_cliente: string;
  nome_situacao: string;
  cor_situacao: string;
  nome_tecnico: string;
  nome_vendedor: string;
  nome_loja: string;
  nome_canal_venda: string;
  observacoes: string;
  observacoes_interna: string;
  valor_total: string;
  equipamentos: Array<{
    equipamento: {
      equipamento: string;
      condicoes: string;
      defeitos: string;
      solucao: string;
      marca: string;
      modelo: string;
      serie: string;
      acessorios: string;
      laudo: string;
      termos_garantia: string;
    };
  }>;
  loja_id: string;
}

interface StoreInfo {
  id: string;
  nome: string;
}

interface MonthGroup {
  key: string;
  label: string;
  count: number;
  orders: ServiceOrder[];
}

function mapServiceOrder(item: Record<string, unknown>, lojaId: string): ServiceOrder {
  return {
    id: String(item.id || ""),
    codigo: String(item.codigo || ""),
    data_entrada: String(item.data_entrada || ""),
    data_saida: String(item.data_saida || ""),
    nome_cliente: String(item.nome_cliente || ""),
    nome_situacao: String(item.nome_situacao || ""),
    cor_situacao: String(item.cor_situacao || ""),
    nome_tecnico: String(item.nome_tecnico || ""),
    nome_vendedor: String(item.nome_vendedor || ""),
    nome_loja: String(item.nome_loja || ""),
    nome_canal_venda: String(item.nome_canal_venda || ""),
    observacoes: String(item.observacoes || ""),
    observacoes_interna: String(item.observacoes_interna || ""),
    valor_total: String(item.valor_total || "0"),
    equipamentos: (item.equipamentos as ServiceOrder["equipamentos"]) || [],
    loja_id: lojaId,
  };
}

async function fetchStores(): Promise<StoreInfo[]> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/gestaoclick-purchases?action=stores`;
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!res.ok) throw new Error("Erro ao buscar lojas");
  const json = await res.json();
  return json?.data || [];
}

async function fetchServiceOrdersForStore(store: StoreInfo): Promise<ServiceOrder[]> {
  const all: ServiceOrder[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/gestaoclick-purchases?action=service-orders&pagina=${page}&loja_id=${store.id}`;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro ao buscar OS da loja ${store.nome}: ${text}`);
    }

    const json = await res.json();
    const items = json?.data || [];

    if (json?.meta?.total_paginas) {
      totalPages = json.meta.total_paginas;
    }

    if (!Array.isArray(items) || items.length === 0) break;

    all.push(...items.map((item: Record<string, unknown>) => mapServiceOrder(item, store.id)));
    page++;
  }

  return all;
}

async function fetchAllServiceOrders(): Promise<{ stores: StoreInfo[]; orders: ServiceOrder[] }> {
  const stores = await fetchStores();
  const results = await Promise.all(stores.map(fetchServiceOrdersForStore));
  return { stores, orders: results.flat() };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: pt });
  } catch {
    return dateStr;
  }
}

export default function ServiceOrders() {
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["gestaoclick-service-orders"],
    queryFn: fetchAllServiceOrders,
    staleTime: 5 * 60 * 1000,
  });

  const stores = data?.stores || [];
  const rawOrders = data?.orders || [];

  // Filter by store
  const orders = selectedStore === "all"
    ? rawOrders
    : rawOrders.filter((o) => o.loja_id === selectedStore);

  // Group by month
  const monthGroups = useMemo(() => {
    const map = new Map<string, MonthGroup>();

    for (const o of orders) {
      if (!o.data_entrada) continue;
      try {
        const date = new Date(o.data_entrada);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!map.has(key)) {
          const label = format(date, "MMMM yyyy", { locale: pt });
          map.set(key, {
            key,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            count: 0,
            orders: [],
          });
        }
        const group = map.get(key)!;
        group.count++;
        group.orders.push(o);
      } catch { /* skip */ }
    }

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [orders]);

  // Chart data (last 12 months ascending)
  const chartData = useMemo(() => {
    return [...monthGroups].reverse().slice(-12);
  }, [monthGroups]);

  const selectedMonthData = selectedMonth
    ? monthGroups.find((g) => g.key === selectedMonth)
    : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Assistências</h1>
            <p className="text-muted-foreground">
              Ordens de serviço do GestãoClick — contagem mensal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedStore} onValueChange={(v) => { setSelectedStore(v); setSelectedMonth(null); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas as lojas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Lojas</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de OS</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : orders.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Meses com OS</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : monthGroups.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Média Mensal</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : monthGroups.length > 0 ? (
                  Math.round(orders.length / monthGroups.length)
                ) : (
                  0
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Erro: {(error as Error).message}</p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">A carregar ordens de serviço...</span>
          </div>
        ) : (
          <>
            {/* Chart */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>OS por Mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v: string) => {
                            const parts = v.split(" ");
                            return parts[0]?.slice(0, 3) + " " + (parts[1] || "");
                          }}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                          formatter={(value: number) => [`${value} OS`, "Quantidade"]}
                          labelFormatter={(label: string) => label}
                        />
                        <Bar
                          dataKey="count"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          cursor="pointer"
                          onClick={(data: MonthGroup) => setSelectedMonth(data.key)}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Month-by-month table or detail view */}
            {selectedMonth && selectedMonthData ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <CardTitle>{selectedMonthData.label}</CardTitle>
                      <CardDescription>{selectedMonthData.count} ordem(ns) de serviço</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Saída</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Técnico</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMonthData.orders.map((o) => (
                        <TableRow
                          key={`${o.loja_id}-${o.id}`}
                          className="cursor-pointer"
                          onClick={() => setSelectedOrder(o)}
                        >
                          <TableCell className="font-medium">{o.codigo}</TableCell>
                          <TableCell>{o.nome_cliente}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{o.nome_loja}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(o.data_entrada)}</TableCell>
                          <TableCell>{formatDate(o.data_saida)}</TableCell>
                          <TableCell>
                            <Badge
                              style={{
                                backgroundColor: o.cor_situacao ? `${o.cor_situacao}20` : undefined,
                                color: o.cor_situacao || undefined,
                                borderColor: o.cor_situacao ? `${o.cor_situacao}40` : undefined,
                              }}
                            >
                              {o.nome_situacao}
                            </Badge>
                          </TableCell>
                          <TableCell>{o.nome_tecnico || "—"}</TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Resumo Mensal</CardTitle>
                  <CardDescription>Clique num mês para ver os detalhes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Quantidade de OS</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthGroups.map((g) => (
                        <TableRow
                          key={g.key}
                          className="cursor-pointer"
                          onClick={() => setSelectedMonth(g.key)}
                        >
                          <TableCell className="font-medium">{g.label}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="text-sm">
                              {g.count}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>OS #{selectedOrder.codigo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{selectedOrder.nome_cliente}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Situação</p>
                    <Badge
                      style={{
                        backgroundColor: selectedOrder.cor_situacao ? `${selectedOrder.cor_situacao}20` : undefined,
                        color: selectedOrder.cor_situacao || undefined,
                        borderColor: selectedOrder.cor_situacao ? `${selectedOrder.cor_situacao}40` : undefined,
                      }}
                    >
                      {selectedOrder.nome_situacao}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Entrada</p>
                    <p className="font-medium">{formatDate(selectedOrder.data_entrada)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Saída</p>
                    <p className="font-medium">{formatDate(selectedOrder.data_saida)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Técnico</p>
                    <p className="font-medium">{selectedOrder.nome_tecnico || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendedor</p>
                    <p className="font-medium">{selectedOrder.nome_vendedor || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Loja</p>
                    <p className="font-medium">{selectedOrder.nome_loja}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Canal de Venda</p>
                    <p className="font-medium">{selectedOrder.nome_canal_venda || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="font-medium">
                      {parseFloat(selectedOrder.valor_total) > 0
                        ? new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
                            parseFloat(selectedOrder.valor_total)
                          )
                        : "—"}
                    </p>
                  </div>
                </div>

                {selectedOrder.observacoes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Observações</p>
                      <p className="text-sm">{selectedOrder.observacoes}</p>
                    </div>
                  </>
                )}

                {selectedOrder.observacoes_interna && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Observações Internas</p>
                    <p className="text-sm">{selectedOrder.observacoes_interna}</p>
                  </div>
                )}

                {selectedOrder.equipamentos.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold mb-3">Equipamentos</p>
                      <div className="space-y-4">
                        {selectedOrder.equipamentos.map((eq, idx) => (
                          <Card key={idx} className="bg-muted/30">
                            <CardContent className="pt-4 space-y-2">
                              <div>
                                <p className="text-sm text-muted-foreground">Equipamento</p>
                                <p className="font-medium text-sm">{eq.equipamento.equipamento || "—"}</p>
                              </div>
                              {eq.equipamento.condicoes && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Condições</p>
                                  <p className="text-sm">{eq.equipamento.condicoes}</p>
                                </div>
                              )}
                              {eq.equipamento.defeitos && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Defeitos</p>
                                  <p className="text-sm text-destructive">{eq.equipamento.defeitos}</p>
                                </div>
                              )}
                              {eq.equipamento.solucao && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Solução</p>
                                  <p className="text-sm text-green-700">{eq.equipamento.solucao}</p>
                                </div>
                              )}
                              {eq.equipamento.laudo && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Laudo</p>
                                  <p className="text-sm">{eq.equipamento.laudo}</p>
                                </div>
                              )}
                              {(eq.equipamento.marca || eq.equipamento.modelo || eq.equipamento.serie) && (
                                <div className="flex gap-4 text-sm">
                                  {eq.equipamento.marca && <span>Marca: {eq.equipamento.marca}</span>}
                                  {eq.equipamento.modelo && <span>Modelo: {eq.equipamento.modelo}</span>}
                                  {eq.equipamento.serie && <span>Série: {eq.equipamento.serie}</span>}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
