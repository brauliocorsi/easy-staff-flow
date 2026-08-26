import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, DollarSign, Users, AlertTriangle, Loader2, Store, CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

interface Purchase {
  id: string;
  codigo: string;
  data: string;
  valor_total: string;
  situacao: string;
  fornecedor_nome: string;
  fornecedor_id: string;
  observacao?: string;
  loja_id: string;
  loja_nome: string;
  produtos?: Array<{ produto: { nome_produto: string; quantidade: string; valor_total: string } }>;
  pagamentos?: Array<{ pagamento: { valor: string; data_vencimento: string; nome_forma_pagamento: string } }>;
}

interface StoreInfo {
  id: string;
  nome: string;
}

interface SupplierSummary {
  id: string;
  name: string;
  totalAmount: number;
  purchaseCount: number;
  purchases: Purchase[];
}

function mapCompra(item: Record<string, unknown>, lojaId: string, lojaNome: string): Purchase {
  const c = (item as { Compra?: Record<string, unknown> }).Compra || item;

  let valorTotal = String(c.valor_total || "0");
  if (valorTotal === "0" || valorTotal === "0.00") {
    const produtos = (c.produtos as Array<{ produto: { valor_total: string } }>) || [];
    const sum = produtos.reduce((acc, p) => {
      return acc + (parseFloat(String(p.produto?.valor_total || "0").replace(",", ".")) || 0);
    }, 0);
    if (sum > 0) valorTotal = sum.toFixed(2);
  }
  if (valorTotal === "0" || valorTotal === "0.00") {
    const pagamentos = (c.pagamentos as Array<{ pagamento: { valor: string } }>) || [];
    const sum = pagamentos.reduce((acc, p) => {
      return acc + (parseFloat(String(p.pagamento?.valor || "0").replace(",", ".")) || 0);
    }, 0);
    if (sum > 0) valorTotal = sum.toFixed(2);
  }

  return {
    id: String(c.id || ""),
    codigo: String(c.codigo || ""),
    data: String(c.data_emissao || c.data || ""),
    valor_total: valorTotal,
    situacao: String(c.nome_situacao || c.situacao || ""),
    fornecedor_nome: String(c.nome_fornecedor || c.fornecedor_nome || "Desconhecido"),
    fornecedor_id: String(c.fornecedor_id || "unknown"),
    observacao: String(c.observacoes || c.observacao || ""),
    loja_id: lojaId,
    loja_nome: lojaNome,
    produtos: c.produtos as Purchase["produtos"],
    pagamentos: c.pagamentos as Purchase["pagamentos"],
  };
}

async function fetchStores(): Promise<StoreInfo[]> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/gestaoclick-purchases?action=stores`;

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${session?.access_token}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!res.ok) throw new Error("Erro ao buscar lojas");
  const json = await res.json();
  return json?.data || [];
}

async function fetchPurchasesForStore(store: StoreInfo): Promise<Purchase[]> {
  const allPurchases: Purchase[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/gestaoclick-purchases?action=purchases&pagina=${page}&loja_id=${store.id}`;

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${session?.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (!res.ok) {
      // Falha numa página: mantém o que já foi carregado em vez de rebentar a página
      console.error(`Erro ao buscar compras da loja ${store.nome}:`, await res.text());
      break;
    }

    const json = await res.json();
    const items = json?.data || [];

    if (json?.upstream_error) break;

    if (json?.meta?.total_paginas) {
      totalPages = json.meta.total_paginas;
    }

    if (!Array.isArray(items) || items.length === 0) break;


    allPurchases.push(...items.map((item: Record<string, unknown>) => mapCompra(item, store.id, store.nome)));
    page++;
  }

  return allPurchases;
}

async function fetchAllPurchases(): Promise<{ stores: StoreInfo[]; purchases: Purchase[] }> {
  const stores = await fetchStores();

  // Fetch purchases from all stores in parallel
  const results = await Promise.all(stores.map(fetchPurchasesForStore));
  const purchases = results.flat();

  return { stores, purchases };
}

function groupBySupplier(purchases: Purchase[]): SupplierSummary[] {
  const map = new Map<string, SupplierSummary>();

  for (const p of purchases) {
    const supplierId = p.fornecedor_id || "unknown";
    const supplierName = p.fornecedor_nome || "Fornecedor Desconhecido";

    if (!map.has(supplierId)) {
      map.set(supplierId, {
        id: supplierId,
        name: supplierName,
        totalAmount: 0,
        purchaseCount: 0,
        purchases: [],
      });
    }

    const summary = map.get(supplierId)!;
    const amount = parseFloat(String(p.valor_total || "0").replace(",", "."));
    summary.totalAmount += isNaN(amount) ? 0 : amount;
    summary.purchaseCount += 1;
    summary.purchases.push(p);
  }

  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function getStatusBadge(situacao: string) {
  const lower = (situacao || "").toLowerCase();
  if (lower.includes("pagamento pendente")) {
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">{situacao}</Badge>;
  }
  if (lower.includes("confirmado")) {
    return <Badge className="bg-blue-500/10 text-blue-700 border-blue-200">{situacao}</Badge>;
  }
  if (lower.includes("pago") || lower.includes("finalizado")) {
    return <Badge className="bg-green-500/10 text-green-700 border-green-200">{situacao}</Badge>;
  }
  if (lower.includes("cancelad")) {
    return <Badge variant="destructive">{situacao}</Badge>;
  }
  return <Badge variant="secondary">{situacao}</Badge>;
}

function getStoreBadge(lojaNome: string) {
  return <Badge variant="outline" className="text-xs">{lojaNome}</Badge>;
}

export default function Purchases() {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["gestaoclick-purchases-all-stores"],
    queryFn: fetchAllPurchases,
    staleTime: 5 * 60 * 1000,
  });

  const stores = data?.stores || [];
  const rawPurchases = data?.purchases || [];

  // Filter by status (only "pagamento pendente")
  const statusFiltered = rawPurchases.filter((p) => {
    const s = (p.situacao || "").toLowerCase();
    return s.includes("pagamento pendente");
  });

  // Build available months from data
  const availableMonths = useMemo(() => {
    const monthSet = new Map<string, string>();
    for (const p of statusFiltered) {
      if (p.data) {
        try {
          const date = new Date(p.data);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          if (!monthSet.has(key)) {
            const label = format(date, "MMMM yyyy", { locale: pt });
            monthSet.set(key, label.charAt(0).toUpperCase() + label.slice(1));
          }
        } catch { /* skip */ }
      }
    }
    return Array.from(monthSet.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  }, [statusFiltered]);

  // Filter by store
  const storeFiltered = selectedStore === "all"
    ? statusFiltered
    : statusFiltered.filter((p) => p.loja_id === selectedStore);

  // Filter by month
  const purchases = selectedMonth === "all"
    ? storeFiltered
    : storeFiltered.filter((p) => {
        if (!p.data) return false;
        try {
          const date = new Date(p.data);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          return key === selectedMonth;
        } catch { return false; }
      });

  const suppliers = groupBySupplier(purchases);
  const totalOwed = suppliers.reduce((sum, s) => sum + s.totalAmount, 0);
  const selectedSupplierData = selectedSupplier
    ? suppliers.find((s) => s.id === selectedSupplier)
    : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Compras</h1>
            <p className="text-muted-foreground">
              Painel de compras por fornecedor — Pagamento Pendente
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Store Filter */}
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedStore} onValueChange={setSelectedStore}>
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

            {/* Month Filter */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Meses</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : formatCurrency(totalOwed)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Compras</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : purchases.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fornecedores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : suppliers.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Maior Devedor</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : suppliers.length > 0 ? (
                  suppliers[0].name
                ) : (
                  "—"
                )}
              </div>
              {!isLoading && suppliers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(suppliers[0].totalAmount)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">
                Erro ao carregar compras: {(error as Error).message}
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">A carregar compras de todas as lojas...</span>
          </div>
        ) : (
          <Tabs defaultValue="suppliers" className="space-y-4">
            <TabsList>
              <TabsTrigger value="suppliers">Por Fornecedor</TabsTrigger>
              <TabsTrigger value="all">Todas as Compras</TabsTrigger>
            </TabsList>

            {/* By Supplier */}
            <TabsContent value="suppliers" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {suppliers.map((s) => (
                  <Card
                    key={s.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedSupplier === s.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() =>
                      setSelectedSupplier(selectedSupplier === s.id ? null : s.id)
                    }
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base truncate">{s.name}</CardTitle>
                      <CardDescription>
                        {s.purchaseCount} compra{s.purchaseCount !== 1 ? "s" : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-destructive">
                        {formatCurrency(s.totalAmount)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedSupplierData && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Compras — {selectedSupplierData.name}
                    </CardTitle>
                    <CardDescription>
                      Total: {formatCurrency(selectedSupplierData.totalAmount)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Loja</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Situação</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSupplierData.purchases.map((p) => (
                          <TableRow key={`${p.loja_id}-${p.id || p.codigo}`}>
                            <TableCell className="font-medium">{p.codigo}</TableCell>
                            <TableCell>{getStoreBadge(p.loja_nome)}</TableCell>
                            <TableCell>
                              {p.data
                                ? (() => {
                                    try {
                                      return format(new Date(p.data), "dd/MM/yyyy", { locale: pt });
                                    } catch {
                                      return p.data;
                                    }
                                  })()
                                : "—"}
                            </TableCell>
                            <TableCell>{getStatusBadge(p.situacao)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(
                                parseFloat(String(p.valor_total || "0").replace(",", ".")) || 0
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {suppliers.length === 0 && (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    Nenhuma compra com situação Pagamento Pendente encontrada.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* All Purchases */}
            <TabsContent value="all">
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((p) => (
                        <TableRow key={`${p.loja_id}-${p.id || p.codigo}`}>
                          <TableCell className="font-medium">{p.codigo}</TableCell>
                          <TableCell>{getStoreBadge(p.loja_nome)}</TableCell>
                          <TableCell>{p.fornecedor_nome}</TableCell>
                          <TableCell>
                            {p.data
                              ? (() => {
                                  try {
                                    return format(new Date(p.data), "dd/MM/yyyy", { locale: pt });
                                  } catch {
                                    return p.data;
                                  }
                                })()
                              : "—"}
                          </TableCell>
                          <TableCell>{getStatusBadge(p.situacao)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(
                              parseFloat(String(p.valor_total || "0").replace(",", ".")) || 0
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
