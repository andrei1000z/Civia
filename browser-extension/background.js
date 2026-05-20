/**
 * Civia Lens — background service worker (Manifest V3).
 *
 * Înregistrează context menu „Sesizează pe Civia" pe imagini.
 * La click: deschide tab nou cu /sesizari pre-completed cu URL-ul imaginii.
 */

const CIVIA_BASE = "https://civia.ro";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "civia-sesizeaza",
    title: "Sesizează pe Civia",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "civia-sesizeaza") return;
  const imgUrl = info.srcUrl;
  const pageUrl = tab?.url || info.pageUrl || "";
  const url = new URL(`${CIVIA_BASE}/sesizari`);
  url.searchParams.set("from", "lens");
  if (imgUrl) url.searchParams.set("img", imgUrl);
  if (pageUrl) url.searchParams.set("ref", pageUrl);
  chrome.tabs.create({ url: url.toString() });
});
