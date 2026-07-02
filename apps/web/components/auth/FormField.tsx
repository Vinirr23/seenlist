import { Input, type InputProps } from "@seenlist/ui";
import { cn } from "@seenlist/utils";

interface FormFieldProps extends InputProps {
  label: string;
}

export function FormField({ label, id, className, ...props }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <Input
        id={id}
        className={cn(
          "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text",
          "placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
          className
        )}
        {...props}
      />
    </div>
  );
}
