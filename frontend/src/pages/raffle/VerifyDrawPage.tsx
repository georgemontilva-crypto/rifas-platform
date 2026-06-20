import { useParams } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export default function VerifyDrawPage() {
  const { raffleId } = useParams<{ raffleId: string }>();
  const { data, isLoading, error } = trpc.draw.verify.useQuery({ raffleId: raffleId! });

  if (isLoading) return <p className="text-center py-20 text-gray-500">Verificando...</p>;
  if (error || !data)
    return <p className="text-center py-20 text-gray-500">Este sorteo aún no se ha realizado.</p>;

  const allValid = data.commitHashValid && data.resultsMatch;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="text-center mb-8">
        {allValid ? (
          <ShieldCheck className="w-14 h-14 text-green-500 mx-auto mb-3" />
        ) : (
          <ShieldAlert className="w-14 h-14 text-red-500 mx-auto mb-3" />
        )}
        <h1 className="text-2xl font-extrabold">
          {allValid ? "Sorteo verificado correctamente" : "No se pudo verificar el sorteo"}
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          Cualquier persona puede recalcular el resultado con los datos publicados abajo.
        </p>
      </div>

      <div className="card p-6 space-y-4 font-mono text-sm break-all">
        <Row label="Hash publicado ANTES del sorteo (commit)" value={data.commitHash} />
        <Row label="Seed revelado DESPUÉS del sorteo" value={data.revealedSeed} />
        <Row label="Número ganador publicado" value={String(data.publishedWinningNumber)} />
        <Row label="Número ganador recalculado de forma independiente" value={String(data.recomputedWinningNumber)} />
      </div>

      <p className="text-xs text-gray-500 text-center mt-6">
        Fórmula: sha256(seed + ":" + raffleId) % totalTickets — y sha256(seed) debe coincidir con el hash publicado antes de abrir la venta.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs mb-1 font-sans">{label}</p>
      <p className="text-gray-200">{value}</p>
    </div>
  );
}
