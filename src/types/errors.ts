export class ConcurrencyError extends Error {
  constructor(message = 'Resource was modified by another operation. Please reload.') {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class LockedResumeVersionError extends Error {
  constructor(message = 'Cannot modify locked resume version.') {
    super(message);
    this.name = 'LockedResumeVersionError';
  }
}
