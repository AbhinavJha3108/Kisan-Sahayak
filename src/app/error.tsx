"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <h2>Something went wrong.</h2>
          <p>Try again or refresh the page.</p>
          <button onClick={() => reset()}>Retry</button>
        </div>
      </body>
    </html>
  );
}
