import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const ORTOPEDIA_UPLOAD_DIR = path.join("uploads", "ortopedia");
export const ORTOPEDIA_MAX_CERT_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const ALLOWED_EXT = new Set(["pdf", "jpg", "jpeg", "png"]);

export function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export function isAllowedCertificadoFile(file: File) {
  const mime = String(file.type || "").toLowerCase();
  const ext = path.extname(file.name || "").replace(".", "").toLowerCase();
  if (ALLOWED_MIME.has(mime)) return true;
  return ALLOWED_EXT.has(ext);
}

export function certificadoMimeFromPath(filePath: string) {
  const ext = path.extname(filePath).replace(".", "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export function buildCertificadoFileName(prestamoId: number, originalName?: string) {
  const extRaw = path.extname(originalName || "").replace(".", "").toLowerCase();
  const ext = ALLOWED_EXT.has(extRaw) ? extRaw : "pdf";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `prestamo_${prestamoId}_${stamp}.${ext}`;
}

export async function saveOrtopediaCertificado(prestamoId: number, file: File) {
  if (!isAllowedCertificadoFile(file)) {
    throw new Error("Formato no permitido. Solo PDF, PNG, JPG o JPEG");
  }
  if (file.size > ORTOPEDIA_MAX_CERT_BYTES) {
    throw new Error("El archivo supera el maximo permitido (10 MB)");
  }

  const folder = path.join(process.cwd(), ORTOPEDIA_UPLOAD_DIR);
  await mkdir(folder, { recursive: true });

  const fileName = buildCertificadoFileName(prestamoId, file.name);
  const absolutePath = path.join(folder, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  const relativePath = path.join(ORTOPEDIA_UPLOAD_DIR, fileName).replace(/\\/g, "/");
  const publicUrl = `/api/ortopedia/files/${encodeURIComponent(fileName)}`;

  return {
    relativePath,
    publicUrl,
    mimeType: String(file.type || certificadoMimeFromPath(fileName)),
    originalName: String(file.name || fileName),
    sizeBytes: file.size,
  };
}

export function resolveUploadAbsolutePath(storedPath: string) {
  const uploadsBase = path.resolve(process.cwd(), "uploads");
  const absFile = path.resolve(process.cwd(), storedPath.replace(/^\//, ""));
  if (!absFile.startsWith(uploadsBase)) {
    throw new Error("Ruta de certificado invalida");
  }
  return absFile;
}
