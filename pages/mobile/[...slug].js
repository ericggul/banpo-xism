import { useSlugParser } from "@/utils/hooks/useSlugParser";
import DynamicPageViewer from "@/components/common/DynamicPageViewer";

export default function AptTestViewer() {
  const { componentPath, metadata, isLoading } = useSlugParser('mobile');

  return (
    <DynamicPageViewer
      componentPath={componentPath}
      metadata={metadata}
      isLoading={isLoading}
      loadingMessage="Loading shibuya test or invalid path..."
    />
  );
} 