export async function customerApi(path: string, body?: unknown, method = body ? "POST" : "GET") {
  let response: Response;
  try {
    response = await fetch(`/api/customer/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw Object.assign(new Error("Unable to connect"), { code: "NETWORK_ERROR" });
  }
  let result;
  try {
    result = response.status === 204 ? {} : await response.json();
  } catch {
    throw Object.assign(new Error("Invalid response"), { code: "INVALID_SERVER_RESPONSE" });
  }
  if (!response.ok)
    throw Object.assign(new Error(result.error?.message || "Request failed"), {
      code: result.error?.code,
      requestId: result.error?.requestId,
      retryAfterSeconds: result.error?.retryAfterSeconds,
    });
  return result;
}
