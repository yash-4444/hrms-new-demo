import * as React from "react";
import TrackView from "./view";

/** `useSearchParams` needs a Suspense boundary for the static export to prerender this page. */
export default function Page() {
  return (
    <React.Suspense fallback={null}>
      <TrackView />
    </React.Suspense>
  );
}
