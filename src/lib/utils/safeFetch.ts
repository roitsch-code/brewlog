import { promises as dns } from "node:dns";
import net from "node:net";

/**
 * Block private, loopback, link-local, and metadata-service IPv4/IPv6 ranges
 * so user-supplied URLs can't be used to probe internal infrastructure.
 */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("fe80")) return true; // link-local
    // IPv4-mapped (::ffff:x.x.x.x)
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.slice(7);
      if (net.isIPv4(v4)) return isPrivateIp(v4);
    }
    return false;
  }
  return false;
}

export interface SafeUrlCheck {
  ok: boolean;
  error?: string;
}

/**
 * Validate that a URL is https:// and points to a public host.
 * Resolves DNS and rejects anything in a private/loopback/link-local range.
 */
export async function assertSafeHttpsUrl(rawUrl: string): Promise<SafeUrlCheck> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only https:// URLs are supported" };
  }

  const hostname = parsed.hostname;

  // Reject literal IPs in private ranges outright (skips DNS)
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    return { ok: false, error: "URL resolves to a private address" };
  }

  // Reject obvious local names that bypass DNS resolution
  const lowered = hostname.toLowerCase();
  if (
    lowered === "localhost" ||
    lowered.endsWith(".localhost") ||
    lowered.endsWith(".local") ||
    lowered.endsWith(".internal")
  ) {
    return { ok: false, error: "URL resolves to a private address" };
  }

  if (!net.isIP(hostname)) {
    try {
      const addrs = await dns.lookup(hostname, { all: true });
      if (addrs.length === 0) {
        return { ok: false, error: "Could not resolve host" };
      }
      if (addrs.some((a) => isPrivateIp(a.address))) {
        return { ok: false, error: "URL resolves to a private address" };
      }
    } catch {
      return { ok: false, error: "Could not resolve host" };
    }
  }

  return { ok: true };
}
