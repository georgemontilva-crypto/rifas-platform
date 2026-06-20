import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";
import { Dice5, X } from "lucide-react";

const PAGE_SIZE = 200; // tamaño de cada "sección" del grid (0-200, 200-400, ...)

export default function RaffleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [section, setSection] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [showRandomModal, setShowRandomModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const { data, isLoading } = trpc.raffle.bySlug.useQuery({ slug: slug! });
  const { data: grid } = trpc.ticket.grid.useQuery(
    { raffleId: data?.raffle.id ?? "" },
    { enabled: !!data?.raffle.id }
  );

  const reserveMutation = trpc.ticket.reserveNumbers.useMutation();
  const createGuestMutation = trpc.payment.createGuest.useMutation();

  if (isLoading || !data) return <p className="text-center py-20 text-gray-500">Cargando...</p>;

  const { raffle, soldCount } = data;
  const progress = Math.round((soldCount / raffle.totalTickets) * 100);

  const gridMap = useMemo(() => {
    const m = new Map<number, string>();
    grid?.forEach((t: any) => m.set(t.number, t.status));
    return m;
  }, [grid]);

  const sections = Math.ceil(raffle.totalTickets / PAGE_SIZE);
  const sectionStart = section * PAGE_SIZE;
  const sectionEnd = Math.min(sectionStart + PAGE_SIZE, raffle.totalTickets);
  const numbersInSection = Array.from({ length: sectionEnd - sectionStart }, (_, i) => sectionStart + i);

  function toggleNumber(n: number) {
    const status = gridMap.get(n);
    if (status && status !== "available") return;
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      {raffle.coverImageUrl && (
        <img src={raffle.coverImageUrl} alt={raffle.title} className="w-full h-56 sm:h-72 object-cover rounded-2xl mb-6" />
      )}
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">{raffle.title}</h1>
      <p className="text-gray-500 mb-6 whitespace-pre-line">{raffle.description}</p>

      {/* Barra de progreso con porcentaje, estilo Rifary */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>{progress}% vendido</span>
          <span>{soldCount} / {raffle.totalTickets}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-primary-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grid de números */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-bold text-lg">¡Escoge tus números!</h2>
            <button
              onClick={() => setShowRandomModal(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100"
            >
              <Dice5 className="w-4 h-4" /> Seleccionar al azar
            </button>
          </div>

          {/* Tabs de secciones, como los rangos 0-1000 / 1000-2000 de Rifary */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {Array.from({ length: sections }, (_, i) => i).map((i) => (
              <button
                key={i}
                onClick={() => setSection(i)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  section === i ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {i * PAGE_SIZE}-{Math.min((i + 1) * PAGE_SIZE, raffle.totalTickets)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {numbersInSection.map((n) => {
              const status = gridMap.get(n) ?? "available";
              const isSelected = selected.includes(n);
              const padded = String(n).padStart(String(raffle.totalTickets - 1).length, "0");
              return (
                <button
                  key={n}
                  disabled={status !== "available"}
                  onClick={() => toggleNumber(n)}
                  className={`py-2 rounded-lg text-xs font-mono font-semibold transition-colors border ${
                    status === "sold"
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : status === "reserved"
                      ? "bg-amber-50 text-amber-600 border-amber-200 cursor-not-allowed"
                      : isSelected
                      ? "bg-primary-600 text-white border-primary-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-primary-400 hover:bg-primary-50"
                  }`}
                >
                  {padded}
                </button>
              );
            })}
          </div>
        </div>

        {/* Resumen / checkout lateral */}
        <div className="card p-5 h-fit lg:sticky lg:top-20">
          <p className="text-2xl font-bold text-primary-600 mb-1">${raffle.ticketPrice}</p>
          <p className="text-sm text-gray-500 mb-4">por boleto</p>

          <p className="text-sm text-gray-500 mb-2">{selected.length} número(s) seleccionados</p>
          <div className="flex flex-wrap gap-1.5 mb-4 max-h-32 overflow-y-auto">
            {selected.map((n) => (
              <span key={n} className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary-50 text-primary-700 text-xs font-mono">
                {n}
                <X className="w-3 h-3 cursor-pointer" onClick={() => toggleNumber(n)} />
              </span>
            ))}
          </div>

          <p className="font-bold text-lg mb-4">
            Total: ${(selected.length * Number(raffle.ticketPrice)).toFixed(2)}
          </p>

          <button
            disabled={selected.length === 0}
            onClick={() => setShowCheckout(true)}
            className="btn-primary w-full"
          >
            Continuar
          </button>
        </div>
      </div>

      {/* Modal: seleccionar al azar */}
      {showRandomModal && (
        <RandomModal
          raffleId={raffle.id}
          ticketPrice={Number(raffle.ticketPrice)}
          onClose={() => setShowRandomModal(false)}
          onConfirm={(numbers) => {
            setSelected((prev) => Array.from(new Set([...prev, ...numbers])));
            setShowRandomModal(false);
          }}
        />
      )}

      {/* Modal: checkout sin cuenta */}
      {showCheckout && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Participar</h3>
              <X className="w-5 h-5 cursor-pointer text-gray-500" onClick={() => setShowCheckout(false)} />
            </div>
            <p className="text-primary-600 font-mono text-sm mb-4">
              {selected.map((n) => `#${n}`).join("  ")}
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-sm text-gray-500 block mb-1">Nombre</label>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="input-field" placeholder="Tu nombre" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Teléfono (opcional)</label>
                <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="input-field" placeholder="Teléfono de contacto" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Email (opcional)</label>
                <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="input-field" placeholder="Para enviarte el ticket" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Total: <span className="font-bold text-gray-900">${(selected.length * Number(raffle.ticketPrice)).toFixed(2)}</span> ({selected.length} número(s))
            </p>
            <button
              disabled={!guestName || reserveMutation.isPending || createGuestMutation.isPending}
              onClick={async () => {
                try {
                  const reserved = await reserveMutation.mutateAsync({ raffleId: raffle.id, numbers: selected });
                  const result = await createGuestMutation.mutateAsync({
                    raffleId: raffle.id,
                    ticketIds: reserved.ticketIds,
                    reservationToken: reserved.reservationToken,
                    guestName,
                    guestPhone: guestPhone || undefined,
                    guestEmail: guestEmail || undefined,
                    provider: "manual_transfer",
                  });
                  toast.success("¡Listo! Aquí está tu ticket digital");
                  navigate(`/ticket/${result.ticketCode}`);
                } catch (err: any) {
                  toast.error(err.message || "No fue posible completar la reserva");
                }
              }}
              className="btn-primary w-full"
            >
              Aceptar y continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RandomModal({
  raffleId,
  ticketPrice,
  onClose,
  onConfirm,
}: {
  raffleId: string;
  ticketPrice: number;
  onClose: () => void;
  onConfirm: (numbers: number[]) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const utils = trpc.useUtils();

  async function pick(qty: number) {
    try {
      const numbers: number[] = await utils.client.ticket.randomNumbers.query({ raffleId, quantity: qty });
      const fresh = numbers.filter((n) => !picked.includes(n));
      setPicked((prev) => [...prev, ...fresh].slice(0, 50));
    } catch (err: any) {
      toast.error(err.message || "No hay suficientes boletos disponibles");
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
      <div className="card p-6 max-w-sm w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Seleccionar números</h3>
          <X className="w-5 h-5 cursor-pointer text-gray-500" onClick={onClose} />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3].map((qty) => (
            <button
              key={qty}
              onClick={() => pick(qty)}
              className="flex flex-col items-center justify-center py-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white"
            >
              <span className="font-bold text-lg">+{qty}</span>
              <span className="text-xs opacity-80">Tomar al azar</span>
            </button>
          ))}
        </div>

        {picked.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-2">{picked.length} número(s) seleccionados</p>
            <div className="flex flex-wrap gap-1.5 mb-3 max-h-24 overflow-y-auto">
              {picked.map((n) => (
                <span key={n} className="px-2 py-1 rounded-md bg-primary-50 text-primary-700 text-xs font-mono">{n}</span>
              ))}
            </div>
            <p className="text-right font-bold mb-4">Total: ${(picked.length * ticketPrice).toFixed(2)}</p>
          </>
        )}

        <button
          disabled={picked.length === 0}
          onClick={() => onConfirm(picked)}
          className="btn-primary w-full"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
