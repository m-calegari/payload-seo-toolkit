import { providerHttpError } from '../../core/security/providerError.js'
import { fetchWithRetry } from '../../helpers/fetchWithRetry.js'

export interface AnthropicMessageResponse {
  stop_reason?: string
  content?: Array<{ type: string; text?: string }>
}

/** Anthropic transport boundary; authorization and content selection stay in endpoints. */
export async function requestAnthropicMessage(
  apiKey: string,
  request: Record<string, unknown>,
): Promise<AnthropicMessageResponse> {
  const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw providerHttpError('Anthropic', response)
  return response.json() as Promise<AnthropicMessageResponse>
}
