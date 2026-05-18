const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
]);

export function getImagePreviewLabel(path: string): string {
  const lowerPath = path.toLowerCase();
  const isSupported = Array.from(SUPPORTED_IMAGE_EXTENSIONS).some((extension) =>
    lowerPath.endsWith(extension),
  );

  if (!isSupported) {
    return "Unsupported image extension";
  }

  return "Preview unavailable in this terminal; showing local path";
}
