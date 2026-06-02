// Shared PostHog server-side capture for AI/LLM observability.
// Posts $ai_generation events to PostHog's EU /capture endpoint so they show
// up in PostHog's LLM Observability product.

const POSTHOG_KEY = "phc_CPtsdMVYmduf4Uk92SPeCwXgUyxieWp5GvrqcDDzRUNz";
const POSTHOG_HOST = "https://eu.i.posthog.com";

interface AiGenerationEvent {
  distinctId?: string | null;
  model: string;
  provider?: string;
  latencyMs: number;
  httpStatus: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  isError?: boolean;
  errorMessage?: string;
  traceId?: string;
  feature: string; // e.g. "analyse-vehicle" | "generate-advert"
  extra?: Record<string, unknown>;
}

export async function capturePosthogAiGeneration(evt: AiGenerationEvent): Promise<void> {
  try {
    const properties: Record<string, unknown> = {
      $ai_provider: evt.provider ?? "lovable-ai-gateway",
      $ai_model: evt.model,
      $ai_latency: evt.latencyMs / 1000, // seconds (PostHog convention)
      $ai_http_status: evt.httpStatus,
      $ai_is_error: !!evt.isError,
      $ai_trace_id: evt.traceId ?? crypto.randomUUID(),
      feature: evt.feature,
      ...(evt.inputTokens !== undefined ? { $ai_input_tokens: evt.inputTokens } : {}),
      ...(evt.outputTokens !== undefined ? { $ai_output_tokens: evt.outputTokens } : {}),
      ...(evt.totalTokens !== undefined ? { $ai_total_tokens: evt.totalTokens } : {}),
      ...(evt.errorMessage ? { $ai_error: evt.errorMessage } : {}),
      ...(evt.extra ?? {}),
    };

    await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: "$ai_generation",
        distinct_id: evt.distinctId || `server:${evt.feature}`,
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[posthog] capture failed", e);
  }
}
