// ==============================================================================
// BEEEJOY SVG Security Validator & Sanitizer
// Strictly validates, sanitizes, and strips malicious elements from SVGs.
// ==============================================================================

const MAX_SVG_SIZE = 2 * 1024 * 1024; // 2MB max

export interface SvgValidationResult {
  valid: boolean;
  error?: string;
  sanitizedSvg?: string;
}

/**
 * Validates and sanitizes SVG content.
 * Rejects scripts, event handlers, foreignObject, javascript: URIs,
 * external network resource calls, and nested executable objects.
 */
export function sanitizeSvg(svgContent: string): SvgValidationResult {
  if (!svgContent || typeof svgContent !== "string") {
    return { valid: false, error: "Empty or invalid SVG content." };
  }

  // 1. Size check
  if (Buffer.byteLength(svgContent, "utf8") > MAX_SVG_SIZE) {
    return { valid: false, error: "SVG file exceeds the 2MB size limit." };
  }

  // Trim and check basic SVG tags
  const trimmed = svgContent.trim();
  const lower = trimmed.toLowerCase();

  if (!lower.includes("<svg") || !lower.includes("</svg>")) {
    return { valid: false, error: "Content is not a valid SVG document." };
  }

  // 2. Reject explicitly dangerous tags
  const forbiddenTags = [
    "<script",
    "</script",
    "<foreignobject",
    "</foreignobject",
    "<iframe",
    "</iframe",
    "<object",
    "</object",
    "<embed",
    "</embed",
    "<applet",
    "</applet",
    "<meta",
    "<link",
    "<base",
    "<!entity",
    "<!doctype",
  ];

  for (const tag of forbiddenTags) {
    if (lower.includes(tag)) {
      return {
        valid: false,
        error: `Security violation: SVG contains disallowed element "${tag.replace(/[<>/]/g, "")}".`,
      };
    }
  }

  // 3. Reject event handlers (onload, onerror, onclick, etc.)
  const eventHandlerRegex = /\son[a-z]+\s*=/i;
  if (eventHandlerRegex.test(trimmed)) {
    return {
      valid: false,
      error: "Security violation: SVG contains inline event handlers (on* attributes).",
    };
  }

  // 4. Reject javascript:, vbscript:, and data:text/html URI schemes
  const dangerousUriRegex = /(href|src|xlink:href)\s*=\s*["']?\s*(javascript|vbscript|data:text\/html)/i;
  if (dangerousUriRegex.test(trimmed)) {
    return {
      valid: false,
      error: "Security violation: SVG contains executable script URIs.",
    };
  }

  // 5. Reject external resource imports in <use> tags
  // Local fragment identifiers like href="#my-icon" are permitted; external http/https/ftp are blocked
  const externalUseRegex = /<use[^>]*(href|xlink:href)\s*=\s*["']\s*(https?:|\/\/)/i;
  if (externalUseRegex.test(trimmed)) {
    return {
      valid: false,
      error: "Security violation: External resource references in <use> tags are not allowed.",
    };
  }

  // 6. Reject external CSS @import statements
  if (/@import\s+/i.test(trimmed)) {
    return {
      valid: false,
      error: "Security violation: External @import rules in SVG styles are not allowed.",
    };
  }

  // 7. Remove any XML comments to prevent obfuscation
  let cleaned = trimmed.replace(/<!--[\s\S]*?-->/g, "");

  // Ensure root <svg> is present
  const svgStartIndex = cleaned.toLowerCase().indexOf("<svg");
  if (svgStartIndex === -1) {
    return { valid: false, error: "Malformed SVG root." };
  }

  cleaned = cleaned.substring(svgStartIndex);

  return {
    valid: true,
    sanitizedSvg: cleaned,
  };
}
