// The OBS package embeds media so WebGL textures and audio analysis work without a web server.
const embeddedAssets = import.meta.env?.VOXFLARE_ASSETS as Record<string, string> | undefined;

export function assetUrl(path: string): string {
  return embeddedAssets?.[path] ?? `${import.meta.env?.BASE_URL ?? './'}${path}`;
}
