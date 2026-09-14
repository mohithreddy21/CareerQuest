import type http from 'node:http';
import type https from 'node:https';
import type dns from 'node:dns';
import type net from 'node:net';

function getNodeModule<T>(name: string): T {
  // eslint-disable-next-line no-eval
  return eval('require')(name) as T;
}

const nodeHttp =
  typeof window === 'undefined' ? getNodeModule<typeof http>('node:http') : ({} as typeof http);
const nodeHttps =
  typeof window === 'undefined' ? getNodeModule<typeof https>('node:https') : ({} as typeof https);
const nodeDns =
  typeof window === 'undefined' ? getNodeModule<typeof dns>('node:dns') : ({} as typeof dns);
const nodeNet =
  typeof window === 'undefined' ? getNodeModule<typeof net>('node:net') : ({} as typeof net);

export type ServerJobFetcherErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_SCHEME'
  | 'SSRF_TARGET_FORBIDDEN'
  | 'DNS_RESOLUTION_FAILED'
  | 'FETCH_TIMEOUT'
  | 'FETCH_FAILED'
  | 'REDIRECT_LIMIT_EXCEEDED'
  | 'RESPONSE_TOO_LARGE';

export class ServerJobFetcherError extends Error {
  readonly code: ServerJobFetcherErrorCode;
  readonly internalDetails?: string;

  constructor(code: ServerJobFetcherErrorCode, clientMessage: string, internalDetails?: string) {
    super(clientMessage);
    this.name = 'ServerJobFetcherError';
    this.code = code;
    this.internalDetails = internalDetails;
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  allowHttpForTesting?: boolean;
  dnsLookupFn?: (hostname: string) => Promise<{ address: string; family: number }[]>;
}

export interface FetchResult {
  finalUrl: string;
  status: number;
  statusText: string;
  contentType: string | null;
  contentLength: number | null;
  body: string;
  redirectCount: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254'
]);

/**
 * Validates whether an IPv4 address is in a private, loopback, link-local,
 * multicast, or reserved range.
 */
export function isPrivateOrRestrictedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // Invalid format treated as restricted
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (b0 === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (Link-local / Cloud metadata 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (b0 === 192 && b1 === 168) return true;

  // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (Reserved: 240.0.0.0 - 255.255.255.254)
  if (b0 >= 240) return true;

  return false;
}

/**
 * Validates whether an IPv6 address is loopback, unique local, link-local,
 * multicast, or an IPv4-mapped private address.
 */
export function isPrivateOrRestrictedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::1 (Loopback)
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // :: (Unspecified)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // fe80::/10 (Link-local: fe80: to febf:)
  if (/^fe[89ab]/i.test(normalized)) return true;

  // fc00::/7 (Unique Local Address: fc00: to fdff:)
  if (/^f[cd]/i.test(normalized)) return true;

  // ff00::/8 (Multicast: ff00: to ffff:)
  if (/^ff/i.test(normalized)) return true;

  // IPv4-mapped IPv6 address: ::ffff:a.b.c.d
  const ipv4MappedMatch = normalized.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (ipv4MappedMatch && ipv4MappedMatch[1]) {
    return isPrivateOrRestrictedIPv4(ipv4MappedMatch[1]);
  }

  return false;
}

/**
 * Checks if an IP address (IPv4 or IPv6) is in a forbidden internal or reserved range.
 */
export function isPrivateOrRestrictedIP(ip: string): boolean {
  const family = nodeNet.isIP(ip);
  if (family === 4) {
    return isPrivateOrRestrictedIPv4(ip);
  }
  if (family === 6) {
    return isPrivateOrRestrictedIPv6(ip);
  }
  return true; // Non-IP or invalid string treated as restricted
}

/**
 * Safely parses and validates the URL scheme.
 */
function validateUrl(urlString: string, allowHttpForTesting: boolean): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new ServerJobFetcherError(
      'INVALID_URL',
      'The provided job URL is not a valid absolute URL.'
    );
  }

  const scheme = parsed.protocol.toLowerCase();

  if (scheme === 'https:') {
    return parsed;
  }

  if (scheme === 'http:') {
    if (allowHttpForTesting) {
      return parsed;
    }
    throw new ServerJobFetcherError(
      'UNSUPPORTED_SCHEME',
      'Insecure HTTP is not supported for public job imports. Please use HTTPS.'
    );
  }

  throw new ServerJobFetcherError(
    'UNSUPPORTED_SCHEME',
    `Unsupported URL scheme: ${scheme}. Only HTTPS is permitted.`
  );
}

/**
 * Resolves hostname and verifies every resolved IP address against the SSRF blocklist.
 * Returns a chosen validated IP and family for connection pinning.
 */
async function resolveAndValidateHost(
  hostname: string,
  customLookupFn?: (h: string) => Promise<{ address: string; family: number }[]>,
  allowHttpForTesting = false
): Promise<{ address: string; family: number }> {
  const lowerHost = hostname.toLowerCase();

  // Check blocked hostname keywords
  if (BLOCKED_HOSTNAMES.has(lowerHost)) {
    if (!allowHttpForTesting || lowerHost !== 'localhost') {
      throw new ServerJobFetcherError(
        'SSRF_TARGET_FORBIDDEN',
        'Access to the requested host is forbidden for security reasons.'
      );
    }
  }

  // Direct IP literal check
  if (nodeNet.isIP(hostname)) {
    if (isPrivateOrRestrictedIP(hostname)) {
      if (!allowHttpForTesting || hostname !== '127.0.0.1') {
        throw new ServerJobFetcherError(
          'SSRF_TARGET_FORBIDDEN',
          'Access to the requested IP address is forbidden for security reasons.'
        );
      }
    }
    return { address: hostname, family: nodeNet.isIP(hostname) };
  }

  // DNS resolution
  let addresses: { address: string; family: number }[];
  try {
    if (customLookupFn) {
      addresses = await customLookupFn(hostname);
    } else {
      addresses = await nodeDns.promises.lookup(hostname, { all: true });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ServerJobFetcherError(
      'DNS_RESOLUTION_FAILED',
      'Unable to resolve the domain name for the requested job posting.',
      msg
    );
  }

  if (!addresses || addresses.length === 0) {
    throw new ServerJobFetcherError(
      'DNS_RESOLUTION_FAILED',
      'No IP addresses were found for the requested domain name.'
    );
  }

  // Every resolved IP address MUST pass the restricted IP filter!
  for (const record of addresses) {
    if (isPrivateOrRestrictedIP(record.address)) {
      if (!allowHttpForTesting || record.address !== '127.0.0.1') {
        throw new ServerJobFetcherError(
          'SSRF_TARGET_FORBIDDEN',
          'Access to the requested host is forbidden for security reasons.',
          `Host ${hostname} resolved to restricted address ${record.address}`
        );
      }
    }
  }

  // Pin to the first validated address
  return addresses[0];
}

/**
 * Executes an HTTP/HTTPS request pinned directly to the pre-validated IP.
 * Uses a custom lookup function in Agent to ensure zero DNS rebinding window.
 */
function executePinnedRequest(
  parsedUrl: URL,
  pinnedTarget: { address: string; family: number },
  timeoutMs: number,
  maxBytes: number
): Promise<{
  statusCode: number;
  statusMessage?: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? nodeHttps : nodeHttp;

    // Custom agent with socket lookup pinned to the validated IP
    // This guarantees that DNS rebinding attacks cannot redirect the connection to a private IP!
    const agent = new transport.Agent({
      lookup: (_hostname, _options, callback) => {
        callback(null, pinnedTarget.address, pinnedTarget.family);
      }
    });

    const port = parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : isHttps ? 443 : 80;

    const requestOptions: https.RequestOptions = {
      method: 'GET',
      hostname: parsedUrl.hostname,
      port,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      agent,
      headers: {
        'User-Agent': 'CareerQuest-JobDiscovery/1.0 (+https://careerquest.workspace)',
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'close'
      },
      // For HTTPS: servername ensures SNI and certificate hostname matching work correctly
      ...(isHttps ? { servername: parsedUrl.hostname } : {})
    };

    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      req.destroy();
      if (!settled) {
        settled = true;
        agent.destroy();
        reject(
          new ServerJobFetcherError(
            'FETCH_TIMEOUT',
            `The request timed out after ${timeoutMs / 1000} seconds.`
          )
        );
      }
    }, timeoutMs);

    const req = transport.request(requestOptions, (res) => {
      const contentLengthHeader = res.headers['content-length'];
      if (contentLengthHeader) {
        const declaredLength = Number.parseInt(contentLengthHeader, 10);
        if (!Number.isNaN(declaredLength) && declaredLength > maxBytes) {
          clearTimeout(timer);
          req.destroy();
          agent.destroy();
          if (!settled) {
            settled = true;
            reject(
              new ServerJobFetcherError(
                'RESPONSE_TOO_LARGE',
                `The remote job posting exceeds the maximum allowed size (${Math.round(maxBytes / (1024 * 1024))}MB).`
              )
            );
          }
          return;
        }
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          clearTimeout(timer);
          req.destroy();
          agent.destroy();
          if (!settled) {
            settled = true;
            reject(
              new ServerJobFetcherError(
                'RESPONSE_TOO_LARGE',
                `The remote job posting exceeds the maximum allowed size (${Math.round(maxBytes / (1024 * 1024))}MB).`
              )
            );
          }
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        clearTimeout(timer);
        agent.destroy();
        if (!settled) {
          settled = true;
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve({
            statusCode: res.statusCode || 200,
            statusMessage: res.statusMessage,
            headers: res.headers,
            body
          });
        }
      });

      res.on('error', (err) => {
        clearTimeout(timer);
        agent.destroy();
        if (!settled) {
          settled = true;
          reject(
            new ServerJobFetcherError(
              'FETCH_FAILED',
              'Failed to read response body from the remote server.',
              err.message
            )
          );
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      agent.destroy();
      if (settled) return;
      settled = true;

      if (timedOut) {
        reject(
          new ServerJobFetcherError(
            'FETCH_TIMEOUT',
            `The request timed out after ${timeoutMs / 1000} seconds.`
          )
        );
      } else {
        reject(
          new ServerJobFetcherError(
            'FETCH_FAILED',
            'Failed to establish connection with the remote server.',
            err.message
          )
        );
      }
    });

    req.end();
  });
}

/**
 * Fetches the content of a remote job posting safely.
 */
export async function fetchServerJob(
  rawUrl: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const allowHttpForTesting = options.allowHttpForTesting ?? false;

  let currentUrl = rawUrl;
  let redirectCount = 0;

  while (true) {
    const parsedUrl = validateUrl(currentUrl, allowHttpForTesting);

    // Resolve and validate IP addresses for SSRF protection
    const resolvedAddress = await resolveAndValidateHost(
      parsedUrl.hostname,
      options.dnsLookupFn,
      allowHttpForTesting
    );

    // Perform the bounded, socket-pinned request
    const response = await executePinnedRequest(parsedUrl, resolvedAddress, timeoutMs, maxBytes);

    // Check for redirect
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new ServerJobFetcherError(
          'REDIRECT_LIMIT_EXCEEDED',
          'The URL exceeded the maximum allowed number of redirects (3).'
        );
      }

      const locationHeader = response.headers.location;
      if (!locationHeader) {
        throw new ServerJobFetcherError(
          'FETCH_FAILED',
          'Redirect response was received without a valid Location header.'
        );
      }

      // Resolve relative redirects against current URL
      try {
        currentUrl = new URL(locationHeader, currentUrl).toString();
      } catch {
        throw new ServerJobFetcherError('INVALID_URL', 'Redirect destination is not a valid URL.');
      }
      continue;
    }

    return {
      finalUrl: currentUrl,
      status: response.statusCode,
      statusText: response.statusMessage || '',
      contentType: response.headers['content-type'] || null,
      contentLength: response.headers['content-length']
        ? Number.parseInt(response.headers['content-length'], 10)
        : null,
      body: response.body,
      redirectCount
    };
  }
}

/**
 * ServerJobFetcher object wrapper for clean namespace usage.
 */
export const ServerJobFetcher = {
  fetch: fetchServerJob
};
