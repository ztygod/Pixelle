export function getPreviewFrameLabel(url: string) {
  return url.replace(/^https?:\/\//, "");
}
