function joinUrl(baseUrl, path) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, '');

  return `${normalizedBase}${normalizedPath}`;
}

export function resolveAssetUrl(path) {
  if (!path) {
    return '';
  }

  if (/^(https?:|data:|blob:)/.test(path)) {
    return path;
  }

  const normalizedPath = path.replace(/^r2:\/\//, '').replace(/^\/+/, '');
  const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL;

  if (r2PublicUrl) {
    return joinUrl(r2PublicUrl, normalizedPath);
  }

  const baseUrl = import.meta.env.BASE_URL || '/';

  return joinUrl(baseUrl, normalizedPath);
}
