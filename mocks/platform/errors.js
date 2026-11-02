// Domain errors. Every service returns { ok, data?, error? }; error is PlatformError#toJSON().

export const ERROR_STATUS = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  FORBIDDEN_LIMIT: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VERSION_CONFLICT: 409,
  INVALID_TRANSITION: 409,
  ORDER_CANCELLED: 409,
  PAST_CANCELLATION_CUTOFF: 409,
  INSUFFICIENT_STOCK: 409,
  PRICE_CHANGED: 409,
  RESERVATION_EXPIRED: 409,
  PAYMENT_FAILED: 402,
  REFUND_EXCEEDS_CAPTURED: 409,
  IDEMPOTENCY_CONFLICT: 422,
  IDEMPOTENCY_IN_PROGRESS: 409,
  OFFER_EXPIRED: 409,
  UPSTREAM_UNAVAILABLE: 503,
  STORAGE_FULL: 507,
  DATA_CORRUPT: 500,
  APPEND_ONLY: 500,
  INTERNAL: 500,
};

export class PlatformError extends Error {
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "PlatformError";
    this.code = code;
    this.status = ERROR_STATUS[code] || 400;
    this.details = details;
  }
  toJSON() {
    return { code: this.code, message: this.message, status: this.status, details: this.details };
  }
}

export const err = (code, message, details) => new PlatformError(code, message, details);

// Body helper: commit everything written so far, then report this error to the caller (for example a wrong OTP
// whose attempt counter must persist). Not stored for idempotency replay.
export const commitThenFail = (error) => ({ $error: error });
export const isCommitFail = (v) => !!v && typeof v === "object" && v.$error instanceof PlatformError;

export const ok = (data) => ({ ok: true, data });
export const fail = (error) => ({ ok: false, error: error instanceof PlatformError ? error.toJSON() : error });
