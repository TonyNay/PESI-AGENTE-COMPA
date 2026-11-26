# Compa — Inteligencia competitiva con un agente automatizado

Plataforma web B2B (proyecto universitario "Agente automatizado"). Una empresa se registra, carga sus productos y
servicios (a mano o por CSV) y un **agente** busca en la web, visita tiendas competidoras, extrae ofertas, las
normaliza y genera un reporte con KPIs, gráficos, FODA, recomendaciones y precio sugerido.

## Stack
Next.js 16 (App Router, TypeScript, Tailwind 4) · Recharts · SQLite nativo (`node:sqlite`, Node >= 22.5; probado en Node 26) ·
bcryptjs + sesiones por token en cookie httpOnly.

## Arquitectura
```
Navegador ──> Páginas (server components) ──> SQLite (data/compa.db)
     │                                            ▲
     └─> /api/* (nodejs runtime) ── POST /api/analyses ──> cola en proceso (concurrencia 2)
                                                              │
                                                    Orquestador del agente
   1 Planificación  → consultas de búsqueda (código)          │
   2 Búsqueda+scraping → LLMProvider.runStructured(useWebTools) ┤  claude-cli | anthropic | mock
   3 Normalización  → filtra sin precio / match<0.5, dedup por URL, conversión de moneda, estadísticas
   4 Análisis estratégico → 2ª llamada al LLM (resumen, FODA, recomendaciones, precio sugerido)
   5 Guardado → competitor_offers + analyses.result_json; cada paso se registra en agent_logs
```
### Análisis estratégico (`/strategy`)
Dentro de cada empresa, el usuario puede analizar **su propia empresa** o **cualquier otra** (competidor, proveedor…) ingresando
nombre, sitio web, un documento (PDF, TXT, MD, CSV o HTML, máx. 8 MB) y/o una descripción. El agente (mismo proveedor y modelo, Haiku 5.5 effort medium):
1. **Planificación** — decide las fuentes. Si es la propia empresa, incluye el catálogo y los resultados de la herramienta de precios de Compa (índice de precio, posición, competidores detectados).
2. **Investigación** (WebSearch/WebFetch, y Read para el PDF) — perfil, misión/visión declaradas, competidores, datos PESTEL con URL de la fuente, tendencias, hallazgos del documento.
3. **Análisis estratégico**, organizado según el sílabo en *I. Análisis de la situación actual* y *II. Diseño de la solución*, en pasos con esquemas pequeños (un único esquema con todas las herramientas supera el límite de gramática de la salida estructurada de la API). Cada paso recibe lo decidido en los anteriores:
   1. Misión, visión, valores, modelo Canvas y cadena de valor (con al menos 5 procesos principales por actividad) ‖ PESTEL, cinco fuerzas de Porter y Matriz de Perfil Competitivo (MPC) — en paralelo.
   2. FODA y matrices EFI/EFE → el código normaliza pesos y calcula los totales y el cuadrante de la matriz Interna-Externa (IE).
   3. Matriz BCG (estimada; el cuadrante lo calcula el código) y matriz de Ansoff, coherentes con la IE.
   4. Dirección estratégica: interpretación formal del cuadrante IE para los dueños → estrategia general (crecimiento, estabilidad o reducción), estrategia competitiva genérica de Porter y estrategias de negocio (intensivas, integración, diversificación, defensivas).
   5. Objetivos estratégicos (BSC), matriz FODA cruzada (FO/FA/DO/DA) y resumen ejecutivo.
   6. Informe de gestión del plan estratégico empresarial e informe ejecutivo.
   Los textos citan en APA 7 (fuentes de la investigación y marco teórico de cada herramienta, `src/lib/apa.ts`); en la web cada cita enlaza a la lista de referencias y cada herramienta tiene un enlace directo (`/strategy/<id>#cadena_valor`, `#informe_ejecutivo`, `#referencias`…).
   Cada paso se reintenta una vez si falla. Con `AGENT_PROVIDER=anthropic`, si la API aun así rechaza un esquema por tamaño, el paso se repite con el esquema dentro del prompt.
   **Cada estrategia tiene un KPI** con fórmula, tipo de indicador (eficacia, eficiencia, efectividad, calidad, productividad, financiero), perspectiva BSC, fuente de información (interna/externa), frecuencia, línea base y meta.
4. **Guardado** — `strategic_analyses.result_json`; el timeline se registra en `strategic_logs`. Los PDF se guardan en `data/uploads/`.

- La página `/analyses/[id]` hace polling cada 2 s a `GET /api/analyses/[id]?after=<logId>` para mostrar el timeline en vivo.
- Multi-tenant: toda consulta filtra por `company_id` de la sesión.
- Al arrancar el servidor (`src/instrumentation.ts`) los análisis `queued`/`running` huérfanos pasan a `failed`.
- Índice de precio = precio propio / promedio × 100. Posición: <= 95 más barato, 95–105 en mercado, > 105 más caro.
  Percentil = % de competidores con precio menor al propio. Monedas: tabla fija en `src/lib/agent/currency.ts`.

## Cómo correr
```bash
npm install
cp .env.example .env.local     # opcional
npm run seed                   # crea la cuenta demo (idempotente)
npm run dev                    # http://localhost:3000
```
`npm run build && npm start` para producción (si no usas HTTPS define `COMPA_INSECURE_COOKIES=1`).

**Cuenta demo:** `demo@compa.pe` (empresa "Andina Retail SAC", 6 ítems), con la contraseña definida en `COMPA_DEMO_PASSWORD` (si no se define, `npm run seed` genera una y la muestra en consola). El registro público está cerrado salvo `COMPA_ALLOW_REGISTER=1`.

## Scripts
| Comando | Qué hace |
|---|---|
| `npm run seed` | Crea empresa/usuario demo y 6 ítems; importa `data/seed-analyses.json` si existe |
| `npm run analyze -- <productId\|all>` | Corre el agente desde terminal para productos de la empresa demo e imprime el progreso |
| `npm run export-seed` | Vuelca los análisis completados de la demo a `data/seed-analyses.json` |
| `npm run test:payments` / `test:payment-ui` / `test:compliance` | Pruebas de pagos, interfaz de pago, cumplimiento y autenticación |
| `npm run test:ecommerce` | Pruebas de reembolsos y notas de crédito, referidos, auditoría, renovación, Libro de Reclamaciones, importación Shopify/WooCommerce y métricas |

Para una demo offline: `AGENT_PROVIDER=mock npm run dev`.

## Proveedores del agente (`AGENT_PROVIDER`)
- **`claude-cli`** (por defecto): ejecuta `claude -p ... --model claude-haiku-5-5 --effort medium --allowedTools WebSearch WebFetch --output-format json --json-schema '<schema>'`
  con `child_process.spawn` (sin shell, cwd temporal vacío, timeout 6 min) y lee `structured_output`. Requiere Claude Code instalado y autenticado. Registra `total_cost_usd` y `duration_ms`.
  Variables: `CLAUDE_CLI_MODEL`, `CLAUDE_CLI_EFFORT`.
- **`anthropic`**: SDK `@anthropic-ai/sdk`, server tools `web_search` y `web_fetch`, salida estructurada (`output_config.format`).
  **Para pasar de claude-cli a la API:** en `.env.local` pon `AGENT_PROVIDER=anthropic` y `ANTHROPIC_API_KEY=sk-ant-...` y reinicia. Nada más.
- **`mock`**: datos deterministas con pequeños delays; sin red.

Para añadir otro proveedor implementa `LLMProvider` (`src/lib/agent/types.ts`) y regístralo en `providers/index.ts`.

## Componentes de negocio electrónico
| Componente | Dónde | Notas |
|---|---|---|
| Libro de Reclamaciones virtual | `/libro-reclamaciones` (público), `/admin/reclamaciones` | Hoja con los 4 bloques del formato oficial, número correlativo `000001-2026`, plazo de 15 días hábiles (sin fines de semana ni feriados) y consulta por número + documento. `lib/complaints.ts` |
| Reembolsos y notas de crédito | Mi plan → Ver detalle → Solicitar reembolso | Garantía de 7 días si se usaron ≤ 5 análisis. Culqi: `POST /v2/refunds` sobre el cargo verificado; QR/PagoEfectivo se gestionan a mano. Nota de crédito `BC01`/`FC01` que referencia el comprobante. `lib/billing/service.ts` |
| Aviso de renovación | Banner en la app y en Mi plan | 5 días antes y hasta 7 días después del vencimiento. No hay cobro automático por diseño. `lib/billing/limits.ts` |
| Registro de auditoría | Mi cuenta → Actividad de la cuenta | Accesos, intentos fallidos, cambios, 2FA, pagos, reembolsos, importaciones y reclamos, con IP. Se conserva un año. `lib/audit.ts` |
| Programa de referidos | Mi cuenta → Invita y gana; `/register?ref=CÓDIGO` | +31 días al referente cuando la empresa invitada paga su primer plan; se revierte si ese pago se reembolsa. `lib/referrals.ts` |
| Métricas del negocio | `/admin/metrics` (+ CSV) | MRR, ARPA, conversión de la prueba, churn, ingresos, reembolsos, costo de IA medido y margen por cliente. `lib/metrics.ts` |
| Importación de catálogo | Productos → Importar CSV | Detecta la plantilla de Compa y las exportaciones de Shopify y WooCommerce; actualiza por SKU. `lib/catalog-import.ts` |
| SEO y landing | `/`, `/ejemplo`, `robots.txt`, `sitemap.xml` | Precios, FAQ, datos estructurados (SoftwareApplication + FAQPage) y un reporte real de ejemplo. |

Las secciones de administración solo las ven los correos de `COMPA_PLATFORM_ADMINS`. Para exponer, puede usarse `COMPA_PLATFORM_ADMINS=demo@compa.pe`.

## Estructura
```
src/
  instrumentation.ts            marca análisis huérfanos al arrancar
  app/
    page.tsx                    landing
    (auth)/login, register
    (app)/dashboard, products, products/[id], analyses/[id], strategy, strategy/[id]   (layout con sidebar)
    api/auth/*, api/products/*, api/analyses/*, api/strategy/*
  components/                   Sidebar, charts (Recharts), formularios, timeline en vivo
  lib/
    db.ts                       node:sqlite + migración idempotente
    auth.ts, api.ts, products.ts, csv.ts, queries.ts, format.ts, types.ts
    agent/
      orchestrator.ts strategic.ts queue.ts prompts.ts schemas.ts normalize.ts currency.ts types.ts
      providers/ claude-cli.ts anthropic.ts mock.ts index.ts
scripts/  seed.ts analyze.ts export-seed.ts
data/     compa.db (generada), seed-analyses.json (opcional)
```

## Limitaciones conocidas
- La cola es en memoria (un solo proceso); si el servidor se reinicia, los análisis en curso se marcan como fallidos.
- Los precios dependen de lo que el LLM pueda leer en la web. Falabella y Plaza Vea se leen bien (en sus páginas de listado, cada vendedor cuenta como una oferta). Ripley e Hiraoka responden HTTP 403 al scraping; en ese caso el agente usa el precio del resultado de búsqueda y lo marca como "no verificado" en la columna de disponibilidad.
- El número de ofertas varía entre corridas (típicamente 4–10). Si la primera búsqueda trae menos de 3, el agente hace automáticamente una búsqueda ampliada. Si aun así no hay ofertas, el análisis termina como "fallido" con un mensaje claro, en lugar de inventar datos.
- Costo aproximado por análisis de precios con claude-cli (Haiku 5.5): US$ 0.10–0.35, y entre 1 y 3 minutos. Análisis estratégico: ≈ US$ 0.20 y 4–6 minutos.
- Las tasas de cambio son una tabla fija referencial.
- El proveedor `anthropic` no se probó con una key real en este entorno.
