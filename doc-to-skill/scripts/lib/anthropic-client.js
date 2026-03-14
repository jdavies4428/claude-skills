const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20251022';

function normalizeTextFromContent(content) {
  return (content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export function createAnthropicClient(options = {}) {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY. Copy .env.example to .env and export your Anthropic credentials.');
  }

  return {
    model,
    async createMessage(request) {
      const response = await fetchImpl(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 4000,
          system: request.system,
          messages: request.messages,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Anthropic request failed (${response.status}): ${JSON.stringify(data?.error ?? data)}`);
      }

      const text = normalizeTextFromContent(data.content);
      if (!text) {
        throw new Error(`Anthropic response did not include text content: ${JSON.stringify(data)}`);
      }

      return text;
    },
  };
}
