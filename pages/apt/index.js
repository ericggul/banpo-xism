import Head from 'next/head';
import AptIndex from '@/components/apt';

export default function AptLandingPage() {
  return (
    <>
      <Head>
        <title>APT Experiments Directory</title>
        <meta name="description" content="Browse all apartment generation experiments and jump directly into each iteration." />
      </Head>
      <AptIndex />
    </>
  );
}
