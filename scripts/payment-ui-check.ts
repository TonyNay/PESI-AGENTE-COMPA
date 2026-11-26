import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadCulqiScript } from "../src/components/billing/sdk";
import type { BillingOverview } from "../src/lib/billing/catalog";

// Simula únicamente la descarga externa. No representa una operación real de Culqi.
async function main() {
  const scripts: FakeScript[] = [];
  const elements = new Map<string, FakeScript>();
  class FakeScript {
    id = ""; src = ""; async = false;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    remove() { if (elements.get(this.id) === this) elements.delete(this.id); }
  }
  const fakeWindow: Record<string, unknown> = {};
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    getElementById: (id: string) => elements.get(id), createElement: () => new FakeScript(),
    head: { appendChild: (script: FakeScript) => { scripts.push(script); elements.set(script.id, script); } },
  } });
  try {
    await test("Una sola descarga de Checkout compartida entre aperturas concurrentes", async () => {
      const first = loadCulqiScript("checkout");
      assert.equal(loadCulqiScript("checkout"), first); assert.equal(scripts.length, 1);
      assert.equal(scripts[0].src, "https://js.culqi.com/checkout-js");
      fakeWindow.CulqiCheckout = class FakeCheckout {};
      scripts[0].onload?.(); await first;
    });
    await test("Checkout se puede mostrar sin esperar ni descargar 3DS", async () => {
      assert.equal(fakeWindow.Culqi3DS, undefined);
      await loadCulqiScript("checkout");
      assert.equal(scripts.length, 1);
    });
    await test("Fallo de red de 3DS permite una descarga nueva y conserva Checkout", async () => {
      const load = loadCulqiScript("threeDS");
      const failed = assert.rejects(load, /No se pudo conectar/);
      scripts.at(-1)!.onerror?.(); await failed;
      assert.equal(elements.has("compa-culqi-3ds"), false);
      await loadCulqiScript("checkout"); assert.equal(scripts.length, 2);
    });
    await test("Script descargado sin su SDK muestra error y permite reintentar", async () => {
      const load = loadCulqiScript("threeDS");
      const failed = assert.rejects(load, /no pudo iniciar/);
      scripts.at(-1)!.onload?.(); await failed;
      assert.equal(elements.has("compa-culqi-3ds"), false);
    });
    await test("Una carga que no responde vence y se puede recuperar", async () => {
      await assert.rejects(loadCulqiScript("threeDS", 5), /está tardando/);
      const load = loadCulqiScript("threeDS");
      fakeWindow.Culqi3DS = { reset() {} };
      scripts.at(-1)!.onload?.(); await load;
      const before = scripts.length; await loadCulqiScript("threeDS"); assert.equal(scripts.length, before);
    });

    // Node no interpreta módulos CSS. Este adaptador solo permite el smoke test SSR.
    const importClient = createRequire(join(process.cwd(), "scripts", "payment-ui-check.ts"));
    const originalCss = importClient.extensions[".css"];
    importClient.extensions[".css"] = (module, path) => {
      const classes = Array.from(readFileSync(path, "utf8").matchAll(/\.([a-zA-Z][a-zA-Z0-9_]*)/g), (m) => m[1]);
      module.exports = Object.fromEntries(classes.map((name) => [name, name]));
    };
    try {
      const { BillingClient } = importClient("../src/components/billing/BillingClient") as typeof import("../src/components/billing/BillingClient");
      const { CulqiPayment } = importClient("../src/components/billing/CulqiPayment") as typeof import("../src/components/billing/CulqiPayment");
      const initial: BillingOverview = { enabled: true, simulatorEnabled: true, configurationMessage: null,
        buyer: { firstName: "Ana", lastName: "Prueba", email: "test@example.com", phone: "" }, invoice: { type: "boleta", documentNumber: "", legalName: "" }, plan: { name: "Prueba gratuita", priceAnalyses: 5, strategicAnalyses: 1, products: 20 }, payments: [], memberships: [],
        usage: { priceAnalyses: 3, strategicAnalyses: 1, products: 6 } };
      await test("Planes muestran contenido comercial y mantienen la ayuda fuera de la vista inicial", () => {
        const html = renderToStaticMarkup(createElement(BillingClient, { initial, company: "Empresa Demo", canBuy: true }));
        for (const text of ["Emprendedor", "Pro", "Empresa", "29.90", "79.90", "149.90", "Historial de pagos", "Ayuda e información de pagos"]) assert.ok(html.includes(text), text);
        for (const text of ["Demostración académica", "Simulador local", "CULQI · TEST", "SIMULATED", "review@culqi.com", "¿A nombre de quién va la compra?"]) assert.ok(!html.includes(text), text);
        assert.ok(!html.includes('role="dialog"'), "No se dibuja una ventana antes de elegir un plan");
      });
      await test("Una configuración sin Culqi no activa el simulador de forma automática", () => {
        const html = renderToStaticMarkup(createElement(BillingClient, { initial: { ...initial, enabled: false, configurationMessage: "Configura tus llaves de prueba." }, company: "Empresa Demo", canBuy: true }));
        assert.ok(html.includes("Configura tus llaves de prueba.")); assert.ok(!html.includes("Simulador local activo"));
        assert.equal((html.match(/disabled="" class="choose"/g) ?? []).length, 3);
      });
      await test("El checkout muestra carga desde SSR y usa contenedores distintos por instancia", () => {
        const props = { paymentId: "CPTEST", checkout: { publicKey: "pk_test_fixture", orderId: "ord_test_fixture", amount: 7990, currency: "PEN" as const, expiresAt: Date.now() + 60_000,
          client: { firstName: "Ana", lastName: "Prueba", email: "test@example.com" }, paymentMethods: { tarjeta: true, yape: true } }, onPaid: async () => {}, onBusy: () => {} };
        const html = renderToStaticMarkup(createElement(Fragment, null, createElement(CulqiPayment, props), createElement(CulqiPayment, props)));
        assert.ok(html.includes("Conectando con Culqi")); assert.ok(html.includes('aria-busy="true"'));
        const ids = Array.from(html.matchAll(/id="(compa-culqi-[^"]+)"/g), (m) => m[1]);
        assert.equal(ids.length, 2); assert.notEqual(ids[0], ids[1]);
      });
    } finally { if (originalCss) importClient.extensions[".css"] = originalCss; else delete importClient.extensions[".css"]; }
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
