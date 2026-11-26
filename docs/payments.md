# Pagos de demostración en Compa

La rama `feat/culqi-payments` añade **Planes y pagos** en `/billing`, dentro de la cuenta y empresa existentes. No reinicia la contraseña de `demo@compa.pe` ni reemplaza sus productos.

La página de facturación tiene un encabezado propio y se abre desde **Mi plan**, al pie de la barra lateral. Las pestañas separan planes e historial. Elegir un plan abre el resumen y el pago en una ventana, sin desplazar la página. El botón **Ayuda** reúne la información del entorno académico, los datos de prueba y el selector del simulador; Culqi es el entorno inicial.

El checkout se monta con un identificador único y altura definida. La descarga de 3DS se realiza al necesitar la verificación del dispositivo y no bloquea la presentación del formulario. Hay estados de carga y error, descarga nueva tras un fallo y una alternativa de ventana Culqi con la misma orden si el navegador no muestra el formulario incrustado.

## Planes propuestos

| Plan | Precio por 31 días | Análisis de precios | Análisis estratégicos | Productos |
| --- | ---: | ---: | ---: | ---: |
| Emprendedor | S/ 29,90 | 20 | 2 | 50 |
| Pro | S/ 79,90 | 100 | 10 | 250 |
| Empresa | S/ 149,90 | 300 | 30 | 1 000 |

Las capacidades se aplican en el servidor: al superar los análisis del mes o los productos del plan, la API responde 402. Sin plan vigente rige la prueba gratuita (5 análisis de precios, 1 estratégico y 20 productos por mes). `COMPA_ENFORCE_PLAN_LIMITS=0` desactiva los límites. Cada compra aprobada activa el plan para la empresa durante 31 días. Una compra posterior cambia al plan elegido y suma 31 días a la vigencia restante del mismo entorno. Son pagos únicos, sin renovación automática. Las condiciones están en `/billing/conditions`.

## Abrir en local

Desde el repositorio:

```bash
git switch feat/culqi-payments
cd app
npm run dev
```

Abrir `http://localhost:3000/billing` e ingresar con la cuenta demo habitual. Si Next elige otro puerto, usar la dirección que imprime. La integración acepta el origen de la solicitud local; ajustar `COMPA_PUBLIC_URL` al publicar detrás de un proxy.

En esta instalación, las llaves de prueba facilitadas están en `app/.env.local`, ignorado por Git y con permisos `600`. Para otra instalación, completar estas variables en su `.env.local`:

```dotenv
CULQI_PUBLIC_KEY=pk_test_TU_LLAVE
CULQI_SECRET_KEY=sk_test_TU_LLAVE
COMPA_PAYMENT_SIMULATOR=1
COMPA_PUBLIC_URL=http://localhost:3000
```

La llave secreta solo se lee en el servidor. No utilizar `NEXT_PUBLIC_` para ella. Este código rechaza llaves `live`, incluso con `NODE_ENV=production`. Reiniciar Next después de cambiar variables. Si se usa `next start` sobre HTTP local, el proyecto ya admite `COMPA_INSECURE_COOKIES=1`; en HTTPS no es necesario.

## Dos demostraciones distintas

**Culqi TEST:** utiliza Checkout Custom, tokenización de tarjeta/Yape, órdenes multipago y autenticación 3DS. Requiere conexión a Culqi y que sus métodos estén disponibles para la cuenta. El navegador nunca determina que una compra está pagada: el servidor consulta el recurso con la llave secreta y comprueba importe, moneda y pertenencia.

**Simulador local:** crea órdenes `SIMULATED`, sin contactar a Culqi ni al banco. Permite mostrar aprobado, pendiente y rechazado para tarjeta, Yape, QR, banca móvil, agentes y Cuotéalo. No genera un QR cobrable. Su membresía está separada de TEST y no puede modificar compras de Culqi. Se desactiva con `COMPA_PAYMENT_SIMULATOR=0`.

Para exponer sin depender del proveedor:

1. Abrir **Ayuda**, elegir **Simulador local**, cerrar la ayuda y elegir un plan.
2. Revisar los datos del comprador y aceptar las condiciones.
3. Crear la orden, elegir QR y dejarla pendiente: el plan no se activa.
4. Simular aprobado: se activa la membresía SIMULATED y aparece la constancia.
5. Crear otra orden y simular rechazado: la membresía anterior no se amplía.
6. Consultar el historial y abrir la boleta o factura de demostración, que desglosa el IGV y se identifica como documento sin valor tributario.

Los nombres y correo se precargan desde la cuenta. Culqi requiere los datos del comprador para crear la orden; el teléfono se solicita si aún no está registrado. Tras crear una orden se recuerdan para la siguiente. Modificar el correo del comprador no cambia el correo de acceso a Compa.

## Datos de prueba

Usar exclusivamente los [datos oficiales de Culqi](https://docs.culqi.com/es/documentacion/pagos-online/tarjetas-de-prueba/), también disponibles en la ayuda de `/billing`:

| Caso | Número | Vencimiento | CVV / código |
| --- | --- | --- | --- |
| Visa débito | 4111 1111 1111 1111 | 09/30 | 123 |
| Visa crédito | 4111 1111 1010 1113 | 09/30 | 123 |
| Mastercard | 5111 1111 1111 1118 | 12/30 | 039 |
| Fondos insuficientes | 4000 0400 0000 0008 | 03/30 | 295 |
| Yape | 900000001 | — | 123456 |

Para reto 3DS: comprador `review@culqi.com`, Visa `4456530000001096`, `07/30`, CVV `111`. El segundo envío del cargo conserva el token y dispositivo del primero. Si se cierra el desafío, se puede reabrir la compra desde el historial; no se vuelve a enviar un cargo con respuesta incierta.

QR, banca móvil y agentes utilizan una orden. Generar su código no acredita la compra. Cuotéalo se ofrece en Empresa, cuyo precio supera S/ 100. La disponibilidad efectiva depende de Culqi. No se ha validado una operación QR de extremo a extremo ni un mecanismo oficial de aprobación manual del sandbox: para mostrar ese resultado en clase está el simulador separado.

## Confirmación y webhooks

Endpoint público: `POST https://TU_DOMINIO/api/payments/webhook`.

Configurar en Culqi los eventos `order.status.changed` y `charge.creation.succeeded`. El cuerpo `data` puede ser objeto o JSON serializado. No se confía en el estado del webhook: se consulta la API autenticada antes de acreditar. La respuesta pública solo confirma recepción. El servidor no acepta simulaciones en el webhook ni tokeniza tarjetas directamente.

En localhost se puede consultar el estado desde la pantalla; los webhooks requieren un dominio HTTPS público o un túnel que configures. Para una respuesta de cargo perdida sin referencia recuperable, el webhook permite reconciliar el cargo por el token ya registrado. Hasta entonces se bloquea otro cargo de esa compra y se muestra pendiente de verificación. No hay reintentos automáticos de cobro.

Las notificaciones repetidas no duplican activaciones. Un segundo pago distinto de una compra ya pagada requiere revisión; no se suman días de nuevo. Los reembolsos no se ejecutan desde esta versión y los cargos con devolución detectada antes de la activación se rechazan para revisión. La conciliación posterior de devoluciones o contracargos queda fuera de esta demo.

## Alcance y controles

- Solo administradores compran; los datos y estados están limitados a la empresa autenticada.
- Importe, moneda y duración proceden del catálogo del servidor, no del formulario.
- Solicitudes repetidas comparten una referencia; tokens, transacciones y activaciones tienen controles de unicidad en SQLite.
- Se verifican captura, importe, moneda, token y metadatos del cargo. `paid` en un cargo representa abono; no sustituye la comprobación de captura.
- Protección de origen, límites de solicitudes persistentes y cuerpos JSON de hasta 16 KiB en las rutas de pagos.
- Se guardan referencias, datos del comprador y aceptación de condiciones; no PAN ni CVV. El SDK de Culqi recibe los datos bancarios.
- Solo se añaden tablas `billing_*`. La base y credenciales de demostración existentes se conservan.

No constituye una tienda aprobada para producción. No habilita cobros reales, envío de comprobantes a la SUNAT, suscripciones automáticas, reembolsos o las obligaciones comerciales de una tienda en producción.

## Verificación

```bash
npm run test:payments
npm run test:payment-ui
npx next typegen
npm run typecheck
npx eslint src/lib/billing src/components/billing src/app/api/payments 'src/app/(billing)' src/components/Sidebar.tsx scripts/payments-check.ts scripts/payment-ui-check.ts
npm run build
```

Las pruebas usan el esquema real en una base temporal y transporte Culqi simulado: validan activación, idempotencia, 3DS, Yape, QR, aislamiento de empresas, importes alterados, pérdida de respuesta, vencimiento y protección HTTP. No generan operaciones externas ni cambian la cuenta demo.

La suite de interfaz verifica la carga independiente de Checkout, descargas concurrentes, recuperación tras error o timeout y renderizado inicial. Son pruebas con un documento simulado y renderizado de React en servidor; no sustituyen una sesión real de navegador ni la comprobación del contenido servido por Culqi.

La revisión con Playwright debe comprobar también los estilos calculados: tres tarjetas en una fila en escritorio, una columna en móvil, ventana de compra con posición fija y contenedor de Culqi con altura suficiente. Comprobar solo textos, diálogos e inputs puede dar un resultado positivo aunque no haya estilos. La regla de Tailwind en `next.config.ts` se limita a `globals.css`; los archivos `*.module.css` deben conservar el procesamiento de módulos de Next.

En el entorno de trabajo del agente, TypeScript, ESLint y las pruebas de pagos pasan. El build predeterminado se detuvo porque Turbopack intenta abrir un puerto interno y el entorno lo deniega (`Operation not permitted`). El intento alternativo con Webpack se detuvo al leer la salida de `tsc --showConfig`. Esto no valida una compilación completa ni una sesión de navegador. Quedan por ejecutar `npm run build` y la prueba interactiva con Culqi en una terminal local sin esas restricciones.

## Referencias de implementación

- [Checkout Custom multipago](https://docs.culqi.com/es/documentacion/checkout/checkout-custom)
- [API oficial: órdenes y cargos](https://apidocs.culqi.com/)
- [Flujo oficial de cargos con 3DS](https://docs.culqi.com/es/documentacion/culqi-3ds/flujo-con-3ds/): `200` solicita autenticación; `201` indica cargo exitoso. Se priorizó este flujo y la API frente a una tabla invertida de códigos en la página secundaria de uso de la librería.
- [Configuración de 3DS](https://docs.culqi.com/es/documentacion/culqi-3ds/v1/configuracion/)
- [Webhooks](https://docs.culqi.com/es/documentacion/pagos-online/webhooks/)
- [Billeteras móviles](https://docs.culqi.com/es/documentacion/pagos-online/ordenes-de-pago/billetera-moviles/)
