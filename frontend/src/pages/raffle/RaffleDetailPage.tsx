import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/store/authStore";

export default function RaffleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [quantity, setQuantity] = useState(1);

  const { data, isLoading, refetch } = trpc.raffle.bySlug.useQuery({ slug: slug! });
  const reserveMutation = trpc.ticket.reserve.useMutation();
  const createPayment = trpc.payment.create.useMutation();

  if (isLoading) return <p className="text-center py-20 text-gray-500">Cargando...</p>;
  if (!data) return <p className="text-center py-20 text-gray-500">Rifa no encontrada</p>;

  const { raffle, soldCount, availableCount } = data;
  const progress = Math.round((soldCount / raffle.totalTickets) * 100);

  async function handleBuy() {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    try {
      const reserved = await reserveMutation.mutateAsync({ raffleId: raffle.id, quantity });
      const idempotencyKey = crypto.randomUUID();
      await createPayment.mutateAsync({
        raffleId: raffle.id,
        ticketIds: reserved.ticketIds,
        provider: "manual_transfer",
        idempotencyKey,
      });
      toast.success(`Reservaste ${reserved.numbers.length} boleto(s). Completa el pago en tu panel.`);
      navigate("/dashboard");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "No fue posible completar la reserva");
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      {raffle.coverImageUrl && (
        <img src={raffle.coverImageUrl} alt={raffle.title} className="w-full h-64 object-cover rounded-2xl mb-6" />
      )}
      <h1 className="text-3xl font-extrabold mb-2">{raffle.title}</h1>
      <p className="text-gray-400 mb-6 whitespace-pre-line">{raffle.description}</p>

      <div className="card p-6 mb-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>{soldCount} vendidos</span>
          <span>{availableCount} disponibles</span>
        </div>
        <div className="h-2 rounded-full bg-gray-800 overflow-hidden mb-4">
          <div className="h-full bg-primary-500" style={{ width: `${progress}%` }} />
        </div>

        <p className="text-2xl font-bold text-primary-400 mb-4">${raffle.ticketPrice} <span className="text-sm text-gray-500">por boleto</span></p>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-400">Cantidad de boletos</label>
          <input
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="input-field w-24"
          />
        </div>

        <button onClick={handleBuy} disabled={reserveMutation.isPending} className="btn-primary w-full">
          {reserveMutation.isPending ? "Reservando..." : "Reservar y comprar"}
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        El sorteo de esta rifa es verificable.{" "}
        <a href={`/verificar/${raffle.id}`} className="text-primary-400 underline">
          Ver verificación pública
        </a>
      </p>
    </div>
  );
}
