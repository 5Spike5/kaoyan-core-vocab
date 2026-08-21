export function nowTimestamp() {
  return Date.now()
}

export function toIsoString(value: Date | number | string) {
  return new Date(value).toISOString()
}
