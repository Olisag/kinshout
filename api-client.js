const API_BASE =

  (typeof window !== "undefined" && window.KINSHOUT_API) ||

  import.meta?.env?.VITE_KINSHOUT_API ||

  "http://localhost:5280";



const CLIENT_ID =

  (typeof window !== "undefined" && window.KINSHOUT_CLIENT_ID) ||

  import.meta?.env?.VITE_KINSHOUT_CLIENT_ID ||

  "kinshout-web";



const CLIENT_SECRET =

  (typeof window !== "undefined" && window.KINSHOUT_CLIENT_SECRET) ||

  import.meta?.env?.VITE_KINSHOUT_CLIENT_SECRET ||

  "dev-kinshout-web-secret-change-me";



const CLIENT_TOKEN_KEY = "kinshout_client_token";

const USER_TOKEN_KEY = "kinshout_token";



function getClientToken() {

  return sessionStorage.getItem(CLIENT_TOKEN_KEY);

}



function setClientToken(token) {

  if (token) sessionStorage.setItem(CLIENT_TOKEN_KEY, token);

  else sessionStorage.removeItem(CLIENT_TOKEN_KEY);

}



function getUserToken() {

  return localStorage.getItem(USER_TOKEN_KEY);

}



function setUserToken(token) {

  if (token) localStorage.setItem(USER_TOKEN_KEY, token);

  else localStorage.removeItem(USER_TOKEN_KEY);

}



let clientAuthPromise = null;



async function ensureClientAuth() {

  const existing = getClientToken();

  if (existing) return existing;



  if (!CLIENT_SECRET) {

    throw new Error("KINSHOUT_CLIENT_SECRET is not configured.");

  }



  if (!clientAuthPromise) {

    clientAuthPromise = fetch(`${API_BASE}/api/auth/client`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),

    })

      .then(async (res) => {

        if (!res.ok) {

          const err = await res.json().catch(() => ({ error: res.statusText }));

          throw new Error(err.error || "Frontend client authentication failed.");

        }

        return res.json();

      })

      .then((data) => {

        setClientToken(data.clientToken);

        return data.clientToken;

      })

      .finally(() => {

        clientAuthPromise = null;

      });

  }



  return clientAuthPromise;

}



async function request(path, { method = "GET", body, auth = false } = {}) {

  await ensureClientAuth();



  const headers = { "Content-Type": "application/json" };

  const clientToken = getClientToken();

  if (clientToken) headers["X-Kinshout-Client-Token"] = clientToken;



  if (auth) {

    const userToken = getUserToken();

    if (userToken) headers.Authorization = `Bearer ${userToken}`;

  }



  const res = await fetch(`${API_BASE}${path}`, {

    method,

    headers,

    body: body ? JSON.stringify(body) : undefined,

  });



  if (res.status === 401 && getClientToken()) {

    setClientToken(null);

    await ensureClientAuth();

    return request(path, { method, body, auth });

  }



  if (!res.ok) {

    const err = await res.json().catch(() => ({ error: res.statusText }));

    throw new Error(err.error || err.title || `HTTP ${res.status}`);

  }



  if (res.status === 204) return null;

  return res.json();

}



export const api = {

  baseUrl: API_BASE,

  clientId: CLIENT_ID,



  client: {

    authenticate: ensureClientAuth,

    getToken: getClientToken,

    clearToken: () => setClientToken(null),

  },



  auth: {

    google: (idToken) => request("/api/auth/google", { method: "POST", body: { idToken } }),

    apple: (idToken) => request("/api/auth/apple", { method: "POST", body: { idToken } }),

    me: () => request("/api/auth/me", { auth: true }),

    updateProfile: (whatsappNumber) =>
      request("/api/auth/me", { method: "PATCH", body: { whatsAppNumber }, auth: true }),

    setSession({ token }) {

      setUserToken(token);

    },

    clearSession() {

      setUserToken(null);

    },

    getToken: getUserToken,

  },



  categories: {

    list: () => request("/api/categories"),

  },



  adverts: {

    list: (categoryId) =>

      request(categoryId ? `/api/adverts?categoryId=${categoryId}` : "/api/adverts"),

    get: (id) => request(`/api/adverts/${id}`),

    create: (payload) => request("/api/adverts", { method: "POST", body: payload, auth: true }),

  },



  search: {

    query: (query, tab = "all") =>

      request(`/api/search?q=${encodeURIComponent(query)}&tab=${encodeURIComponent(tab)}`),

    post: (query, tab = "all") =>

      request("/api/search", { method: "POST", body: { query, tab } }),

  },



  categorize: (text) => request("/api/categorize", { method: "POST", body: { text } }),



  discussions: {

    list: (q) => request(q ? `/api/discussions?q=${encodeURIComponent(q)}` : "/api/discussions"),

    get: (id) => request(`/api/discussions/${id}`),

    create: (payload) =>

      request("/api/discussions", { method: "POST", body: payload, auth: true }),

    reply: (id, body) =>

      request(`/api/discussions/${id}/replies`, { method: "POST", body: { body }, auth: true }),

  },



  uploads: {

    images: async (files) => {
      await ensureClientAuth();
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      const headers = {};
      const clientToken = getClientToken();
      if (clientToken) headers["X-Kinshout-Client-Token"] = clientToken;
      const userToken = getUserToken();
      if (userToken) headers.Authorization = `Bearer ${userToken}`;
      const res = await fetch(`${API_BASE}/api/uploads/images`, { method: "POST", headers, body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      return data.urls.map((url) => (url.startsWith("http") ? url : `${API_BASE}${url}`));
    },

    resume: async (file) => {
      await ensureClientAuth();
      const form = new FormData();
      form.append("file", file);
      const headers = {};
      const clientToken = getClientToken();
      if (clientToken) headers["X-Kinshout-Client-Token"] = clientToken;
      const userToken = getUserToken();
      if (userToken) headers.Authorization = `Bearer ${userToken}`;
      const res = await fetch(`${API_BASE}/api/uploads/resume`, { method: "POST", headers, body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const url = data.urls[0];
      return url.startsWith("http") ? url : `${API_BASE}${url}`;
    },

  },



  health: () => fetch(`${API_BASE}/api/health`).then((r) => r.json()),

};



export default api;

