import { accountError, apiUrl } from '../../lib/account-api';

export async function learningRequest<T>(
  path = '',
  options: { post?: boolean; body?: object; signal?: AbortSignal } = {},
) {
  const response = await fetch(apiUrl + '/learning' + path, {
    credentials: 'include',
    cache: 'no-store',
    signal: options.signal,
    method: options.post ? 'POST' : 'GET',
    ...(options.body && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options.body),
    }),
  });
  if (!response.ok) throw new Error(await accountError(response));
  return (await response.json()) as T;
}
