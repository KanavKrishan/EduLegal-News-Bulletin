import axios from "axios";

const api = axios.create({
  baseURL: "/",
});

export const POLL_MS = 10 * 60 * 1000; // 10 minutes

export async function fetchNotices() {
  const response = await api.get("/api/notices");
  return response.data;
}

export async function refreshNotices() {
  const response = await api.get("/api/notices");
  return response.data;
}

export default api;
