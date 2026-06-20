import { trpc } from "@/lib/trpc";

export default function DashboardPage() {
  const { data: tickets, isLoading: loadingTickets } = trpc.ticket.myTickets.useQuery();
  const { data: payments, isLoading: loadingPayments } = trpc.payment.myPayments.useQuery();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-extrabold mb-8">Mi panel</h1>

      <section className="mb-10">
        <h2 className="font-bold text-lg mb-3">Mis pagos</h2>
        {loadingPayments && <p className="text-gray-500 text-sm">Cargando...</p>}
        <div className="space-y-2">
          {payments?.map((p: any) => (
            <div key={p.id} className="card p-4 flex justify-between items-center text-sm">
              <span>{p.ticketCount} boleto(s) · ${p.amount}</span>
              <StatusBadge status={p.status} />
            </div>
          ))}
          {payments?.length === 0 && <p className="text-gray-500 text-sm">Aún no tienes pagos registrados.</p>}
        </div>
      </section>

      <section>
        <h2 className="font-bold text-lg mb-3">Mis boletos confirmados</h2>
        {loadingTickets && <p className="text-gray-500 text-sm">Cargando...</p>}
        <div className="flex flex-wrap gap-2">
          {tickets?.map((t: any) => (
            <span key={t.id} className="px-3 py-1.5 rounded-lg bg-primary-600/20 text-primary-300 text-sm font-mono">
              #{t.number}
            </span>
          ))}
          {tickets?.length === 0 && <p className="text-gray-500 text-sm">Todavía no tienes boletos confirmados.</p>}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400",
    processing: "bg-blue-500/20 text-blue-400",
    approved: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
    refunded: "bg-gray-500/20 text-gray-400",
  };
  const labels: Record<string, string> = {
    pending: "Pendiente",
    processing: "Procesando",
    approved: "Aprobado",
    rejected: "Rechazado",
    refunded: "Reembolsado",
  };
  return <span className={`px-2 py-1 rounded-md text-xs font-semibold ${colors[status]}`}>{labels[status]}</span>;
}
