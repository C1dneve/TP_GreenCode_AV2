import { errors } from "./domain-error.js";

/** Ensures callers cannot bypass the optimistic-locking contract outside HTTP validation. */
export function requireExpectedVersion(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw errors.badRequest("VALIDATION_ERROR", "versaoEsperada é obrigatória e deve ser um inteiro maior ou igual a 1.");
  }
}
