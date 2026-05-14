/**
 * Descarca o imagine de la `url` ca JPEG pe device-ul user-ului.
 *
 * De ce e mai complicat decat un simplu <a download>:
 *  1. URL-urile Supabase sunt cross-origin → atributul `download` e ignorat
 *     si browser-ul navigheaza in tab nou in loc sa salveze.
 *  2. Civia uploadeaza webp pentru economie de bandwidth. User-ii (in special
 *     telefoanele) prefera .jpg fiindca galeria foto Android/iOS deschide
 *     mai usor jpg-urile (raportat 2026-05-14: „n-o vede in poze").
 *
 * Solutie: fetch → blob → <img> in memorie → canvas → JPEG blob → <a download>
 * pe object URL (same-origin garantat). Pe mobil salveaza in Photos/Downloads.
 *
 * Fallback: daca CORS-ul refuza fetch-ul sau canvas-ul devine „tainted",
 * deschide URL-ul in tab nou si user-ul face long-press → Save image.
 */
export async function downloadImageAsJpeg(url: string, baseName?: string): Promise<void> {
  const fallbackName =
    baseName ?? url.split("/").pop()?.split("?")[0]?.replace(/\.(webp|png|jpeg|jpg|avif|gif)$/i, "") ?? `civia-${Date.now()}`;
  const filename = `${fallbackName}.jpg`;

  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const srcBlob = await res.blob();

    // Daca e deja jpeg, sarim conversia.
    const isJpeg = srcBlob.type === "image/jpeg" || srcBlob.type === "image/jpg";
    let outBlob: Blob;

    if (isJpeg) {
      outBlob = srcBlob;
    } else {
      outBlob = await convertBlobToJpeg(srcBlob);
    }

    const objectUrl = URL.createObjectURL(outBlob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Chrome cleanup la 60s, dar revoke-uim noi pentru safety.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    // Fallback: tab nou, long-press → Save image
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function convertBlobToJpeg(srcBlob: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(srcBlob);
  try {
    const img = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    // Background alb pentru transparente — JPEG nu suporta alpha, default ar
    // fi negru, urat pe icoane PNG cu transparenta.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
        "image/jpeg",
        0.92,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}
