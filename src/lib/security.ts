type ValidationResult = { valid: boolean; errors: string[]; sanitized: string };

const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<style[^>]*>.*?<\/style>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi
];

const SUSPICIOUS_PATTERNS = [
  /union\s+select/i,
  /drop\s+table/i,
  /insert\s+into/i,
  /delete\s+from/i,
  /exec\s*\(/i,
  /<script/i,
  /eval\s*\(/i,
  /document\./i,
  /<img[^>]*on\w+\s*=/i
];

export function sanitizeInput(input: string): string {
  if (!input) return "";
  let sanitized = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  return sanitized.trim();
}

export function validateMessage(message: string): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], sanitized: "" };
  if (!message || !message.trim()) {
    result.valid = false;
    result.errors.push("Message is empty");
    return result;
  }
  if (message.length > 2000) {
    result.valid = false;
    result.errors.push("Message is too long (max 2000 characters)");
    return result;
  }
  const sanitized = sanitizeInput(message);
  if (!sanitized) {
    result.valid = false;
    result.errors.push("Invalid message content");
    return result;
  }
  result.sanitized = sanitized;
  return result;
}

export function detectSuspiciousPatterns(message: string): string[] {
  const hits: string[] = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(message)) {
      hits.push("Suspicious pattern detected");
      break;
    }
  }
  const specialChars = (message.match(/[<>"'()\[\]{}]/g) || []).length;
  if (specialChars > message.length * 0.3) {
    hits.push("Excessive special characters");
  }
  if (/(.)\1{10,}/.test(message)) {
    hits.push("Suspicious repetition");
  }
  return hits;
}

export function validateJsonPayload(
  data: unknown,
  requiredFields: string[],
  allowedFields?: string[]
): { valid: boolean; errors: string[] } {
  const result = { valid: true, errors: [] as string[] };
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["Invalid JSON structure"] };
  }
  const payload = data as Record<string, unknown>;
  for (const field of requiredFields) {
    if (!(field in payload)) {
      result.valid = false;
      result.errors.push(`Missing required field: ${field}`);
    }
  }
  if (allowedFields && allowedFields.length) {
    const extras = Object.keys(payload).filter((key) => !allowedFields.includes(key));
    if (extras.length) {
      result.valid = false;
      result.errors.push(`Unexpected fields: ${extras.slice(0, 5).join(", ")}`);
    }
  }
  return result;
}
