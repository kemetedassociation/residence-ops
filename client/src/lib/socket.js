import { io } from "socket.io-client";
import { useEffect } from "react";
import { getToken } from "./api";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io("/", {
      autoConnect: false,
      auth: (cb) => cb({ token: getToken() }),
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function useRealtime(events, handler) {
  useEffect(() => {
    const s = connectSocket();
    const list = Array.isArray(events) ? events : [events];
    list.forEach((event) => s.on(event, handler));
    return () => list.forEach((event) => s.off(event, handler));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(events) ? events.join(",") : events]);
}
