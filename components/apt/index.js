'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import styled from 'styled-components';

const experimentsContext = require.context('./', true, /^\.\/\d+\/\d+\.js$/);

function buildStructure() {
  const result = {};

  experimentsContext.keys().forEach((key) => {
    const match = key.match(/^\.\/(\d+)\/(\d+)\.js$/);
    if (!match) return;

    const [, generation, iteration] = match;
    if (!result[generation]) {
      result[generation] = new Set();
    }
    result[generation].add(iteration);
  });

  return Object.entries(result).reduce((acc, [generation, iterations]) => {
    acc[generation] = Array.from(iterations).sort((a, b) => Number(a) - Number(b));
    return acc;
  }, {});
}

export const aptStructure = buildStructure();

const PageWrapper = styled.main`
  min-height: 100vh;
  padding: 4rem 2rem;
  background: #050505;
  color: #f5f5f5;
  font-family: Inter, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
  text-align: center;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Description = styled.p`
  max-width: 640px;
  margin: 0;
  text-align: center;
  line-height: 1.6;
  color: rgba(245, 245, 245, 0.78);
`;

const TableWrapper = styled.div`
  width: min(960px, 100%);
  overflow-x: auto;
`;

const ExperimentsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(8px);
`;

const HeaderCell = styled.th`
  padding: 1rem 1.25rem;
  text-align: left;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
`;

const RowHeader = styled.th`
  padding: 0.9rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.06);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
`;

const Cell = styled.td`
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  vertical-align: middle;
  background: ${({ $isAvailable }) => ($isAvailable ? 'transparent' : 'rgba(255, 255, 255, 0.03)')};
  color: ${({ $isAvailable }) => ($isAvailable ? '#f5f5f5' : 'rgba(245, 245, 245, 0.32)')};

  &:last-child {
    border-right: none;
  }
`;

const ExperimentLink = styled(Link)`
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-decoration: none;
  color: inherit;
  background: rgba(255, 255, 255, 0.08);
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.14);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
  }
`;

const EmptyPlaceholder = styled.span`
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.6;
`;

export default function AptIndex() {
  const { generations, iterations } = useMemo(() => {
    const generationKeys = Object.keys(aptStructure).sort((a, b) => Number(a) - Number(b));
    const iterationSet = new Set();
    generationKeys.forEach((generation) => {
      aptStructure[generation].forEach((iteration) => iterationSet.add(iteration));
    });

    const iterationList = Array.from(iterationSet).sort((a, b) => Number(a) - Number(b));
    return {
      generations: generationKeys,
      iterations: iterationList,
    };
  }, []);

  const hasExperiments = generations.length > 0 && iterations.length > 0;

  return (
    <PageWrapper>
      <Title>APT Experiments</Title>
      <Description>
        Browse all available apartment generation experiments. Each row represents a generation
        folder while each column represents an iteration within that generation.
      </Description>

      <TableWrapper>
        <ExperimentsTable>
          <thead>
            <tr>
              <HeaderCell scope="col">Generation / Iteration</HeaderCell>
              {iterations.map((iteration) => (
                <HeaderCell key={`iteration-${iteration}`} scope="col">
                  #{iteration}
                </HeaderCell>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasExperiments ? (
              generations.map((generation) => (
                <tr key={`generation-row-${generation}`}>
                  <RowHeader scope="row">Gen {generation}</RowHeader>
                  {iterations.map((iteration) => {
                    const isAvailable = aptStructure[generation].includes(iteration);

                    return (
                      <Cell key={`${generation}-${iteration}`} $isAvailable={isAvailable}>
                        {isAvailable ? (
                          <ExperimentLink href={`/apt/${generation}/${iteration}`}>
                            {generation}/{iteration}
                          </ExperimentLink>
                        ) : (
                          <EmptyPlaceholder>N/A</EmptyPlaceholder>
                        )}
                      </Cell>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <Cell colSpan={iterations.length + 1}>
                  <EmptyPlaceholder>No experiments discovered</EmptyPlaceholder>
                </Cell>
              </tr>
            )}
          </tbody>
        </ExperimentsTable>
      </TableWrapper>
    </PageWrapper>
  );
}
