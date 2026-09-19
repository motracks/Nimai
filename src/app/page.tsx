import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-4 text-xl font-semibold">Verdic Nimai — spike</h1>
      <p className="mb-6 text-sm text-gray-600">
        Ugly-on-purpose end-to-end slice: auth → Big Five → RLS-protected read.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="underline">
          Sign in
        </Link>
        <Link href="/bigfive" className="underline">
          Take Big Five
        </Link>
        <Link href="/results" className="underline">
          View results
        </Link>
      </div>
    </main>
  );
}
