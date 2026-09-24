export const MEU_PLUGGY_CONNECTOR_ID = 200;

export function isMeuPluggyItem(item: { connector?: { id?: number } | null }): boolean {
  return item.connector?.id === MEU_PLUGGY_CONNECTOR_ID;
}
