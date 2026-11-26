import { LEGAL_VERSION } from "@/lib/legal";

export const metadata = { title: "Política de privacidad · Compa" };

export default function PrivacyPage() {
  return <>
    <h1 className="display text-3xl">Política de privacidad</h1>
    <p className="text-soft">Versión {LEGAL_VERSION} · Proyecto académico Compa</p>
    <p>Compa es un prototipo universitario de inteligencia competitiva para empresas. Esta política explica qué datos trata, para qué y cómo ejercer tus derechos, conforme a la Ley N.° 29733 y su reglamento (D.S. N.° 016-2024-JUS).</p>

    <h2>Qué datos tratamos y para qué</h2>
    <ul>
      <li><strong>Cuenta:</strong> nombre, correo y contraseña cifrada, para autenticarte.</li>
      <li><strong>Empresa:</strong> razón social, RUC, rubro, país, catálogo y precios, para prestar el servicio.</li>
      <li><strong>Compras:</strong> nombre, correo, celular, DNI o RUC, plan e importe, para gestionar el pago y el comprobante. Compa no recibe ni guarda los datos de tu tarjeta: los ingresas directamente en el formulario de Culqi.</li>
      <li><strong>Análisis:</strong> reportes, notas y documentos que subas, para generar y conservar tus análisis.</li>
      <li><strong>Sesión:</strong> una cookie técnica para mantener tu sesión. No usamos cookies publicitarias.</li>
      <li><strong>Actividad de la cuenta:</strong> fecha, tipo de evento, usuario e IP de los accesos y acciones sensibles (cambios de datos, pagos, reembolsos, importaciones), para proteger la cuenta y que detectes accesos que no reconoces. Nunca registramos contraseñas ni códigos.</li>
      <li><strong>Libro de Reclamaciones:</strong> nombre, documento, domicilio, teléfono y correo de quien registra una hoja, y su detalle, para atenderla conforme al Código de Protección y Defensa del Consumidor.</li>
      <li><strong>Referidos:</strong> qué empresa invitó a otra y si la recompensa se otorgó, para aplicar el programa.</li>
    </ul>
    <p>No vendemos tus datos ni los usamos con otra finalidad. Solo pedimos lo necesario para cada función.</p>

    <h2>Uso de inteligencia artificial</h2>
    <p>Para investigar el mercado y redactar reportes, Compa envía a su proveedor de modelos de lenguaje los datos del producto o empresa analizados, las notas y los documentos que tú incluyas. Tu nombre, correo y datos de pago no forman parte de esas consultas. Compa retira correos, celulares y DNI identificables de las notas escritas antes de enviarlas, pero no puede hacerlo dentro de un PDF: no subas documentos con datos personales.</p>
    <p>Los reportes son generados por un sistema de IA, se identifican como tales y deben ser revisados por una persona antes de tomar decisiones. Compa no toma decisiones automatizadas sobre personas.</p>

    <h2>Con quién se comparten</h2>
    <ul>
      <li><strong>Anthropic (Estados Unidos):</strong> proveedor del modelo de lenguaje y de la búsqueda web. Implica un flujo transfronterizo de datos.</li>
      <li><strong>Culqi (Perú):</strong> procesamiento de los pagos en modo de prueba.</li>
      <li><strong>Proveedor de alojamiento:</strong> servidor donde funciona la plataforma.</li>
    </ul>

    <h2>Conservación</h2>
    <p>Conservamos tus datos mientras tu cuenta esté activa. Al eliminarla se borran tus datos personales y, si eres el único usuario de la empresa, su catálogo y análisis. Los comprobantes y notas de crédito se conservan durante el plazo que exigen las normas tributarias. El registro de actividad se conserva un año y las hojas de reclamación, al menos dos años, como exige su reglamento.</p>

    <h2>Tus derechos</h2>
    <p>Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su tratamiento. Desde <strong>Mi cuenta</strong> puedes corregirlos, descargar una copia y eliminar tu cuenta. Para otra solicitud, contacta al administrador que te dio acceso. También puedes acudir a la Autoridad Nacional de Protección de Datos Personales.</p>

    <h2>Seguridad</h2>
    <p>Aplicamos conexión cifrada, contraseñas con función de resumen, verificación en dos pasos opcional, límites de intentos, separación de datos por empresa y tokenización de pagos a través de la pasarela.</p>
  </>;
}
