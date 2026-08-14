import type { AppData } from "../types";
import type { DataAdapter } from "./types";

const key = (userId: string) => `orbit:data:${userId}`;

/** Offline default: one JSON blob per account in localStorage. */
export const localAdapter: DataAdapter = {
  name: "local",
  async load(userId) {
    try {
      const raw = localStorage.getItem(key(userId));
      return raw ? (JSON.parse(raw) as AppData) : null;
    } catch {
      return null;
    }
  },
  async save(userId, data) {
    localStorage.setItem(key(userId), JSON.stringify(data));
  },
};
