import { useQuery } from '@tanstack/react-query';
import AvailabilityMatrix from '../components/AvailabilityMatrix.js';

const API_BASE_URL: string = (globalThis as any).__API_BASE_URL__ ?? 'http://localhost:4000/api';

type HealthResponse = {
  status: string;
  timestamp: string;
};

const fetchHealth = async (): Promise<HealthResponse> => {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Failed to reach API');
  }
  return response.json();
};

export default function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8 gap-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Meal Appointment Coordinator</h1>
        <p className="text-slate-300">Coordinate your next meal with friends.</p>
      </header>
      <section className="bg-slate-900 rounded-xl p-6 shadow-lg w-full max-w-xl">
        <h2 className="text-xl font-semibold mb-4">API Connectivity</h2>
        {isLoading && <p>Checking API status…</p>}
        {isError && <p className="text-red-400">Failed to reach the API server.</p>}
        {data && (
          <div className="space-y-2">
            <p className="text-green-400 font-medium">API status: {data.status}</p>
            <p className="text-xs text-slate-400">Last checked at {new Date(data.timestamp).toLocaleString()}</p>
          </div>
        )}
      </section>
      <AvailabilityMatrix />
    </div>
  );
}
