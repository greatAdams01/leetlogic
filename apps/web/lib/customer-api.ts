export async function customerApi(path: string, body?: unknown, method = body ? "POST" : "GET") {
  const response = await fetch(`/api/customer/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Request failed");
  return result;
}
