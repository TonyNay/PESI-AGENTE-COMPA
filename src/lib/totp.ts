import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_MS = 30_000;

/** Llave de 32 bytes en Base64, fuera de la base de datos (COMPA_TOTP_KEY). */
function encryptionKey(): Buffer | null {
  const key = Buffer.from(process.env.COMPA_TOTP_KEY ?? "", "base64");
  return key.length === 32 ? key : null;
}
export const totpEncryptionReady = () => encryptionKey() !== null;

/** AES-256-GCM ligado al usuario: un valor copiado a otra fila no se puede descifrar. */
export function sealSecret(secret: string, userId: number): string {
  const key = encryptionKey();
  if (!key) throw new Error("COMPA_TOTP_KEY no está configurada");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv).setAAD(Buffer.from(String(userId)));
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Devuelve null si la llave cambió o el valor fue alterado. */
export function openSecret(sealed: string, userId: number): string | null {
  const key = encryptionKey();
  const [version, iv, tag, data] = sealed.split(":");
  if (!key || version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64")).setAAD(Buffer.from(String(userId)));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch { return null; }
}

export function base32Encode(data: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of data) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
    value &= (1 << bits) - 1;
  }
  return bits > 0 ? out + ALPHABET[(value << (5 - bits)) & 31] : out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of text.toUpperCase().replace(/=+$/, "")) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Base32 inválido");
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; value &= (1 << bits) - 1; }
  }
  return Buffer.from(out);
}

/** Código RFC 6238 (HMAC-SHA1, 30 s) para un intervalo dado. */
export function totpCode(secret: Buffer, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = crypto.createHmac("sha1", secret).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, "0");
}

export const totpStep = (now: number) => Math.floor(now / PERIOD_MS);

/** Tolera un intervalo de desfase de reloj y rechaza intervalos ya usados. Devuelve el intervalo aceptado o null. */
export function matchTotp(secretBase32: string, code: string, lastStep: number | null, now: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const given = Buffer.from(code);
  const current = totpStep(now);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    if (crypto.timingSafeEqual(given, Buffer.from(totpCode(secret, step)))) return step;
  }
  return null;
}
