export const AUTH_TOKEN_QUERY_KEY = ["auth-token"] as const;
export const AUTH_USER_QUERY_KEY = ["auth-user"] as const;
export const CONNECTION_STATUS_QUERY_KEY = ["connection-status"] as const;

const INBOX_MOCK_QUERY_SEGMENT = "mock";
const INBOX_LIVE_QUERY_SEGMENT = "live";

export const getInboxQueryKey = (isMockMode: boolean) =>
  ["inbox", isMockMode ? INBOX_MOCK_QUERY_SEGMENT : INBOX_LIVE_QUERY_SEGMENT] as const;
