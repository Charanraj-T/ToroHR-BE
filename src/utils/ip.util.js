const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const CIDR_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

const ipToLong = (ip) => {
  const match = ip.trim().match(IPV4_REGEX);
  if (!match) return null;
  const octets = [match[1], match[2], match[3], match[4]].map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return null;
  return ((octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0;
};

export const isCidrValid = (cidr) => {
  const match = cidr.trim().match(CIDR_REGEX);
  if (!match) return false;
  const prefix = parseInt(match[5], 10);
  if (prefix < 0 || prefix > 32) return false;
  const ip = [match[1], match[2], match[3], match[4]].map(Number);
  return ip.every((o) => o >= 0 && o <= 255);
};

const cidrToRange = (cidr) => {
  const match = cidr.trim().match(CIDR_REGEX);
  if (!match) return null;
  const ipLong = ipToLong(match.slice(1, 5).join("."));
  if (ipLong === null) return null;
  const bits = parseInt(match[5], 10);
  const mask = bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0;
  const start = ipLong & mask;
  const end = start + (2 ** (32 - bits) - 1);
  return { start, end };
};

export const matchesCidr = (ip, cidr) => {
  const cleanIp = ip.includes("::ffff:") ? ip.split("::ffff:")[1] : ip;
  const ipLong = ipToLong(cleanIp);
  if (ipLong === null) return false;
  const range = cidrToRange(cidr);
  if (!range) return false;
  return ipLong >= range.start && ipLong <= range.end;
};

export const isIpWhitelisted = (ip, allowedRanges) => {
  if (!allowedRanges || allowedRanges.length === 0) return false;
  return allowedRanges.some((range) => matchesCidr(ip, range));
};
