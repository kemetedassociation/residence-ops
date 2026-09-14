let ioInstance = null;

export function setIO(io) {
  ioInstance = io;
}

export function roomFor(residenceId) {
  return `residence:${residenceId}`;
}

export function emitToResidence(residenceId, event, payload) {
  if (ioInstance && residenceId) {
    ioInstance.to(roomFor(residenceId)).emit(event, payload);
  }
}

export function emitToUser(userSocketRoom, event, payload) {
  if (ioInstance) {
    ioInstance.to(userSocketRoom).emit(event, payload);
  }
}
