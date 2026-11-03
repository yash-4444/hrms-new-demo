import * as React from "react";
import SubmittedView from "./view";

/** `useSearchParams` needs a Suspense boundary for the static export to prerender this page. */
export default function Page() {
  return (
    <React.Suspense fallback={null}>
      <SubmittedView />
    </React.Suspense>
  );
}
