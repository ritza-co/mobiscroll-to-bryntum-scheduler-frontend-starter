export default function client(endpoint, { body, ...customConfig } = {}) {
  const headers = { "content-type": "application/json" };

  const config = {
    method: body ? "POST" : "GET",
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };
  if (body) {
    config.body = JSON.stringify(body);
  }

  return window.fetch(`${endpoint}`, config).then(async (response) => {
    if (response.status === 401) {
      logout();
      window.location.assign(window.location);
      return;
    }
    if (response.ok) {
      return await response.json();
    } else {
      const errorMessage = await response.text();
      return Promise.reject(new Error(errorMessage));
    }
  });
}
