/**
 * Request helper utilities for handling Express.js request parameters
 */

/**
 * Safely extract a string parameter from Express request params/query
 * Handles the case where the parameter might be an array
 */
export function getStringParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] || '';
  }
  return param || '';
}

/**
 * Safely extract an optional string parameter from Express request params/query
 * Returns undefined if not present
 */
export function getOptionalStringParam(
  param: string | string[] | undefined
): string | undefined {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
}
