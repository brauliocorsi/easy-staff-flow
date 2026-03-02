import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function UserManager() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(email, password, displayName);
      if (error) throw error;
      toast.success("Utilizador criado! Um email de confirmação foi enviado.");
      setEmail("");
      setPassword("");
      setDisplayName("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar utilizador");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Registrar Novo Utilizador
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="newUserName">Nome</Label>
            <Input
              id="newUserName"
              placeholder="Nome do utilizador"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newUserEmail">Email</Label>
            <Input
              id="newUserEmail"
              type="email"
              placeholder="email@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newUserPassword">Senha</Label>
            <Input
              id="newUserPassword"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Criar Utilizador
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
