import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { api, userMessage } from "@/services/api";
import { forgotSchema, type ForgotValues } from "./schemas";
import { AuthHeading, FormAlert } from "./components";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await api.auth.forgotPassword(email.toLowerCase());
      setSent(true);
    } catch (err) {
      setError(userMessage(err));
    }
  });
  return (
    <div>
      <AuthHeading title="Lupa kata sandi" description="Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru." />
      {/* Pesan sama untuk email terdaftar/tidak terdaftar agar tidak membocorkan keberadaan akun. */}
      {sent && <FormAlert tone="success">Jika email tersebut terdaftar, tautan reset kata sandi telah dikirim. Periksa kotak masuk dan folder spam.</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-5">
        <Input label="Email" type="email" autoComplete="email" leading={<Mail className="size-4" />} error={form.formState.errors.email?.message} {...form.register("email")} />
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Kirim tautan reset
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        <Link to="/login" className="font-semibold text-gold-text hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </div>
  );
}
