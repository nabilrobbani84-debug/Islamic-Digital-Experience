import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { api, userMessage } from "@/services/api";
import { resetSchema, type ResetValues } from "./schemas";
import { AuthHeading, FormAlert, PasswordInput } from "./components";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirmPassword: "" } });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(userMessage(err));
    }
  });

  if (!token) {
    return (
      <div>
        <AuthHeading title="Tautan tidak valid" description="Tautan reset kata sandi tidak lengkap atau sudah kedaluwarsa." />
        <Link to="/forgot-password" className="font-semibold text-gold-text hover:underline">
          Minta tautan baru
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <AuthHeading title="Kata sandi diperbarui" description="Semua sesi lama telah dicabut. Silakan masuk dengan kata sandi baru." />
        <Link to="/login" className="inline-flex h-12 items-center rounded-xl bg-emerald-nur px-6 font-semibold text-ivory">
          Masuk
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Buat kata sandi baru" />
      {error && <FormAlert>{error}</FormAlert>}
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-5">
        <PasswordInput label="Kata sandi baru" autoComplete="new-password" hint="Minimal 8 karakter, berisi huruf dan angka." error={form.formState.errors.password?.message} {...form.register("password")} />
        <PasswordInput label="Konfirmasi kata sandi" autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} {...form.register("confirmPassword")} />
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Simpan kata sandi
        </Button>
      </form>
    </div>
  );
}
