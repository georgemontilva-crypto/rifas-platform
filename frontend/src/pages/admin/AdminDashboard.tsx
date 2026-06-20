import { useState } from "react";
import { trpc } from "@/lib/trpc";
import toast from "react-hot-toast";
import { Search } from "lucide-react";

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Apartado", color: "bg-blue-600/20 text-blue-400" },
  processing: { label: "Revisando", color: "bg-yellow-600/20 text-yellow-400" },
  approved: { label: "Pagado", color: "bg-green-600/20 text-green-400" },
  rejected: { label: "Rechazado", color: "bg-red-600/20 text-red-400" },
  refunded: { label: "Reembolsado", color: "bg-gray-600/20 text-gray-400" },
};

export default function AdminDashboard() {
  const { data: stats } = trpc.admin.dashboard.useQuery();
  const { data: raffles } = trpc.raffle.list.useQuery(undefined);
  const [selectedRaffleId, setSelectedRaffleId] = useState<string>("");
  const [search, setSearch] = useState("");

  const raffleId = selectedRaffleId || raffles?.[0]?.id || "";

  const { data: participantsData, refetch } = trpc.admin.participants.useQuery(
    { raffleId, search: search || undefined },
    { enabled: !!raffleId }
  );

  const approveMutation = trpc.payment.approve.useMutation({ onSuccess: () => refetch() });
  const rejectMutation = trpc.payment.reject.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-extrabold mb-8">Panel de administración</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="Usuarios" value={stats?.userCount} />
        <StatCard label="Rifas" value={stats?.raffleCount} />
        <StatCard label="Pagos pendientes" value={stats?.pendingPayments} />
        <StatCard label="Boletos vendidos" value={stats?.soldTickets} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <select
          value={raffleId}
          onChange={(e) => setSelectedRaffleId(e.target.value)}
          className="input-field max-w-xs"
        >
          {raffles?.map((r: any) => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar participante..."
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Conteos por estado, como el panel de Rifary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <CountCard label="Apartado" value={participantsData?.counts.apartado} color="text-blue-400" />
        <CountCard label="Revisando" value={participantsData?.counts.revisando} color="text-yellow-400" />
        <CountCard label="Pagado" value={participantsData?.counts.pagado} color="text-green-400" />
      </div>

      <h2 className="font-bold text-lg mb-3">Participantes</h2>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/60 text-gray-400 text-left">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Boletos</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {participantsData?.participants.map((p: any) => {
              const status = statusLabels[p.status] ?? statusLabels.pending;
              return (
                <tr key={p.id} className="border-t border-gray-800">
                  <td className="px-4 py-3">{p.guestName || "—"}</td>
                  <td className="px-4 py-3">{p.ticketCount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(p.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {p.status !== "approved" && (
                      <button
                        onClick={() => {
                          approveMutation.mutate({ paymentId: p.id });
                          toast.success("Pago aprobado");
                        }}
                        className="px-2 py-1 rounded-md bg-green-600 text-white text-xs hover:bg-green-700"
                      >
                        Aprobar
                      </button>
                    )}
                    {p.status !== "rejected" && (
                      <button
                        onClick={() => {
                          rejectMutation.mutate({ paymentId: p.id });
                          toast.error("Pago rechazado");
                        }}
                        className="px-2 py-1 rounded-md bg-red-600 text-white text-xs hover:bg-red-700"
                      >
                        Rechazar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {participantsData?.participants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No hay participantes todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-2xl font-extrabold text-primary-400">{value ?? "—"}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function CountCard({ label, value, color }: { label: string; value?: number; color: string }) {
  return (
    <div className="card p-4 text-center">
      <p className={`text-2xl font-extrabold ${color}`}>{value ?? 0}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
