import { providerHttpError } from '../../core/security/providerError.js'
import { fetchWithRetry } from '../../helpers/fetchWithRetry.js'
import type { AiMessageResponse, AiProvider } from './provider.js'

export function createAnthropicProvider(apiKey: string): AiProvider {
  return {
    id: 'anthropic',
    capabilities: ['rewriteMetadata', 'optimizeContent', 'contentBrief', 'altText'],
    requestMessage: (request) => requestAnthropicMessage(apiKey, request),
  }
}

/** Anthropic transport boundary; authorization and content selection stay in endpoints. */
export async function requestAnthropicMessage(
  apiKey: string,
  request: Record<string, unknown>,
): Promise<AiMessageResponse> {
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
  return response.json() as Promise<AiMessageResponse>
}
