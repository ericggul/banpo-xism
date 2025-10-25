import { useState, useEffect, Suspense, useMemo, useCallback } from "react";
import styled from "styled-components";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { aptStructure } from "@/components/apt";
import { mobileStructure } from "@/components/mobile";

const Container = styled.div`
  ${({ theme }) => theme.WholeContainer || `
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
  `}
  background: black;
  color: white;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  font-family: Inter, sans-serif;
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  font-family: Inter, sans-serif;
  text-align: center;
`;

const MetadataInfo = styled.div`
  position: fixed;
  top: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.8);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-family: 'Inter', monospace;
  font-size: 0.75rem;
  z-index: 1000;
  opacity: 0.7;
  transition: opacity 0.3s ease;
  
  &:hover {
    opacity: 1;
  }
`;

const NavigationContainer = styled.div`
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 1000;
  font-family: 'Inter', sans-serif;
`;

const NavigationButton = styled.button`
  width: 3rem;
  height: 3rem;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 999px;
  border: none;
  font-size: 1.5rem;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  background: ${({ disabled }) =>
    disabled ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.18)'};
  color: #fff;
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: ${({ disabled }) => (disabled ? 'none' : 'translateY(-2px)')};
    background: ${({ disabled }) =>
      disabled ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.26)'};
    box-shadow: ${({ disabled }) =>
      disabled ? 'none' : '0 10px 24px rgba(0, 0, 0, 0.28)'};
  }
`;

const NavigationLabel = styled.span`
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.65;
`;

const MobileNavigationContainer = styled.nav`
  position: fixed;
  bottom: 1.2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.6rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.72);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  z-index: 1000;
  font-family: 'Inter', sans-serif;
`;

const MobileNavigationButton = styled.button`
  width: 2.4rem;
  height: 2.4rem;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 999px;
  border: none;
  font-size: 1.2rem;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  background: ${({ disabled }) =>
    disabled ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.18)'};
  color: #fff;
  transition: transform 0.2s ease, background 0.2s ease;
  padding: 0;

  &:hover {
    transform: ${({ disabled }) => (disabled ? 'none' : 'translateY(-1px)')};
    background: ${({ disabled }) =>
      disabled ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.26)'};
  }
`;

const MobileNavigationLabel = styled.span`
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.8;
  padding: 0 0.4rem;
`;

function resolveAptNavigation(segments) {
  if (segments.length < 4) {
    return null;
  }

  const generation = segments[2];
  const iteration = segments[3];

  const iterations = aptStructure[generation];
  if (!iterations || iterations.length === 0) {
    return null;
  }

  const currentIndex = iterations.indexOf(iteration);
  if (currentIndex === -1) {
    return null;
  }

  const prevIteration = currentIndex > 0 ? iterations[currentIndex - 1] : null;
  const nextIteration = currentIndex < iterations.length - 1 ? iterations[currentIndex + 1] : null;

  return {
    type: 'apt',
    generation,
    iteration,
    currentLabel: `Gen ${generation} / ${iteration}`,
    prevHref: prevIteration ? `/apt/${generation}/${prevIteration}` : null,
    nextHref: nextIteration ? `/apt/${generation}/${nextIteration}` : null,
    prevLabel: prevIteration ? `${generation}/${prevIteration}` : null,
    nextLabel: nextIteration ? `${generation}/${nextIteration}` : null,
  };
}

function resolveMobileNavigation(segments) {
  if (segments.length < 3 || !Array.isArray(mobileStructure) || mobileStructure.length === 0) {
    return null;
  }

  const iteration = segments[2];
  const currentIndex = mobileStructure.indexOf(iteration);
  if (currentIndex === -1) {
    return null;
  }

  const prevVariant = currentIndex > 0 ? mobileStructure[currentIndex - 1] : null;
  const nextVariant = currentIndex < mobileStructure.length - 1 ? mobileStructure[currentIndex + 1] : null;

  return {
    type: 'mobile',
    iteration,
    currentLabel: `Variant ${iteration}`,
    prevHref: prevVariant ? `/mobile/${prevVariant}` : null,
    nextHref: nextVariant ? `/mobile/${nextVariant}` : null,
    prevLabel: prevVariant ? `Variant ${prevVariant}` : null,
    nextLabel: nextVariant ? `Variant ${nextVariant}` : null,
  };
}

function resolveNavigation(componentPath) {
  if (!componentPath?.startsWith('components/')) {
    return null;
  }

  const segments = componentPath.split('/');
  const base = segments[1];

  if (base === 'apt') {
    return resolveAptNavigation(segments);
  }

  if (base === 'mobile') {
    return resolveMobileNavigation(segments);
  }

  return null;
}

function LoadingFallback({ metadata }) {
  return (
    <LoadingContainer>
      <div>Loading {metadata.title}...</div>
      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
        Path: {metadata.fullPath}
      </div>
    </LoadingContainer>
  );
}

function ErrorFallback({ metadata, error }) {
  return (
    <ErrorContainer>
      <div>Failed to load: {metadata.title}</div>
      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
        Path: {metadata.fullPath}
      </div>
      <div style={{ fontSize: '0.7rem', color: '#ff6b6b', maxWidth: '80%' }}>
        {error || 'Component not found or failed to load'}
      </div>
      <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '1rem' }}>
        Make sure the component exists at the expected path
      </div>
    </ErrorContainer>
  );
}

export default function ShibuyaViewer({ componentPath, metadata }) {
  const [error, setError] = useState(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const router = useRouter();

  const navigation = useMemo(
    () => resolveNavigation(componentPath),
    [componentPath]
  );

  const handleNavigate = useCallback(
    (href) => {
      if (!href) return;
      router.push(href);
    },
    [router]
  );

  // Create the dynamic component with error handling
  const DynamicComponent = useMemo(() => {
    try {
      return dynamic(
        () => import(`../${componentPath.replace('components/', '')}`).catch(err => {
          console.error(`Failed to load component: ${componentPath}`, err);
          setError(err.message || 'Component not found');
          throw err;
        }),
        {
          loading: () => <LoadingFallback metadata={metadata} />,
          ssr: false
        }
      );
    } catch (err) {
      console.error(`Error creating dynamic component: ${componentPath}`, err);
      setError(err.message || 'Failed to create component');
      return null;
    }
  }, [componentPath, metadata]);

  // Reset error when componentPath changes
  useEffect(() => {
    setError(null);
  }, [componentPath]);

  // Keyboard shortcut to toggle metadata
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'i' && e.ctrlKey) {
        e.preventDefault();
        setShowMetadata(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (error || !DynamicComponent) {
    return (
      <Container>
        <ErrorFallback metadata={metadata} error={error} />
      </Container>
    );
  }

  return (
    <Container>
      {showMetadata && (
        <MetadataInfo>
          <div><strong>{metadata.title}</strong></div>
          <div>Category: {metadata.category}</div>
          {metadata.subcategory && <div>Subcategory: {metadata.subcategory}</div>}
          <div>ID: {metadata.id}</div>
          <div>Path: {componentPath}</div>
          <div style={{ fontSize: '0.6rem', marginTop: '0.5rem', opacity: 0.7 }}>
            Press Ctrl+I to toggle
          </div>
        </MetadataInfo>
      )}
      
      <Suspense fallback={<LoadingFallback metadata={metadata} />}>
        <DynamicComponent />
      </Suspense>
      {navigation?.type === 'apt' && (
        <NavigationContainer>
          <NavigationButton
            type="button"
            onClick={() => handleNavigate(navigation.prevHref)}
            disabled={!navigation?.prevHref}
            aria-label="Previous experiment"
            title={navigation?.prevLabel ? `Previous: ${navigation.prevLabel}` : 'No previous experiment'}
          >
            &#8592;
          </NavigationButton>
          <NavigationLabel>{navigation.currentLabel}</NavigationLabel>
          <NavigationButton
            type="button"
            onClick={() => handleNavigate(navigation.nextHref)}
            disabled={!navigation?.nextHref}
            aria-label="Next experiment"
            title={navigation?.nextLabel ? `Next: ${navigation.nextLabel}` : 'No next experiment'}
          >
            &#8594;
          </NavigationButton>
        </NavigationContainer>
      )}
      {navigation?.type === 'mobile' && (
        <MobileNavigationContainer>
          <MobileNavigationButton
            type="button"
            onClick={() => handleNavigate(navigation.prevHref)}
            disabled={!navigation?.prevHref}
            aria-label="Previous variant"
            title={navigation?.prevLabel ? `Previous: ${navigation.prevLabel}` : 'No previous variant'}
          >
            &#8592;
          </MobileNavigationButton>
          <MobileNavigationLabel>{navigation.currentLabel}</MobileNavigationLabel>
          <MobileNavigationButton
            type="button"
            onClick={() => handleNavigate(navigation.nextHref)}
            disabled={!navigation?.nextHref}
            aria-label="Next variant"
            title={navigation?.nextLabel ? `Next: ${navigation.nextLabel}` : 'No next variant'}
          >
            &#8594;
          </MobileNavigationButton>
        </MobileNavigationContainer>
      )}
    </Container>
  );
}
