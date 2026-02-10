import { useState } from "react";

import { useAuth } from "../../hooks/useAuth";

import { AuthHeader } from "./AuthHeader";
import { getAuthErrorMessage } from "./get-auth-error-message";
import { OAuthSection } from "./OAuthSection";
import { PatSection } from "./PatSection";
import { useAuthScreenListeners } from "./useAuthScreenListeners";

const SECRET_CLICK_THRESHOLD = 5;

export const AuthScreen = () => {
  const {
    verifyAndSave,
    isVerifying,
    verifyError,
    startOauth,
    exchangeCode,
    isStartingOauth,
    isExchanging,
    authError,
    refetchToken,
  } = useAuth();
  const [showPAT, setShowPAT] = useState(false);
  const [showManualCode, setShowManualCode] = useState(false);
  const [debugClicks, setDebugClicks] = useState(0);
  const [oauthErrorMessage, setOauthErrorMessage] = useState<string | null>(null);

  useAuthScreenListeners({
    exchangeCode,
    refetchToken,
    setOauthErrorMessage,
  });

  const handleSecretClick = () => {
    const newClicks = debugClicks + 1;
    setDebugClicks(newClicks);
    if (newClicks >= SECRET_CLICK_THRESHOLD) {
      setShowManualCode(true);
      setDebugClicks(0);
    }
  };

  const handleShowPat = () => {
    setShowPAT(true);
  };

  const handleShowOauth = () => {
    setShowPAT(false);
  };

  const handleHideManualCode = () => {
    setShowManualCode(false);
  };

  const handleOAuth = async () => {
    setOauthErrorMessage(null);
    try {
      await startOauth();
    } catch {
      // handled by mutation
    }
  };

  const handleManualCodeSubmit = async (code: string) => {
    setOauthErrorMessage(null);
    try {
      await exchangeCode(code);
    } catch (err: unknown) {
      setOauthErrorMessage(err instanceof Error ? err.message : "Failed to verify code");
    }
  };

  const handleSubmitToken = async (token: string) => {
    try {
      await verifyAndSave({ token });
    } catch {
      // handled by mutation
    }
  };

  const isPending = isVerifying || isStartingOauth || isExchanging;
  const patErrorMessage = getAuthErrorMessage({
    validationError: null,
    authError: null,
    verifyError,
  });
  const oauthError =
    oauthErrorMessage || (!showPAT && authError instanceof Error ? authError.message : null);

  return (
    <div className="flex h-screen items-center justify-center bg-base-100 p-4">
      <div className="w-full max-w-sm border border-base-300 rounded-md p-6 flex flex-col">
        <AuthHeader />

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
          <div className="mb-6 flex-shrink-0">
            <h2
              className="text-sm font-medium cursor-default select-none"
              onClick={handleSecretClick}
            >
              Authenticate
            </h2>
            <p className="text-xs text-base-content/60">
              Sign in to your GitLab account to continue.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {!showPAT ? (
              <OAuthSection
                isPending={isPending}
                isStartingOauth={isStartingOauth}
                isExchanging={isExchanging}
                showManualCode={showManualCode}
                onManualCodeSubmit={handleManualCodeSubmit}
                onHideManualCode={handleHideManualCode}
                onStartOauth={handleOAuth}
                onShowPat={handleShowPat}
                errorMessage={oauthError}
              />
            ) : (
              <PatSection
                isPending={isPending}
                isVerifying={isVerifying}
                errorMessage={patErrorMessage}
                onSubmitToken={handleSubmitToken}
                onBack={handleShowOauth}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
