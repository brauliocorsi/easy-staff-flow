import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, DollarSign, Users, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface Purchase {
  id: string;
  codigo: string;
  data: string;
  valor_total: string;
  situacao: string;
  situacao_cor?: string;
  fornecedor_nome: string;
  fornecedor_id: string;
  observacao?: string;
  [key: string]: unknown;
}

interface SupplierSummary {
  id: string;
  name: string;
  totalAmount: number;
  purchaseCount: number;
  purchases: Purchase[];
}

async function fetchAllPurchases(): Promise<Purchase[]> {
  const allPurchases: Purchase[] = [];
  let page = 1;
  let hasMore = true;

  // First get purchase statuses to find "Confirmado" and "Pagamento Pendente"
  const { data: statusData } = await supabase.functions.invoke("gestaoclick-purchases", {
    body: null,
    method: "GET",
  });

  // Fetch purchases page by page (API max 100 per page)
  while (hasMore) {
    const { data, error } = await supabase.functions.invoke("gestaoclick-purchases?action=purchases&pagina=" + page, {
      method: "GET",
    });

    if (error) throw new Error(error.message);

    const purchases = data?.data || data?.compras || data || [];
    
    if (!Array.isArray(purchases) || purchases.length === 0) {
      hasMore = false;
    } else {
      allPurchases.push(...purchases);
      if (purchases.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allPurchases;
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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getStatusBadge(situacao: string) {
  const lower = (situacao || "").toLowerCase();
  if (lower.includes("confirmado")) {
    return <Badge className="bg-blue-500/10 text-blue-700 border-blue-200">{situacao}</Badge>;
  }
  if (lower.includes("pendente")) {
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">{situacao}</Badge>;
  }
  if (lower.includes("pago") || lower.includes("finalizado")) {
    return <Badge className="bg-green-500/10 text-green-700 border-green-200">{situacao}</Badge>;
  }
  if (lower.includes("cancelad")) {
    return <Badge variant="destructive">{situacao}</Badge>;
  }
  return <Badge variant="secondary">{situacao}</Badge>;
}

export default function Purchases() {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  const { data: rawPurchases, isLoading, error } = useQuery({
    queryKey: ["gestaoclick-purchases"],
    queryFn: fetchAllPurchases,
    staleTime: 5 * 60 * 1000,
  });

  // Filter only relevant statuses
  const purchases = (rawPurchases || []).filter((p) => {
    const s = (p.situacao || "").toLowerCase();
    return s.includes("confirmado") || s.includes("pagamento pendente") || s.includes("pendente");
  });

  const suppliers = groupBySupplier(purchases);
  const totalOwed = suppliers.reduce((sum, s) => sum + s.totalAmount, 0);
  const selectedSupplierData = selectedSupplier
    ? suppliers.find((s) => s.id === selectedSupplier)
    : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Compras</h1>
          <p className="text-muted-foreground">
            Painel de compras por fornecedor — Confirmado / Pagamento Pendente
          </p>
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
            <span className="ml-3 text-muted-foreground">A carregar compras do GestãoClick...</span>
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
                          <TableHead>Data</TableHead>
                          <TableHead>Situação</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSupplierData.purchases.map((p) => (
                          <TableRow key={p.id || p.codigo}>
                            <TableCell className="font-medium">{p.codigo}</TableCell>
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
                    Nenhuma compra com situação Confirmado/Pagamento Pendente encontrada.
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
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((p) => (
                        <TableRow key={p.id || p.codigo}>
                          <TableCell className="font-medium">{p.codigo}</TableCell>
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
