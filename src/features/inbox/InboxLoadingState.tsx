export const InboxLoadingState = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-base-content/60 p-8">
      <span className="loading loading-spinner loading-md text-primary mb-2"></span>
      <p className="text-xs text-base-content/60">Loading inbox...</p>
    </div>
  );
};
