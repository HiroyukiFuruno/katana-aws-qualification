const clearers = new Set<() => void>();
let channel: BroadcastChannel | undefined;

export function registerGuestLearningMemory(clear: () => void) {
  clearers.add(clear);
  if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('katana.guest-learning-reset.v1');
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === 'reset') for (const clear of clearers) clear();
    };
  }
  return () => {
    clearers.delete(clear);
    if (!clearers.size) {
      channel?.close();
      channel = undefined;
    }
  };
}

export function clearGuestLearningMemory() {
  for (const clear of clearers) clear();
  if (channel) channel.postMessage('reset');
  else if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    const notification = new BroadcastChannel('katana.guest-learning-reset.v1');
    notification.postMessage('reset');
    notification.close();
  }
}
