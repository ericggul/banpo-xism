'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import styled from 'styled-components';

const variantsContext = require.context('./', true, /^\.\/\d+\/index\.js$/);

function buildStructure() {
  const variants = new Set();

  variantsContext.keys().forEach((key) => {
    const match = key.match(/^\.\/(\d+)\/index\.js$/);
    if (!match) return;

    const [, variant] = match;
    variants.add(variant);
  });

  return Array.from(variants).sort((a, b) => Number(a) - Number(b));
}

export const mobileStructure = buildStructure();

const PageWrapper = styled.main`
  min-height: 100vh;
  padding: 3rem 1.5rem 4rem;
  background: #050505;
  color: #f5f5f5;
  font-family: Inter, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Description = styled.p`
  margin: 0;
  max-width: 540px;
  text-align: center;
  line-height: 1.6;
  color: rgba(245, 245, 245, 0.78);
`;

const VariantList = styled.ul`
  width: min(640px, 100%);
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
`;

const VariantCard = styled.li`
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(6px);
`;

const VariantLink = styled(Link)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.85rem 1rem;
  color: inherit;
  text-decoration: none;
  transition: background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }
`;

const VariantLabel = styled.span`
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const VariantMeta = styled.span`
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  opacity: 0.6;
`;

const EmptyState = styled.div`
  padding: 1.5rem 2rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 0.9rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.65;
`;

export default function MobileIndex() {
  const variants = useMemo(() => mobileStructure, []);
  const hasVariants = variants.length > 0;

  return (
    <PageWrapper>
      <Title>Mobile Experiments</Title>
      <Description>
        Tap through the available mobile prototypes. Each card opens the iteration directly in the
        viewer.
      </Description>

      {hasVariants ? (
        <VariantList>
          {variants.map((variant) => (
            <VariantCard key={variant}>
              <VariantLink href={`/mobile/${variant}`}>
                <VariantLabel>Variant {variant}</VariantLabel>
                <VariantMeta>#{variant}</VariantMeta>
              </VariantLink>
            </VariantCard>
          ))}
        </VariantList>
      ) : (
        <EmptyState>No mobile iterations detected</EmptyState>
      )}
    </PageWrapper>
  );
}
