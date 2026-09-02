/** Small helper so route handlers don't repeat the "json + Set-Cookie" dance. */
export function jsonWithCookie(
  data: unknown,
  cookie: string,
  init?: ResponseInit
): Response {
  const response = Response.json(data, init);
  response.headers.append("Set-Cookie", cookie);
  return response;
}
