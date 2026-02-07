import { CheckCircle2 } from "lucide-react";

export const InboxEmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8">
      <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4 opacity-50" />
      <p className="text-lg font-medium text-zinc-300">Inbox Zero</p>
      <p className="text-sm">You're all caught up!</p>
    </div>
  );
};
