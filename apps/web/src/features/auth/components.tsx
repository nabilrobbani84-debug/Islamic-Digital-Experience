import { forwardRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/Field";

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      leading={<Lock className="size-4" />}
      trailing={
        <button type="button" onClick={() => setVisible((v) => !v)} className="grid size-9 place-items-center rounded-lg text-muted hover:text-fg" aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={visible}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
});

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-muted">{description}</p>}
    </div>
  );
}

export function FormAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={tone === "error" ? "mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300" : "mb-5 rounded-2xl border border-emerald-nur/30 bg-emerald-nur/10 px-4 py-3 text-sm text-accent"}>
      {children}
    </div>
  );
}
