import type { HelmetOptions } from 'helmet';

const API_CSP = {
  useDefaults: false,
  directives: {
    defaultSrc: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
    frameAncestors: ["'none'"],
  },
};

/**
 * The API only serves JSON, so it gets the strictest CSP. Outside production
 * the CSP is off so the Swagger UI can load its scripts and styles.
 */
export function buildHelmetOptions(isProduction: boolean): HelmetOptions {
  return {
    contentSecurityPolicy: isProduction ? API_CSP : false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
  };
}
