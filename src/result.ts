interface Failure<T> {
    success: false;
    error: T;
}

interface Success<T> {
    success: true;
    value: T;
}

export type Result<TFailure, TSuccess> = Failure<TFailure> | Success<TSuccess>;

export function failure<T>(error: T): Failure<T> {
    return {
        success: false,
        error
    };
}

export function success<T>(value: T): Success<T> {
    return {
        success: true,
        value,
    };
}
