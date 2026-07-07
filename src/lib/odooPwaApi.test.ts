import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signKoldRequest } from "./odooPwaApi.ts";

describe("odooPwaApi — firma HMAC compatible con invoice_controller._verify_signature", () => {
  // Vector verificado contra el algoritmo Python real:
  //   payload = f"{ts}.".encode() + rawBody
  //   base64( HMAC_SHA256(secret, payload) ), prefijo "v1="
  const secret = "test-secret-ABC123";
  const ts = 1751800000;
  const rawBody = JSON.stringify({
    jsonrpc: "2.0",
    method: "call",
    params: { meta: { operation_id: "op-1" }, data: { channel: "b2b", partner_id: 54907 } },
  });

  it("reproduce exactamente la firma esperada por Odoo (Python parity)", () => {
    // Valor calculado por hmac.new(secret, f"{ts}."+body, sha256) en Python.
    const expected = "v1=3ET86slwnfgSmivXjdnsC3CjBeOkRiqRb98L2jqXlAo=";
    assert.equal(signKoldRequest(secret, ts, rawBody), expected);
  });

  it("la firma cambia si cambia el timestamp (anti-replay)", () => {
    const a = signKoldRequest(secret, ts, rawBody);
    const b = signKoldRequest(secret, ts + 1, rawBody);
    assert.notEqual(a, b);
  });

  it("la firma cambia si cambia el body (integridad)", () => {
    const a = signKoldRequest(secret, ts, rawBody);
    const b = signKoldRequest(secret, ts, rawBody + " ");
    assert.notEqual(a, b);
  });

  it("usa el prefijo de versión v1=", () => {
    assert.match(signKoldRequest(secret, ts, rawBody), /^v1=/);
  });
});
