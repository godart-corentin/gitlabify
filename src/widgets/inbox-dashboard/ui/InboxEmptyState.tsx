import { CheckCircle2 } from "lucide-react";

export const InboxEmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-base-content/60 p-8">
      <CheckCircle2 className="w-8 h-8 text-base-content/40 mb-3" />
      <p className="text-sm font-medium text-base-content">Inbox Zero</p>
      <p className="text-xs text-base-content/60">You're all caught up!</p>
    </div>
  );
};
