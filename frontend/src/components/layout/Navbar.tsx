import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { trpc } from "@/lib/trpc";
import { Ticket, LogOut, ShieldCheck } from "lucide-react";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      logout();
      navigate("/");
    },
  });

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
        <Link to="/" className="text-xl font-extrabold text-primary-400 flex items-center gap-2">
          🎟️ Rifas
        </Link>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="text-sm text-gray-300 hover:text-white flex items-center gap-1.5">
                <Ticket className="w-4 h-4" /> Mis boletos
              </Link>
              {(user?.role === "admin" || user?.role === "superadmin") && (
                <Link to="/admin" className="text-sm text-gray-300 hover:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Admin
                </Link>
              )}
              <span className="text-sm text-gray-500 hidden sm:inline">{user?.fullName}</span>
              <button
                onClick={() => logoutMutation.mutate()}
                className="text-sm text-gray-400 hover:text-white flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" /> Salir
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <Link to="/login" className="text-sm px-3 py-2 text-gray-300 hover:text-white">
                Iniciar sesión
              </Link>
              <Link to="/registro" className="btn-primary text-sm">
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
