export const InboxLoadingState = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8">
      <span className="loading loading-spinner loading-md text-orange-500 mb-2"></span>
      <p>Loading inbox...</p>
    </div>
  );
};
