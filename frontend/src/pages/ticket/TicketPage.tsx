import { useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";
import { Upload } from "lucide-react";

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Apartado", color: "bg-blue-600" },
  processing: { label: "Revisando", color: "bg-yellow-600" },
  approved: { label: "Pagado", color: "bg-green-600" },
  rejected: { label: "Rechazado", color: "bg-red-600" },
  refunded: { label: "Reembolsado", color: "bg-gray-600" },
};

export default function TicketPage() {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, refetch } = trpc.payment.byCode.useQuery({ ticketCode: code! });
  const attachProof = trpc.payment.attachProofByCode.useMutation();
  const [proofUrl, setProofUrl] = useState("");

  if (isLoading) return <p className="text-center py-20 text-gray-500">Cargando ticket...</p>;
  if (!data) return <p className="text-center py-20 text-gray-500">Ticket no encontrado</p>;

  const { payment, raffle, numbers } = data;
  const status = statusLabels[payment.status] ?? statusLabels.pending;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    `${window.location.origin}/ticket/${code}`
  )}`;

  return (
    <div className="container mx-auto max-w-md px-4 py-10">
      <div className="card overflow-hidden">
        <div className="bg-primary-700 px-6 py-5">
          <p className="text-sm text-white/70">Ticket digital</p>
          <h1 className="text-lg font-bold text-white">{raffle?.title}</h1>
        </div>

        <div className="p-6 flex items-center gap-4 border-b border-gray-200">
          <img src={qrUrl} alt="QR" className="rounded-lg bg-white p-1 w-24 h-24" />
          <div>
            <p className="text-xs text-gray-500 font-mono break-all">{code}</p>
            <p className="font-bold mt-1">{payment.guestName}</p>
            <p className="text-primary-600 font-mono text-sm mt-1">
              {numbers.map((n: number) => `#${n}`).join("  ")}
            </p>
          </div>
        </div>

        <div className="p-6 text-center border-b border-gray-200">
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold text-white ${status.color}`}>
            {status.label}
          </span>
        </div>

        {payment.status === "pending" || payment.status === "processing" ? (
          <div className="p-6 space-y-3">
            <p className="text-sm text-gray-500">
              Realiza el pago de <span className="font-bold text-gray-900">${payment.amount}</span> y sube tu comprobante para validar tu participación.
            </p>
            <input
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="Pega el link de tu comprobante (imagen)"
              className="input-field"
            />
            <button
              disabled={!proofUrl || attachProof.isPending}
              onClick={async () => {
                await attachProof.mutateAsync({ ticketCode: code!, proofUrl });
                toast.success("Comprobante enviado, en revisión");
                refetch();
              }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" /> Enviar comprobante
            </button>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-sm text-green-400 text-center">¡Tu participación está confirmada! 🎉</p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">
        Guarda este link, es tu comprobante de participación:{" "}
        <span className="text-primary-600 break-all">{window.location.href}</span>
      </p>
    </div>
  );
}
