import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-600 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary-600">Kelyo</h1>
          <p className="mt-2 text-sm text-slate-500">Espace Commerçant</p>
        </div>

        <div className="space-y-4">
          <p className="text-slate-700 text-center">
            Bienvenue. Connectez-vous pour gérer vos paiements, QR codes et liens.
          </p>

          <Link
            href="/login"
            className="block w-full text-center py-3 px-4 rounded-lg bg-primary-500 text-white font-semibold hover:bg-primary-600 transition"
          >
            Se connecter
          </Link>

          <Link
            href="/signup"
            className="block w-full text-center py-3 px-4 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
          >
            Créer un compte commerçant
          </Link>
        </div>

        <p className="mt-8 text-xs text-center text-slate-400">
          Phase 0 — squelette. Auth fonctionnelle en Phase 5.
        </p>
      </div>
    </main>
  );
}
