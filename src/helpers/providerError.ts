/** Build a log-safe provider error without retaining an arbitrary response body. */
export function providerHttpError(provider: string, response: Response): Error {
  const requestId = response.headers.get('request-id') || response.headers.get('x-request-id')
  return new Error(
    `${provider} request failed: HTTP ${response.status}${requestId ? ` (request ${requestId})` : ''}`,
  )
}
