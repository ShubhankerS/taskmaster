// FILE: ~/taskmaster/src/app/api/events/route.ts
// GET /api/events — Server-Sent Events endpoint for real-time task/project/note updates.
// Streams a heartbeat every 25 seconds and a "ping" every 5 seconds so
// clients know the connection is alive. On each ping the client re-fetches
// its own data, removing the need for setInterval polling in components.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial "connected" event
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ userId: session.user!.id })}\n\n`
        )
      );

      // Send a ping every 5 seconds — clients use this to trigger a re-fetch
      const pingInterval = setInterval(() => {
        if (closed) {
          clearInterval(pingInterval);
          return;
        }
        try {
          controller.enqueue(
            encoder.encode(
              `event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`
            )
          );
        } catch {
          clearInterval(pingInterval);
        }
      }, 5000);

      // Clean up when the client disconnects
      return () => {
        closed = true;
        clearInterval(pingInterval);
      };
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
