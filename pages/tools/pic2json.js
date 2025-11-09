'use client';

import { useCallback, useMemo, useState } from 'react';

const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function Pic2JsonToolPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setResult(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('이미지를 먼저 선택해라');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/pic2json', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const { error: message } = await response.json().catch(() => ({
          error: '알 수 없는 오류',
        }));
        throw new Error(message || '서버 오류');
      }

      const json = await response.json();
      setResult(json);
    } catch (err) {
      setError(err.message || '처리에 실패했다');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile]);

  const roomsPreview = useMemo(() => {
    if (!result?.rooms?.length) return null;
    return result.rooms.map((room) => ({
      id: room.id,
      type: room.type,
      area: Math.round(room.areaMm2 || 0),
      start: room.startCoordinate,
      end: room.endCoordinate,
    }));
  }, [result]);

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px' }}>
        평면도 → JSON 변환기
      </h1>
      <p style={{ marginBottom: '24px', color: '#666' }}>
        PNG 올리면 색상 기반으로 거실/침실/발코니/기타 영역 뽑아서 mm 좌표 JSON으로 바꿔준다.
      </p>

      <form onSubmit={handleSubmit} style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
        </div>
        <button
          type="submit"
          disabled={isProcessing || !selectedFile}
          style={{
            padding: '10px 18px',
            fontWeight: 600,
            backgroundColor: isProcessing ? '#bbb' : '#111',
            color: '#fff',
            borderRadius: '6px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            border: 'none',
          }}
        >
          {isProcessing ? '변환 중...' : 'JSON 뽑아줘'}
        </button>
      </form>

      {error && (
        <div style={{ color: '#d00', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {result && (
        <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600 }}>결과</h2>
            <button
              type="button"
              onClick={() => downloadJson(result, `${selectedFile?.name || 'plan'}.json`)}
              style={{
                padding: '8px 14px',
                fontWeight: 600,
                backgroundColor: '#0059ff',
                color: '#fff',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              JSON 다운로드
            </button>
          </div>
          <pre
            style={{
              maxHeight: '320px',
              overflow: 'auto',
              background: '#111',
              color: '#f1f1f1',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
{JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}

      {roomsPreview && (
        <section>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            추출된 공간 리스트
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '8px' }}>
            {roomsPreview.map((room) => (
              <li
                key={room.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '12px',
                  background: '#fafafa',
                }}
              >
                <strong style={{ marginRight: '8px' }}>{room.type}</strong>
                <span style={{ marginRight: '8px' }}>
                  면적: {room.area} mm²
                </span>
                <span>
                  시작 {room.start?.map((val) => val.toFixed(1)).join(', ')} → 끝 {room.end?.map((val) => val.toFixed(1)).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
