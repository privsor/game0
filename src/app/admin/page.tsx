import Link from "next/link";

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <h1 className="text-3xl font-semibold">Admin</h1>
      <p className="text-gray-600">Restricted area. Choose a tool:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <Link className="text-blue-600 underline" href="/admin/fako/users">
            Fako Users Creator
          </Link>
        </li>
      </ul>
    </main>
  );
}
