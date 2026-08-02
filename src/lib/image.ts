// 把用户上传的图片压缩为较小的 base64，便于：
//  1) 直接存进加密的本地 blob 与 assets.json 云端（控制体积，避免单文件爆 GitHub 1MB 上限）
//  2) 离线也能即时显示（从本地读取，无需再次联网）
//
// 浏览器端可用（依赖 Image / canvas / document），符合本项目纯前端架构。

export async function fileToResizedDataURL(
  file: File,
  maxW = 240,
  quality = 0.82,
  maxBytes = 130000
): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });

  // 小图直接返回，省去解码开销
  if (original.length <= maxBytes) return original;

  const img = new Image();
  img.src = original;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  if (!img.width) return original;

  let { width, height } = img;
  if (width > maxW) {
    height = Math.round((height * maxW) / width);
    width = maxW;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, width, height);

  let out = canvas.toDataURL("image/jpeg", quality);
  let q = quality;
  // 仍超限则逐步降质，直至满足或触底
  while (out.length > maxBytes && q > 0.4) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}
