import type { ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useStore, useAccount } from "../../store/useStore";
import { accounts } from "../../lib/auth";
import type { Role } from "../../data/types";
import { Avatar, Button } from "../ui";
import { Logo } from "../Logo";

/** Only the signed-in account's own portal is reachable. */
export function RequireAuth({ role, children }: { role: Role; children: ReactNode }) {
  const session = useStore((s) => s.session);
  const signOut = useStore((s) => s.signOut);
  const loc = useLocation();
  const nav = useNavigate();
  const me = useAccount(session ?? role);

  if (!session) return <Navigate to={`/login?role=${role}&next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (session === role) return <>{children}</>;

  const want = accounts[role];
  return (
    <div className="grid min-h-screen place-items-center bg-milk px-5">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lift">
        <Link to="/" aria-label="Cowland Daily home"><Logo /></Link>
        <h1 className="mt-8 font-display text-2xl font-bold">This page is for {want.label.toLowerCase()}s</h1>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-milk p-3">
          <Avatar text={me.initials} color={me.color} />
          <div className="leading-tight">
            <p className="font-semibold">{me.name}</p>
            <p className="text-sm text-ink-soft">Signed in as {me.label.toLowerCase()}</p>
          </div>
        </div>
        <p className="mt-4 text-ink-soft">To open it, sign out and sign in with a {want.label.toLowerCase()} account.</p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" onClick={() => nav(me.home, { replace: true })}>Back to my app</Button>
          <Button size="lg" variant="soft" onClick={() => { signOut(); nav(`/login?role=${role}&next=${encodeURIComponent(loc.pathname)}`, { replace: true }); }}>Sign out and switch</Button>
        </div>
      </div>
    </div>
  );
}
