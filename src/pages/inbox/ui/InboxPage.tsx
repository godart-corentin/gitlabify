import { Dashboard } from "../../../widgets/inbox-dashboard/ui/Dashboard";

type InboxPageProps = {
  currentUsername?: string;
};

export const InboxPage = ({ currentUsername }: InboxPageProps) => {
  return <Dashboard currentUsername={currentUsername} />;
};
