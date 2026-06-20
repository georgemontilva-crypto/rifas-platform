import { trpc } from "@/lib/trpc";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const { data: stats } = trpc.admin.dashboard.useQuery();
  const { data: pending, refetch } = trpc.admin.pendingPayments.useQuery();
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

      <h2 className="font-bold text-lg mb-3">Pagos pendientes de aprobación</h2>
      <div className="space-y-2">
        {pending?.map((p: any) => (
          <div key={p.id} className="card p-4 flex justify-between items-center">
            <div className="text-sm">
              <p className="font-semibold">{p.ticketCount} boleto(s) · ${p.amount}</p>
              <p className="text-gray-500 text-xs">{p.provider}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  approveMutation.mutate({ paymentId: p.id });
                  toast.success("Pago aprobado");
                }}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
              >
                Aprobar
              </button>
              <button
                onClick={() => {
                  rejectMutation.mutate({ paymentId: p.id });
                  toast.error("Pago rechazado");
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
              >
                Rechazar
              </button>
            </div>
          </div>
        ))}
        {pending?.length === 0 && <p className="text-gray-500 text-sm">No hay pagos pendientes.</p>}
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
