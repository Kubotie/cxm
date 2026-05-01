import { Suspense } from "react";
import { AssetsPage } from "@/components/pages/assets-page";

export default function Page() {
  return (
    <Suspense>
      <AssetsPage />
    </Suspense>
  );
}
