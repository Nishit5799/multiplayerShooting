import { Suspense } from "react";
import Experience from "@/components/Experience";
import Loading from "./loading";

export default function Home() {
  return (
    <>
      <Suspense fallback={<Loading />}>
        <div className="h-screen w-full bg-black fixed">
          <Experience />
        </div>
      </Suspense>
    </>
  );
}
