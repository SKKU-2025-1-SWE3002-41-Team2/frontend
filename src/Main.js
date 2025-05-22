import React, { useEffect, useRef, useState } from 'react';
import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import sheetsCoreEnUS from '@univerjs/presets/preset-sheets-core/locales/en-US';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

function App() {
    const containerRef = useRef(null);
    const [isHistoryOpen, setHistoryOpen] = useState(true);

    useEffect(() => {
        if (!containerRef.current) return;

        const containerId = 'univer-container';
        const { univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: {
            [LocaleType.EN_US]: merge({}, sheetsCoreEnUS),
        },
        theme: defaultTheme,
        presets: [
            UniverSheetsCorePreset({
            container: containerId,
            }),
        ],
        });

        univerAPI.createUniverSheet({});
    }, []);

    return (
        <div style={{ display: 'flex', width: '100%', height: '100vh', position: 'relative' }}>

        {/* 📜 1. 슬라이딩 과거 이력 (왼쪽 고정) */}
        <div
            style={{
            width: isHistoryOpen ? '10%' : '0',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            borderRight: isHistoryOpen ? '1px solid #ccc' : 'none',
            backgroundColor: '#fff',
            boxSizing: 'border-box',
            padding: isHistoryOpen ? '8px' : '0',
            }}
        >
            <strong>Chat History</strong>
            <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: '8px' }}>
            <li>🟢 Prompt 1</li>
            <li>🟢 Prompt 2</li>
            <li>🟢 Prompt 3</li>
            </ul>
        </div>

        {/* ◀▶ 토글 버튼 (왼쪽 화면 가장자리) */}
        <button
            onClick={() => setHistoryOpen(!isHistoryOpen)}
            style={{
            position: 'absolute',
            left: isHistoryOpen ? '10%' : '0',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            padding: '4px 6px',
            fontSize: '12px',
            border: '1px solid #ccc',
            backgroundColor: '#eee',
            borderRadius: '4px',
            cursor: 'pointer',
            }}
        >
            {isHistoryOpen ? '◀' : '▶'}
        </button>

        {/* 💬 2. 고정된 채팅 패널 */}
        <div
            style={{
            width: '20%',
            height: '100%',
            borderRight: '1px solid #ccc',
            backgroundColor: '#f9f9f9',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            }}
        >
            {/* 채팅 메시지 리스트 (상단 90%) */}
            <div style={{
            flex: 9,
            overflowY: 'auto',
            padding: '12px',
            fontSize: '14px',
            }}>
            <div><strong>User:</strong> Hello!</div>
            <div><strong>AI:</strong> Welcome!</div>
            <div><strong>User:</strong> What is Univer?</div>
            </div>

            {/* 채팅 입력창 (하단 10%) */}
            <div style={{ flex: 1, padding: '12px', borderTop: '1px solid #ccc' }}>
            <textarea
                placeholder="Type your message..."
                style={{
                width: '100%',
                height: '60%',
                resize: 'none',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px',
                boxSizing: 'border-box',
                }}
            />
            <button
                style={{
                marginTop: '8px',
                width: '100%',
                padding: '8px',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                }}
            >
                Send
            </button>
            </div>
        </div>

        {/* 📄 3. Univer 시트 */}
        <div
            id="univer-container"
            ref={containerRef}
            style={{
            width: isHistoryOpen ? '70%' : '80%',
            height: '100%',
            transition: 'width 0.3s ease',
            }}
        />
        </div>
    );
    }

export default App;
