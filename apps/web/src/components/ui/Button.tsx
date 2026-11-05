import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "gold" | "outline" | "ghost" | "subtle" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-nur text-ivory hover:bg-emerald-deep shadow-[0_10px_30px_-12px_rgb(8_127_91/0.8)] border border-emerald-nur/40",
  gold: "bg-gradient-to-b from-gold-soft to-gold text-navy hover:brightness-105 shadow-glow border border-gold/50",
  outline: "border border-line bg-transparent text-fg hover:bg-surface-2 hover:border-gold/40",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  subtle: "bg-surface-2 text-fg hover:bg-surface border border-line",
  danger: "bg-red-700 text-white hover:bg-red-800 border border-red-500/40",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-xl pointer-coarse:h-11",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-13 px-7 text-base gap-2.5 rounded-2xl",
  icon: "h-11 w-11 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, leftIcon, rightIcon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition-[transform,background-color,border-color,filter,box-shadow] duration-200 ease-nur active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
