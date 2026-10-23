import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCnpj } from "../modules/organizacoes/organizacoes.service.js";

test("CNPJ normalizado valida os dígitos verificadores e aceita apresentação formatada", () => {
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11222333000180"), false);
});

test("CNPJ rejeita valor repetido, tamanho inválido e campo vazio", () => {
  assert.equal(isValidCnpj("00000000000000"), false);
  assert.equal(isValidCnpj("1234567890123"), false);
  assert.equal(isValidCnpj(""), false);
});
