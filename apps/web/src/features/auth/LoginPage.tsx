import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { api, isApiError, userMessage } from "@/services/api";
import { useAuth } from "@/stores/auth";
import { rememberSession } from "./useSession";
import { loginSchema, type LoginValues } from "./schemas";
import { AuthHeading, FormAlert, PasswordInput } from "./components";

/** Hanya izinkan redirect internal (mencegah open redirect). */
export function safeNext(next: string | null): string {
  if (!next) return "/dashboard";
  try {
    const decoded = decodeURIComponent(next);
    return decoded.startsWith("/") && !decoded.startsWith("//") ? decoded : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const user = await api.auth.login({ email: values.email.toLowerCase(), password: values.password, deviceName: navigator.platform || undefined });
      useAuth.getState().setAuthenticated(user);
      await rememberSession(user);
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (err) {
      if (isApiError(err) && (err.status === 401 || err.code === "INVALID_CREDENTIALS")) setError("Email atau kata sandi salah.");
      else if (isApiError(err) && err.code === "EMAIL_NOT_VERIFIED") setError("Email belum diverifikasi. Periksa kotak masuk Anda.");
      else setError(userMessage(err));
    }
  });

  return (
    <div>
      <AuthHeading title="Masuk ke NUR" description="Akun diperlukan untuk menyimpan bookmark, progres, dan riwayat ibadah Anda." />
      {error && <FormAlert>{error}</FormAlert>}
      {api.mode === "mock" && (
        <FormAlert tone="success">
          Mode mock: gunakan <strong>demo@nur.local</strong> / <strong>demo12345</strong> (pengguna) atau <strong>admin@nur.local</strong> / <strong>admin12345</strong> (super admin).
        </FormAlert>
      )}
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-5">
        <Input label="Email" type="email" autoComplete="email" leading={<Mail className="size-4" />} error={form.formState.errors.email?.message} {...form.register("email")} />
        <PasswordInput label="Kata sandi" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register("password")} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-gold-text hover:underline">
            Lupa kata sandi?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Masuk
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Belum punya akun?{" "}
        <Link to="/register" className="font-semibold text-gold-text hover:underline">
          Daftar
        </Link>
      </p>
    </div>
  );
}
