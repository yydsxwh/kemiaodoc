/**
 * 装扮列表的稳定视图。
 * 分类切换和点卡片都不能改这份源数组：调用方拿到的是副本。
 * 同一个 id 只保留第一次出现，避免「书廊午后」这类卡片被再画一遍。
 */
export function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const next: T[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
}
