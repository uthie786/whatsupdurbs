export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** Identify an image by its first bytes, whatever the sender claims it is. */
export function sniffImageType(buf: Uint8Array): ImageType | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length > 8 && png.every((b, i) => buf[i] === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(buf.subarray(from, to)));
  if (buf.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
