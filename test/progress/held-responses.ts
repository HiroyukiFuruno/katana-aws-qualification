const targets = {
  'exam-save': '/rest/v1/rpc/save_exam_response_confirmed',
  'exam-start': '/rest/v1/rpc/start_exam_session',
  'exam-load': '/rest/v1/exam_sessions',
  'profile-save': '/rest/v1/rpc/replace_roadmap_profile',
};
type Held = { promise: Promise<void>; release: () => void; consumed: boolean };

export function heldResponses(forward: (request: Request) => Promise<Response>) {
  const held = new Map<string, Held>();
  return {
    control(request: Request) {
      if (request.method !== 'POST') return;
      const path = new URL(request.url).pathname;
      for (const name of Object.keys(targets)) {
        if (path === `/test/hold-next-${name}`) {
          if (held.has(name)) return new Response('A save is already held.', { status: 409 });
          let release: () => void = () => {};
          const promise = new Promise<void>((resolve) => {
            release = resolve;
          });
          held.set(name, { promise, release, consumed: false });
          return new Response(null, { status: 204 });
        }
        if (path === `/test/release-${name}`) {
          const pending = held.get(name);
          if (!pending) return new Response('No save is held.', { status: 409 });
          pending.release();
          return new Response(null, { status: 204 });
        }
      }
    },
    forward(request: Request) {
      const path = new URL(request.url).pathname;
      for (const [name, target] of Object.entries(targets)) {
        const pending = held.get(name);
        if (path !== target || !pending || pending.consumed) continue;
        pending.consumed = true;
        return (async () => {
          try {
            const response = await forward(request);
            await pending.promise;
            return response;
          } finally {
            if (held.get(name) === pending) held.delete(name);
          }
        })();
      }
    },
  };
}
