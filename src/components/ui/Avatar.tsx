import { clsx } from "clsx";
import { User as UserIcon } from "lucide-react";

type AvatarProps = {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Avatar({ src, alt, size = "md", className }: AvatarProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  return (
    <div
      className={clsx(
        "rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0",
        sizeClasses[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <UserIcon className="w-1/2 h-1/2 text-zinc-500" />
      )}
    </div>
  );
}
