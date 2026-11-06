import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { api, userMessage } from "@/services/api";
import { AuthHeading } from "./components";

type State = { status: "verifying" } | { status: "success" } | { status: "error"; message: string };

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>(token ? { status: "verifying" } : { status: "error", message: "Token verifikasi tidak ditemukan pada tautan." });
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api.auth
      .verifyEmail(token)
      .then(() => setState({ status: "success" }))
      .catch((err: unknown) => setState({ status: "error", message: userMessage(err) }));
  }, [token]);

  return (
    <div className="text-center" aria-live="polite">
      {state.status === "verifying" && (
        <>
          <LoaderCircle className="mx-auto size-12 animate-spin text-gold" aria-hidden />
          <AuthHeading title="Memverifikasi email…" />
        </>
      )}
      {state.status === "success" && (
        <>
          <CircleCheck className="mx-auto size-14 text-accent" aria-hidden />
          <AuthHeading title="Email terverifikasi" description="Akun Anda sudah aktif." />
          <Link to="/login" className="inline-flex h-12 items-center rounded-xl bg-emerald-nur px-6 font-semibold text-ivory">
            Masuk
          </Link>
        </>
      )}
      {state.status === "error" && (
        <>
          <CircleAlert className="mx-auto size-14 text-red-400" aria-hidden />
          <AuthHeading title="Verifikasi gagal" description={state.message} />
          <Link to="/login" className="font-semibold text-gold-text hover:underline">
            Kembali ke halaman masuk
          </Link>
        </>
      )}
    </div>
  );
}
