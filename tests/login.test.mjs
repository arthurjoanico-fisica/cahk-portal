import assert from "node:assert/strict";

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

const LOGIN_ALIASES = Object.freeze({
  caixadaex: "caixadaex@cahk.app",
});

function resolveTechnicalEmail(username) {
  return LOGIN_ALIASES[normalizeUsername(username)] ?? null;
}

assert.equal(normalizeUsername(" CaixaDAEX "), "caixadaex");
assert.equal(resolveTechnicalEmail("caixadaex"), "caixadaex@cahk.app");
assert.equal(resolveTechnicalEmail("CAIXADAEX"), "caixadaex@cahk.app");
assert.equal(resolveTechnicalEmail("outro"), null);

console.log("login tests: 4/4 passed");
