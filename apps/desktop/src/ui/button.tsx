import type { ComponentPropsWithRef } from "react";

type ButtonVariant = "default" | "secondary" | "ghost" | "outline";
type ButtonSize = "default" | "sm" | "icon";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
};

/** Local shadcn-style button primitive; keeps native button behavior and app handlers. */
export function Button({
  className = "",
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`.trim()}
      type={type}
      {...props}
    />
  );
}
