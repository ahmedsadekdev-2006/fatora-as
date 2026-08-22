export const supportedSyncEntities = ["customer", "product", "expense", "payment", "stockMovement", "invoice", "todo"] as const;
export function isSupportedSyncEntity(entity: unknown): entity is typeof supportedSyncEntities[number] { return typeof entity === "string" && (supportedSyncEntities as readonly string[]).includes(entity); }

export function shouldRejectStaleUpdate(localUpdatedAt: number | string | undefined, remoteUpdatedAt: Date | number | string | undefined) {
  if (!localUpdatedAt || !remoteUpdatedAt) return false;
  return new Date(remoteUpdatedAt).getTime() > new Date(localUpdatedAt).getTime();
}
