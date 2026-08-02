// 资产目录：分类 → 物品。
// 每个物品自带 emoji 图标（零网络、离线可用、永不破图），可选远程照片（加载失败自动回退 emoji）。
// 不在目录里的物品走「自定义」流程，用户手填名称、可上传实物照片。

export interface CatalogItem {
  id: string;
  name: string;
  emoji: string;
  image?: string; // 可选远程照片 URL（best-effort，加载失败回退 emoji）
}

export interface CatalogCategory {
  id: string;
  name: string;
  emoji: string;
  items: CatalogItem[];
}

// 用 Wikimedia 的 Special:FilePath 直链作为 best-effort 产品照片；
// 命中即显示真实照片，404/失败则 AssetThumb 回退到 emoji 图标。
const WIKI = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;

export const ASSET_CATALOG: CatalogCategory[] = [
  {
    id: "phone",
    name: "手机",
    emoji: "📱",
    items: [
      { id: "xiaomi14", name: "小米 14", emoji: "📱", image: WIKI("Xiaomi_14.jpg") },
      { id: "iphone15", name: "iPhone 15", emoji: "📱", image: WIKI("IPhone_15_Pro.jpg") },
      { id: "mate60", name: "华为 Mate 60", emoji: "📱", image: WIKI("Huawei_Mate_60_Pro.jpg") },
      { id: "s24", name: "三星 S24", emoji: "📱", image: WIKI("Samsung_Galaxy_S24.jpg") },
    ],
  },
  {
    id: "computer",
    name: "电脑",
    emoji: "💻",
    items: [
      { id: "mbp", name: "MacBook Pro", emoji: "💻", image: WIKI("MacBook_Pro_14%22.jpg") },
      { id: "ipad", name: "iPad", emoji: "📟", image: WIKI("Apple_iPad_2021.jpg") },
      { id: "desktop", name: "台式机", emoji: "🖥️" },
      { id: "monitor", name: "显示器", emoji: "🖥️", image: WIKI("Computer_Display.jpg") },
    ],
  },
  {
    id: "audio",
    name: "耳机音频",
    emoji: "🎧",
    items: [
      { id: "airpods", name: "AirPods Pro", emoji: "🎧", image: WIKI("Apple_AirPods_Pro.jpg") },
      { id: "xm5", name: "索尼 WH-1000XM5", emoji: "🎧", image: WIKI("Sony_WH-1000XM5.jpg") },
      { id: "homepod", name: "智能音箱", emoji: "🔊" },
    ],
  },
  {
    id: "watch",
    name: "手表穿戴",
    emoji: "⌚",
    items: [
      { id: "applewatch", name: "Apple Watch", emoji: "⌚", image: WIKI("Apple_Watch_Series_9.jpg") },
      { id: "miwatch", name: "小米手环", emoji: "⌚" },
    ],
  },
  {
    id: "camera",
    name: "相机",
    emoji: "📷",
    items: [
      { id: "mirrorless", name: "微单相机", emoji: "📷", image: WIKI("Mirrorless_camera.jpg") },
      { id: "action", name: "运动相机", emoji: "📷" },
    ],
  },
  {
    id: "console",
    name: "游戏机",
    emoji: "🎮",
    items: [
      { id: "ps5", name: "PlayStation 5", emoji: "🎮", image: WIKI("PlayStation_5_and_DualSense.jpg") },
      { id: "switch", name: "Switch", emoji: "🎮", image: WIKI("Nintendo_Switch_OLED.jpg") },
      { id: "steamdeck", name: "Steam Deck", emoji: "🎮" },
    ],
  },
  {
    id: "home",
    name: "家电",
    emoji: "🔌",
    items: [
      { id: "robot", name: "扫地机器人", emoji: "🤖" },
      { id: "fryer", name: "空气炸锅", emoji: "🍳" },
      { id: "tv", name: "电视", emoji: "📺", image: WIKI("Flat_panel_TV.jpg") },
    ],
  },
  {
    id: "shoes",
    name: "鞋履",
    emoji: "👟",
    items: [
      { id: "run", name: "跑鞋", emoji: "👟" },
      { id: "basket", name: "篮球鞋", emoji: "👟" },
      { id: "boot", name: "靴子", emoji: "🥾" },
    ],
  },
  {
    id: "bag",
    name: "箱包服饰",
    emoji: "🎒",
    items: [
      { id: "backpack", name: "背包", emoji: "🎒" },
      { id: "coat", name: "外套", emoji: "🧥" },
      { id: "watchband", name: "表带", emoji: "⌚" },
    ],
  },
];

export function findCategory(id?: string): CatalogCategory | undefined {
  if (!id) return undefined;
  return ASSET_CATALOG.find((c) => c.id === id);
}

export function findCatalogItem(
  categoryId?: string,
  itemId?: string
): CatalogItem | undefined {
  const cat = findCategory(categoryId);
  if (!cat || !itemId) return undefined;
  return cat.items.find((i) => i.id === itemId);
}
