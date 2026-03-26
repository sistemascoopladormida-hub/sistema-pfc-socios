import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionButtonTone = "teal" | "amber" | "red" | "slate";

type ActionButtonProps = {
  tone?: ActionButtonTone;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
};

const toneClass: Record<ActionButtonTone, string> = {
  teal: "text-[#0D6E5A] hover:bg-[#0D6E5A] hover:text-white",
  amber: "text-amber-700 hover:bg-amber-600 hover:text-white",
  red: "text-red-700 hover:bg-red-600 hover:text-white",
  slate: "text-slate-700 hover:bg-slate-700 hover:text-white",
};

export function ActionButton({
  tone = "slate",
  label,
  icon,
  disabled = false,
  onClick,
  title,
}: ActionButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "h-7 rounded-[10px] border border-transparent px-2 text-xs transition-all",
        toneClass[tone],
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {icon}
      {label}
    </Button>
  );
}
