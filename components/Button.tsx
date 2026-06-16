import { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export type ButtonVariant = NonNullable<ButtonProps["variant"]>;

export function buttonClassName(variant: ButtonVariant = "secondary", className?: string) {
  return clsx(
    "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    variant === "primary" && "bg-moss text-white hover:bg-[#334f39]",
    variant === "secondary" && "border border-[#d7cec0] bg-white text-ink hover:bg-[#f4f0e9]",
    variant === "ghost" && "text-ink hover:bg-[#eee8df]",
    variant === "danger" && "bg-[#b43e32] text-white hover:bg-[#963429]",
    className
  );
}

export function Button({ className, variant = "secondary", ...props }: ButtonProps) {
  return <button className={buttonClassName(variant, className)} {...props} />;
}
