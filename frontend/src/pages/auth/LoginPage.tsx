import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data: any) => {
      setSession(data.user, data.accessToken);
      toast.success("¡Bienvenido de nuevo!");
      navigate("/dashboard");
    },
    onError: (err: any) => toast.error(err.message || "Credenciales inválidas"),
  });

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-extrabold mb-6 text-center">Iniciar sesión</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loginMutation.mutate({ email, password });
        }}
        className="card p-6 space-y-4"
      >
        <div>
          <label className="text-sm text-gray-400 block mb-1">Correo electrónico</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">Contraseña</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" />
        </div>
        <button type="submit" disabled={loginMutation.isPending} className="btn-primary w-full">
          {loginMutation.isPending ? "Entrando..." : "Entrar"}
        </button>
        <p className="text-sm text-gray-500 text-center">
          ¿No tienes cuenta? <Link to="/registro" className="text-primary-400">Regístrate</Link>
        </p>
      </form>
    </div>
  );
}
