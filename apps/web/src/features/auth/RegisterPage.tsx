import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { api, userMessage } from "@/services/api";
import { registerSchema, type RegisterValues } from "./schemas";
import { AuthHeading, FormAlert, PasswordInput } from "./components";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<string | null>(null);
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", password: "", confirmPassword: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await api.auth.register({ name: values.name.trim(), email: values.email.toLowerCase(), password: values.password });
      setRegistered(result.email);
    } catch (err) {
      setError(userMessage(err));
    }
  });

  if (registered) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-14 text-gold" aria-hidden />
        <AuthHeading title="Periksa email Anda" description={<>Kami mengirim tautan verifikasi ke <strong className="text-fg">{registered}</strong>. Buka tautan tersebut untuk mengaktifkan akun.</>} />
        <Button variant="outline" onClick={() => void api.auth.resendVerification(registered)}>
          Kirim ulang email verifikasi
        </Button>
        <p className="mt-8 text-sm text-muted">
          Sudah verifikasi?{" "}
          <Link to="/login" className="font-semibold text-gold-text hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Buat akun NUR" description="Gratis. Data ibadah Anda tersinkron aman di semua perangkat." />
      {error && <FormAlert>{error}</FormAlert>}
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-5">
        <Input label="Nama" autoComplete="name" leading={<User className="size-4" />} error={form.formState.errors.name?.message} {...form.register("name")} />
        <Input label="Email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />
        <PasswordInput label="Kata sandi" autoComplete="new-password" hint="Minimal 8 karakter, berisi huruf dan angka." error={form.formState.errors.password?.message} {...form.register("password")} />
        <PasswordInput label="Konfirmasi kata sandi" autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} {...form.register("confirmPassword")} />
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Daftar
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Sudah punya akun?{" "}
        <Link to="/login" className="font-semibold text-gold-text hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}
