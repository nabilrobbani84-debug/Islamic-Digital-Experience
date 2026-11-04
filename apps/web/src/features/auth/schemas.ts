import { z } from "zod";

const email = z.string().trim().min(1, "Email wajib diisi").email("Format email tidak valid").max(255);

/** Kebijakan kata sandi minimum di sisi klien; backend tetap menjadi validator final. */
export const passwordRule = z
  .string()
  .min(8, "Minimal 8 karakter")
  .max(128, "Maksimal 128 karakter")
  .regex(/[A-Za-z]/, "Harus mengandung huruf")
  .regex(/\d/, "Harus mengandung angka");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120, "Nama terlalu panjang"),
    email,
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Konfirmasi kata sandi tidak sama" });

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Konfirmasi kata sandi tidak sama" });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
export type ResetValues = z.infer<typeof resetSchema>;
