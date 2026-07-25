/**
 * FNV-1a 32-bit hash → short hex string. Used to fingerprint resume-check
 * findings for localStorage dismissal without persisting any resume content:
 * we store a hash of the offending value, never the value itself.
 */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619, kept in 32-bit unsigned range
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
