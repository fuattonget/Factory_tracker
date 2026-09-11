import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-base font-bold text-slate-900">
              Factory Tracker <span className="font-normal text-slate-400">Admin</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin/projects" className="text-slate-600 hover:text-slate-900">
                Projeler
              </Link>
              <Link href="/admin/pipes" className="text-slate-600 hover:text-slate-900">
                Borular
              </Link>
              <Link href="/" className="text-slate-600 hover:text-slate-900">
                Public Dashboard
              </Link>
            </nav>
          </div>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
    </div>
  );
}
