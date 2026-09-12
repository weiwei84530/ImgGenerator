import { saveMedia } from './db';

export async function importPhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('請選擇 JPG、PNG 或 WebP 照片。HEIC 請先轉為 JPG。');
  if (file.size > 15 * 1024 * 1024) throw new Error('每張照片需小於 15 MB，請先縮小照片。');
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        image.naturalWidth * image.naturalHeight <= 50_000_000
          ? resolve()
          : reject(new Error('照片像素太大，請先縮小照片。'));
      image.onerror = () => reject(new Error('這張照片無法讀取，請改用 JPG 或 PNG。'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  return saveMedia({ id: crypto.randomUUID(), blob: file, name: file.name });
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
