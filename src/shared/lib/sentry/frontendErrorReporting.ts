import { Sentry } from "./sentry";

export type FrontendReportOptions = {
  error?: unknown;
  feature: string;
  action?: string;
  extra?: Record<string, unknown>;
};

const toTags = ({ feature, action }: FrontendReportOptions) => ({
  ...(action ? { action } : {}),
  feature,
});

const toCause = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error === undefined) {
    return undefined;
  }

  return String(error);
};

const toExtra = ({ error, extra }: FrontendReportOptions) => {
  const cause = toCause(error);
  return {
    ...(cause ? { cause } : {}),
    ...extra,
  };
};

const logLocally = (level: "warn" | "error", message: string, error?: unknown): void => {
  if (!import.meta.env.DEV) {
    return;
  }

  if (error === undefined) {
    console[level](message);
    return;
  }

  console[level](message, error);
};

export const reportFrontendWarning = (message: string, options: FrontendReportOptions): void => {
  logLocally("warn", message, options.error);

  if (options.error instanceof Error) {
    Sentry.captureException(options.error, {
      extra: toExtra(options),
      level: "warning",
      tags: toTags(options),
    });
    return;
  }

  Sentry.captureMessage(message, {
    extra: toExtra(options),
    level: "warning",
    tags: toTags(options),
  });
};

export const reportFrontendError = (message: string, options: FrontendReportOptions): void => {
  logLocally("error", message, options.error);

  if (options.error instanceof Error) {
    Sentry.captureException(options.error, {
      extra: toExtra(options),
      tags: toTags(options),
    });
    return;
  }

  Sentry.captureMessage(message, {
    extra: toExtra(options),
    level: "error",
    tags: toTags(options),
  });
};
