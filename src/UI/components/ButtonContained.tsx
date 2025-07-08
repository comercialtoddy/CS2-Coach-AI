import * as React from "react";
import { twMerge } from "tailwind-merge";

interface ButtonContainedProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const ButtonContained = ({
  children,
  className,
  onClick,
  ...rest
}: ButtonContainedProps) => {
  return (
    <button
      {...rest}
      onClick={onClick}
      className={twMerge(
        "noDrag flex items-center justify-center rounded-full bg-primary px-5 py-1.5 text-sm font-semibold uppercase text-button-text drop-shadow-md transition-colors hover:bg-primary-dark",
        className,
      )}
    >
      {children}
    </button>
  );
};
