export const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
).replace(/\/$/, '');

export async function accountError(response: Response) {
  const result =
    response.status < 500 ? await response.json().catch(() => null) : null;
  return typeof result?.message === 'string'
    ? result.message
    : 'Chưa thể xử lý yêu cầu. Vui lòng thử lại.';
}

export function sendAccountAction(action: string, body?: object) {
  return fetch(apiUrl + '/auth/' + action, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
}
