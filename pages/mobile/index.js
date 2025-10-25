import Head from 'next/head';
import MobileIndex from '@/components/mobile';

export default function MobileLandingPage() {
  return (
    <>
      <Head>
        <title>Mobile Experiments Directory</title>
        <meta
          name="description"
          content="Browse the mobile prototypes and open each iteration in the viewer."
        />
      </Head>
      <MobileIndex />
    </>
  );
}
