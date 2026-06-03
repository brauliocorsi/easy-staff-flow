import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageSquare, Star, Lightbulb, UserX } from "lucide-react";
import { format } from "date-fns";

export default function Suggestions() {
  const [tab, setTab] = useState("all");

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["admin-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_suggestions")
        .select("*, employees(first_name, last_name, position), evaluated_leader:evaluated_leader_id(first_name, last_name, position)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = suggestions?.filter((s: any) => {
    if (tab === "all") return true;
    return s.type === tab;
  }) || [];

  const totalSuggestions = suggestions?.filter((s: any) => s.type === "suggestion").length || 0;
  const totalEvaluations = suggestions?.filter((s: any) => s.type === "leadership_evaluation").length || 0;
  const anonymousCount = suggestions?.filter((s: any) => s.is_anonymous).length || 0;
  const avgRating = (() => {
    const evals = suggestions?.filter((s: any) => s.type === "leadership_evaluation" && s.rating) || [];
    if (!evals.length) return 0;
    return (evals.reduce((sum: number, e: any) => sum + e.rating, 0) / evals.length).toFixed(1);
  })();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Sugestões & Avaliações</h1>
          <p className="text-muted-foreground mt-1">Feedback dos funcionários</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSuggestions}</p>
                <p className="text-xs text-muted-foreground">Sugestões</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Star className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEvaluations}</p>
                <p className="text-xs text-muted-foreground">Avaliações</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <UserX className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{anonymousCount}</p>
                <p className="text-xs text-muted-foreground">Anónimos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Star className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgRating || "—"}</p>
                <p className="text-xs text-muted-foreground">Média Liderança</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Todos ({suggestions?.length || 0})</TabsTrigger>
            <TabsTrigger value="suggestion">Sugestões ({totalSuggestions})</TabsTrigger>
            <TabsTrigger value="leadership_evaluation">Avaliações ({totalEvaluations})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !filtered.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum feedback recebido ainda.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map((s: any) => {
                  const emp = s.employees;
                  const isAnon = s.is_anonymous || !emp;
                  return (
                    <Card key={s.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 mt-0.5">
                            <AvatarFallback className={isAnon ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}>
                              {isAnon ? "?" : `${emp.first_name[0]}${emp.last_name[0]}`}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {isAnon ? "Anónimo" : `${emp.first_name} ${emp.last_name}`}
                              </span>
                              {!isAnon && emp.position && (
                                <span className="text-xs text-muted-foreground">· {emp.position}</span>
                              )}
                              <Badge variant={s.type === "suggestion" ? "outline" : "secondary"} className="text-xs">
                                {s.type === "suggestion" ? "💡 Sugestão" : "⭐ Avaliação"}
                              </Badge>
                              {isAnon && <Badge variant="secondary" className="text-xs">Anónimo</Badge>}
                            </div>
                            {s.type === "leadership_evaluation" && s.rating && (
                              <div className="flex gap-0.5 mt-1">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star key={n} className={`h-4 w-4 ${n <= s.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                                ))}
                              </div>
                            )}
                            {s.type === "leadership_evaluation" && s.evaluated_leader && (
                              <p className="text-xs mt-1.5">
                                <span className="text-muted-foreground">Líder avaliado: </span>
                                <span className="font-medium">
                                  {s.evaluated_leader.first_name} {s.evaluated_leader.last_name}
                                </span>
                                {s.evaluated_leader.position && (
                                  <span className="text-muted-foreground"> · {s.evaluated_leader.position}</span>
                                )}
                              </p>
                            )}
                            <p className="text-sm mt-2 whitespace-pre-wrap">{s.message}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(s.created_at), "dd/MM/yyyy 'às' HH:mm")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
