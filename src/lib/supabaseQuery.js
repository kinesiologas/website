const DEFAULT_TIMEOUT_MS = 4000;

function getTimeoutMs() {
  const configuredTimeout = Number(import.meta.env.VITE_SUPABASE_TIMEOUT_MS);

  return Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : DEFAULT_TIMEOUT_MS;
}

export async function runSupabaseQuery(query, label = 'Supabase query') {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${getTimeoutMs()}ms`));
    }, getTimeoutMs());
  });

  try {
    return await Promise.race([query, timeoutPromise]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
