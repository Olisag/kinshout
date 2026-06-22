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



  let res = await fetch(`${API_BASE}${path}`, {

    method,

    headers,

    body: body ? JSON.stringify(body) : undefined,

  });



  if (res.status === 401 && getClientToken()) {

    setClientToken(null);

    await ensureClientAuth();

    const retryHeaders = { "Content-Type": "application/json" };

    const retryClientToken = getClientToken();

    if (retryClientToken) retryHeaders["X-Kinshout-Client-Token"] = retryClientToken;

    if (auth) {

      const retryUserToken = getUserToken();

      if (retryUserToken) retryHeaders.Authorization = `Bearer ${retryUserToken}`;

    }

    res = await fetch(`${API_BASE}${path}`, {

      method,

      headers: retryHeaders,

      body: body ? JSON.stringify(body) : undefined,

    });

  }



  if (res.status === 401 && auth) {

    setUserToken(null);

    throw new Error("Session expirée. Reconnectez-vous et réessayez.");

  }



  if (!res.ok) {

    const err = await res.json().catch(() => ({ error: res.statusText }));

    throw new Error(err.error || err.title || `HTTP ${res.status}`);

  }



  if (res.status === 204) return null;

  return res.json();

}



async function uploadRequest(path, formData) {

  await ensureClientAuth();

  const userToken = getUserToken();

  if (!userToken) {

    throw new Error("Connectez-vous pour téléverser des fichiers.");

  }



  function attachClientTokenToForm() {

    const clientToken = getClientToken();

    if (!clientToken) return null;

    if (formData.has("x_kinshout_client_token")) {

      formData.delete("x_kinshout_client_token");

    }

    // Azure IIS can drop X-Kinshout-Client-Token on multipart when Authorization is set.

    formData.append("x_kinshout_client_token", clientToken);

    return clientToken;

  }



  attachClientTokenToForm();



  const send = () => {

    const headers = {};

    const clientToken = getClientToken();

    if (clientToken) headers["X-Kinshout-Client-Token"] = clientToken;

    headers.Authorization = `Bearer ${userToken}`;

    return fetch(`${API_BASE}${path}`, { method: "POST", headers, body: formData });

  };



  let res = await send();



  if (res.status === 401) {

    const err = await res.clone().json().catch(() => ({}));

    const msg = err.error || "";

    const isClientError = msg.toLowerCase().includes("client token");

    if (isClientError && getClientToken()) {

      setClientToken(null);

      await ensureClientAuth();

      attachClientTokenToForm();

      res = await send();

    }

  }



  if (res.status === 401) {

    setUserToken(null);

    throw new Error("Session expirée. Reconnectez-vous et réessayez.");

  }



  if (!res.ok) {

    const err = await res.json().catch(() => ({ error: res.statusText }));

    throw new Error(err.error || `HTTP ${res.status}`);

  }



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

    facebook: (accessToken) =>
      request("/api/auth/facebook", { method: "POST", body: { accessToken } }),

    google: (idToken) => request("/api/auth/google", { method: "POST", body: { idToken } }),

    apple: (idToken) => request("/api/auth/apple", { method: "POST", body: { idToken } }),

    me: () => request("/api/auth/me", { auth: true }),

    updateProfile: (whatsappNumber) =>
      request("/api/auth/me", { method: "PATCH", body: { whatsAppNumber: whatsappNumber }, auth: true }),

    setSession({ token }) {

      setUserToken(token);

    },

    clearSession() {

      setUserToken(null);

    },

    getToken: getUserToken,

  },



  categories: {

    list: (options = {}) => {
      const { page = 1, pageSize = 20 } = options;
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      return request(`/api/categories?${params}`);
    },

  },



  adverts: {

    list: (options = {}) => {
      const { categoryId, page = 1, pageSize = 20, sort = "recent", intent } = options;
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
      if (categoryId) params.set("categoryId", categoryId);
      if (intent) params.set("intent", intent);
      return request(`/api/adverts?${params}`);
    },

    get: (id) => request(`/api/adverts/${id}`),

    create: (payload) => request("/api/adverts", { method: "POST", body: payload, auth: true }),

    listMine: (options = {}) => {
      const { page = 1, pageSize = 20 } = options;
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      return request(`/api/adverts/mine?${params}`, { auth: true });
    },

    update: (id, payload) => request(`/api/adverts/${id}`, { method: "PUT", body: payload, auth: true }),

    remove: (id) => request(`/api/adverts/${id}`, { method: "DELETE", auth: true }),

  },



  search: {

    query: (query, tab = "all", page = 1, pageSize = 20) =>
      request(
        `/api/search?q=${encodeURIComponent(query)}&tab=${encodeURIComponent(tab)}&page=${page}&pageSize=${pageSize}`
      ),

    post: (query, tab = "all", page = 1, pageSize = 20) =>
      request("/api/search", { method: "POST", body: { query, tab, page, pageSize } }),

    popular: (page = 1, pageSize = 10) =>
      request(`/api/search/popular?page=${page}&pageSize=${pageSize}`),

  },



  categorize: (text) => request("/api/categorize", { method: "POST", body: { text } }),



  discussions: {

    list: (options = {}) => {
      const { q, page = 1, pageSize = 20, sort = "recent" } = options;
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
      if (q) params.set("q", q);
      return request(`/api/discussions?${params}`);
    },

    listMine: (options = {}) => {
      const { page = 1, pageSize = 20, filter = "all" } = options;
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), filter });
      return request(`/api/discussions/mine?${params}`, { auth: true });
    },

    get: (id, options = {}) => {
      const { page = 1, pageSize = 20 } = options;
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      return request(`/api/discussions/${id}?${params}`);
    },

    create: (payload) =>

      request("/api/discussions", { method: "POST", body: payload, auth: true }),

    reply: (id, body) =>

      request(`/api/discussions/${id}/replies`, { method: "POST", body: { body }, auth: true }),

    update: (id, payload) =>
      request(`/api/discussions/${id}`, { method: "PUT", body: payload, auth: true }),

    remove: (id) =>
      request(`/api/discussions/${id}`, { method: "DELETE", auth: true }),

    updateReply: (discussionId, replyId, body) =>
      request(`/api/discussions/${discussionId}/replies/${replyId}`, {
        method: "PUT",
        body: { body },
        auth: true,
      }),

    removeReply: (discussionId, replyId) =>
      request(`/api/discussions/${discussionId}/replies/${replyId}`, {
        method: "DELETE",
        auth: true,
      }),

  },



  uploads: {

    images: async (files) => {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      const data = await uploadRequest("/api/uploads/images", form);
      return data.urls.map((url) => (url.startsWith("http") ? url : `${API_BASE}${url}`));
    },

    resume: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const data = await uploadRequest("/api/uploads/resume", form);
      const url = data.urls[0];
      return url.startsWith("http") ? url : `${API_BASE}${url}`;
    },

  },



  health: () => fetch(`${API_BASE}/api/health`).then((r) => r.json()),

};



export default api;

