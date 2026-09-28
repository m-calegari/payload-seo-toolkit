export type AiCapability = 'rewriteMetadata' | 'optimizeContent' | 'contentBrief' | 'altText'

export interface AiMessageResponse {
  stop_reason?: string
  content?: Array<{ type: string; text?: string }>
}

/** Provider-neutral AI capability. It never receives Payload requests or performs authorization. */
export interface AiProvider {
  readonly id: string
  readonly capabilities: readonly AiCapability[]
  requestMessage(request: Record<string, unknown>): Promise<AiMessageResponse>
}
