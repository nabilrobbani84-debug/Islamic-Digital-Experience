import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label wajib untuk pembaca layar. */
  label: string;
  icon: ReactNode;
  active?: boolean;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, active = false, size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl text-fg transition-colors duration-200 hover:bg-surface-2 active:scale-95 disabled:opacity-40",
        size === "md" ? "size-11" : "size-9 pointer-coarse:size-11",
        active && "bg-surface-2 text-gold-text",
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
