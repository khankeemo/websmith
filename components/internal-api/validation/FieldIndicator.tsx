// FILE: components/internal-api/validation/FieldIndicator.tsx
// PURPOSE: Universal green-tick validation indicator (matches the SDK Welcome UI).
// SCOPE: Used next to Email and Mobile fields on every customer-facing form.
// RULE: Tick (✓) appears ONLY when the value is actually valid.

interface FieldIndicatorProps {
  state: "empty" | "valid" | "invalid";
}

export function FieldIndicator({ state }: FieldIndicatorProps) {
  if (state === "valid") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm font-bold text-[#16a34a]">
        ✓
      </span>
    );
  }
  if (state === "invalid") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm font-bold text-[#dc2626]">
        ✗
      </span>
    );
  }
  return <span className="h-5 w-5 shrink-0" />;
}
