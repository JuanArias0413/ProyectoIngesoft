export class DomainError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends DomainError {
  public readonly errors: unknown[];

  constructor(message = 'Error de validación', errors: unknown[] = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acceso denegado: no tiene permisos para realizar esta acción') {
    super(message, 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'El recurso solicitado no fue encontrado') {
    super(message, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Conflicto con el estado actual del recurso') {
    super(message, 409);
  }
}

export class InvalidTransitionError extends DomainError {
  public readonly fromStatus: string;
  public readonly transition: string;

  constructor(
    fromStatus: string,
    transition: string,
    message?: string,
  ) {
    const defaultMsg = `Transición inválida '${transition}' desde el estado '${fromStatus}'`;
    super(message ?? defaultMsg, 409);
    this.fromStatus = fromStatus;
    this.transition = transition;
  }
}
