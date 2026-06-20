import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const navigate = useNavigate();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("Cuenta creada. Ahora inicia sesión.");
      navigate("/login");
    },
    onError: (err: any) => toast.error(err.message || "No fue posible crear la cuenta"),
  });

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-extrabold mb-6 text-center">Crear cuenta</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          registerMutation.mutate(form);
        }}
        className="card p-6 space-y-4"
      >
        <div>
          <label className="text-sm text-gray-400 block mb-1">Nombre completo</label>
          <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input-field" />
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">Correo electrónico</label>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" />
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">Contraseña</label>
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" />
          <p className="text-xs text-gray-500 mt-1">Mínimo 10 caracteres, con mayúscula, minúscula y número.</p>
        </div>
        <button type="submit" disabled={registerMutation.isPending} className="btn-primary w-full">
          {registerMutation.isPending ? "Creando..." : "Crear cuenta"}
        </button>
        <p className="text-sm text-gray-500 text-center">
          ¿Ya tienes cuenta? <Link to="/login" className="text-primary-400">Inicia sesión</Link>
        </p>
      </form>
    </div>
  );
}
