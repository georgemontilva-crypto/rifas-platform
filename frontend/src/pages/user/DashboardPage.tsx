import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-extrabold mb-2 text-center">Buscar mi ticket</h1>
      <p className="text-gray-500 text-sm text-center mb-6">
        Pega el código que te dieron al reservar tus números para ver el estado de tu participación.
      </p>
      <div className="card p-6 space-y-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          placeholder="Código de tu ticket"
          className="input-field"
        />
        <button
          disabled={!code}
          onClick={() => navigate(`/ticket/${code}`)}
          className="btn-primary w-full"
        >
          Ver mi ticket
        </button>
      </div>
    </div>
  );
}
