'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// Client boundary: shows a friendly message and NEVER the raw error text.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="container-x py-24 text-center">
      <h1 className="h2">Something went wrong</h1>
      <p className="muted mx-auto mt-3 max-w-md">
        An unexpected error occurred. Please try again. If it keeps happening, contact support.
      </p>
      {error.digest && <p className="muted mt-2 text-xs">Reference: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="btn btn-primary">Try again</button>
        <Link href="/" className="btn btn-ghost">Back to home</Link>
      </div>
    </div>
  );
}
