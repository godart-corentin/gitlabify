import { useState, type SubmitEvent } from "react";

import { useAuth } from "../../hooks/useAuth";

import { getAuthErrorMessage } from "./get-auth-error-message";
import { useAuthScreenListeners } from "./useAuthScreenListeners";

const SECRET_CLICK_THRESHOLD = 5;

export const useAuthScreenState = () => {
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
  const [token, setToken] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [showManualCode, setShowManualCode] = useState(false);
  const [showPAT, setShowPAT] = useState(false);
  const [debugClicks, setDebugClicks] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const setValidationErrorMessage = (message: string) => {
    setValidationError(message);
  };

  useAuthScreenListeners({
    exchangeCode,
    refetchToken,
    setOauthErrorMessage: setValidationErrorMessage,
  });

  const handleSecretClick = () => {
    const newClicks = debugClicks + 1;
    setDebugClicks(newClicks);
    if (newClicks >= SECRET_CLICK_THRESHOLD) {
      setShowManualCode(true);
      setDebugClicks(0);
    }
  };

  const handleTokenChange = (value: string) => {
    setToken(value);
  };

  const handleManualCodeChange = (value: string) => {
    setManualCode(value);
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

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setValidationError("Please enter your Personal Access Token");
      return;
    }

    try {
      await verifyAndSave({ token: trimmedToken });
    } catch {
      // handled by mutation
    }
  };

  const handleManualCodeSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    const trimmedCode = manualCode.trim();
    if (!trimmedCode) {
      setValidationError("Please enter the OAuth code");
      return;
    }
    try {
      await exchangeCode(trimmedCode);
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : "Failed to verify code");
    }
  };

  const handleOAuth = async () => {
    try {
      await startOauth();
    } catch {
      // handled by mutation
    }
  };

  const isPending = isVerifying || isStartingOauth || isExchanging;

  return {
    token,
    manualCode,
    showManualCode,
    showPAT,
    isPending,
    isVerifying,
    isStartingOauth,
    isExchanging,
    errorMessage: getAuthErrorMessage({ validationError, authError, verifyError }),
    handleSecretClick,
    handleTokenChange,
    handleManualCodeChange,
    handleShowPat,
    handleShowOauth,
    handleHideManualCode,
    handleSubmit,
    handleManualCodeSubmit,
    handleOAuth,
  };
};
