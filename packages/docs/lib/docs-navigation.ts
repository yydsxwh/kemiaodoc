/**
 * 默认用浏览器跳转；Next / React Router 宿主可注入自己的 navigate。
 */

export type DocsNavigate = (href: string) => void;

let navigateImpl: DocsNavigate = (href) => {
  if (typeof window !== "undefined") {
    window.location.assign(href);
  }
};

export function setDocsNavigate(fn: DocsNavigate): void {
  navigateImpl = fn;
}

export function docsNavigate(href: string): void {
  navigateImpl(href);
}
