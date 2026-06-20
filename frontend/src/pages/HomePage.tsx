import { Link } from "react-router-dom";
import { trpc } from "@/lib/trpc";

export default function HomePage() {
  const { data: raffles, isLoading } = trpc.raffle.list.useQuery({ status: "active" });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold mb-3">Rifas activas</h1>
        <p className="text-gray-400">
          Cada sorteo se realiza con un número aleatorio verificable públicamente. Nadie, ni
          siquiera el operador, puede manipular el resultado.
        </p>
      </div>

      {isLoading && <p className="text-center text-gray-500">Cargando rifas...</p>}

      {!isLoading && raffles?.length === 0 && (
        <p className="text-center text-gray-500">No hay rifas activas por el momento.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {raffles?.map((raffle) => (
          <Link to={`/rifa/${raffle.slug}`} key={raffle.id} className="card overflow-hidden hover:border-primary-600 transition-colors">
            {raffle.coverImageUrl && (
              <img src={raffle.coverImageUrl} alt={raffle.title} className="w-full h-44 object-cover" />
            )}
            <div className="p-5">
              <h3 className="font-bold text-lg mb-1">{raffle.title}</h3>
              <p className="text-primary-400 font-semibold">${raffle.ticketPrice} / boleto</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
