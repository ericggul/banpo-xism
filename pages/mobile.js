import dynamic from "next/dynamic";

const MobileEl = dynamic(() => import("@/components/mobile"), {
  ssr: false,
});

export default function MobilePage() {
  return <div className="mx-auto max-w-screen-md"><MobileEl /></div>;
}


