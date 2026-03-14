const DEFAULT_INTERVAL_MS = 5000;

export function getCloudflareBaseUrl(env = process.env) {
  if (!env.CF_ACCOUNT_ID) {
    throw new Error('Missing CF_ACCOUNT_ID. Copy .env.example to .env and export your Cloudflare credentials.');
  }

  if (!env.CF_API_TOKEN) {
    throw new Error('Missing CF_API_TOKEN. Copy .env.example to .env and export your Cloudflare credentials.');
  }

  return `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering`;
}

export function getCloudflareHeaders(env = process.env) {
  return {
    Authorization: `Bearer ${env.CF_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function unwrapResult(payload) {
  return payload?.result ?? payload;
}

async function readJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data?.errors ?? data?.messages ?? data;
    throw new Error(`Cloudflare request failed (${response.status}): ${JSON.stringify(detail)}`);
  }

  return data;
}

export async function initiateCrawl(payload, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? getCloudflareBaseUrl(options.env);
  const headers = options.headers ?? getCloudflareHeaders(options.env);

  const response = await fetchImpl(`${baseUrl}/crawl`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await readJsonResponse(response);
  const result = unwrapResult(data);

  if (!result?.jobId) {
    throw new Error(`Unexpected crawl init response: ${JSON.stringify(data)}`);
  }

  return result;
}

export async function pollJob(jobId, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? getCloudflareBaseUrl(options.env);
  const headers = options.headers ?? getCloudflareHeaders(options.env);
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const onPoll = options.onPoll ?? (() => {});

  while (true) {
    const response = await fetchImpl(`${baseUrl}/crawl/${jobId}`, { headers });
    const data = await readJsonResponse(response);
    const job = unwrapResult(data);

    if (job?.status === 'complete') {
      return job;
    }

    if (job?.status === 'failed') {
      throw new Error(`Crawl job failed: ${job.error ?? JSON.stringify(job)}`);
    }

    onPoll(job);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function runCrawl(payload, options = {}) {
  const initResult = await initiateCrawl(payload, options);
  const result = await pollJob(initResult.jobId, options);
  return { jobId: initResult.jobId, result };
}
