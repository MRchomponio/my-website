import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            "w-full h-11 rounded-xl bg-background-elevated border border-background-border px-3.5 text-sm text-foreground placeholder:text-foreground-subtle outline-none transition-colors focus:border-neon-blue/60 focus:ring-2 focus:ring-neon-blue/20",
            error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            "w-full min-h-[100px] rounded-xl bg-background-elevated border border-background-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-subtle outline-none transition-colors focus:border-neon-blue/60 focus:ring-2 focus:ring-neon-blue/20 resize-y",
            error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
