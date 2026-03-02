import logo from "@/assets/logo.png";

export const AuthHeader = () => {
  return (
    <header className="flex flex-col gap-1 mb-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <img src={logo} alt="Gitlabify" className="w-8 h-8 object-contain" />
        <h1 className="text-base font-medium tracking-tight">Welcome to Gitlabify</h1>
      </div>
      <p className="text-xs text-base-content/60">Sign in to continue.</p>
    </header>
  );
};
