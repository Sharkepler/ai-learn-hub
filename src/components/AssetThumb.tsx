import { useState } from "react";
import { findCatalogItem } from "../lib/assetCatalog";

// 已失败的远程图片 URL 缓存：避免每次渲染反复重试造成闪烁。
const FAIL = new Map<string, true>();

// 资产缩略图：
//  - 优先显示「用户上传的实物照片」或「目录远程照片」
//  - 照片加载成功前/失败后用 emoji 图标垫底（永不出现破图）
//  - emoji 图标零网络、离线可用；远程照片走浏览器 HTTP 缓存
export default function AssetThumb({
  asset,
  size = 48,
  className = "",
}: {
  asset: { categoryId?: string; itemId?: string; name?: string; photo?: string };
  size?: number;
  className?: string;
}) {
  const cat = findCatalogItem(asset.categoryId, asset.itemId);
  const photo = asset.photo || cat?.image;
  const [loaded, setLoaded] = useState(false);
  const failed = photo ? !!FAIL.get(photo) : false;
  const emoji = cat?.emoji || (asset.photo ? "🖼️" : "📦");

  return (
    <div
      className={
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 " +
        className
      }
      style={{ width: size, height: size }}
    >
      <span style={{ fontSize: size * 0.5, lineHeight: 1 }} aria-hidden>
        {emoji}
      </span>
      {photo && !failed && (
        <img
          src={photo}
          alt={asset.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            FAIL.set(photo, true);
            setLoaded(false);
          }}
          className={
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-200 " +
            (loaded ? "opacity-100" : "opacity-0")
          }
        />
      )}
    </div>
  );
}
