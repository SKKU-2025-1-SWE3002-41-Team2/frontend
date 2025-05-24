import React, { useEffect, useRef, useState } from 'react';
import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import sheetsCoreEnUS from '@univerjs/presets/preset-sheets-core/locales/en-US';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';
import * as XLSX from 'xlsx'; // SheetJS 라이브러리 import

function App() {
    const containerRef = useRef(null);
    const univerAPIRef = useRef(null); // univerAPI를 저장할 ref 추가
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

        // univerAPI를 ref에 저장하여 다른 함수에서 사용할 수 있도록 함
        univerAPIRef.current = univerAPI;
        
        univerAPI.createUniverSheet({});
    }, []);

    // 워크북 스냅샷을 가져오는 함수
    const handleGetSnapshot = () => {
        if (univerAPIRef.current) {
            try {
                const fWorkbook = univerAPIRef.current.getActiveWorkbook();
                const snapshot = fWorkbook.save();
                console.log('📊 워크북 스냅샷:', snapshot);
                
                // 셀 데이터 구조 상세 분석
                if (snapshot.sheets) {
                    Object.keys(snapshot.sheets).forEach(sheetId => {
                        const sheet = snapshot.sheets[sheetId];
                        console.log(`📋 시트 [${sheet.name}] 분석:`);
                        
                        if (sheet.cellData) {
                            Object.keys(sheet.cellData).forEach(rowKey => {
                                const rowData = sheet.cellData[rowKey];
                                Object.keys(rowData).forEach(colKey => {
                                    const cellData = rowData[colKey];
                                    const cellAddress = XLSX.utils.encode_cell({r: parseInt(rowKey), c: parseInt(colKey)});
                                    
                                    if (cellData) {
                                        console.log(`🔍 셀 ${cellAddress}:`, {
                                            전체데이터: cellData,
                                            값: cellData.v || cellData.value,
                                            함수: cellData.f || cellData.formula,
                                            타입: cellData.t || cellData.type
                                        });
                                    }
                                });
                            });
                        }
                    });
                }
                
                alert('워크북 스냅샷이 콘솔에 출력되었습니다!\n셀 데이터 구조도 함께 분석되었습니다.');
            } catch (error) {
                console.error('스냅샷 가져오기 오류:', error);
                alert('스냅샷을 가져오는 중 오류가 발생했습니다.');
            }
        } else {
            alert('Univer API가 아직 초기화되지 않았습니다.');
        }
    };

    // Excel 함수를 Univer 함수로 변환하는 함수
    const convertFormulaToUniver = (excelFormula) => {
        if (!excelFormula) return null;
        
        let univerFormula = excelFormula.toString();
        
        // =로 시작하는 경우 그대로 유지 (Univer도 = 사용)
        // 필요시 특정 함수명 변환 로직 추가
        
        return univerFormula;
    };

    // SheetJS 워크북을 Univer 데이터 구조로 변환하는 함수
    const convertSheetJSToUniver = (xlsxWorkbook) => {
        const univerData = {
            id: 'uploaded-workbook-' + Date.now(),
            name: 'Uploaded Workbook',
            appVersion: '0.7.0',
            locale: 'zhCN',
            sheets: {},
            sheetOrder: [],
            styles: {},
            resources: []
        };

        try {
            // 각 시트 처리
            xlsxWorkbook.SheetNames.forEach((sheetName, index) => {
                const worksheet = xlsxWorkbook.Sheets[sheetName];
                const sheetId = `sheet-${index}-${Date.now()}`;
                
                // 시트 기본 정보 설정
                const univerSheet = {
                    id: sheetId,
                    name: sheetName,
                    tabColor: '',
                    hidden: 0,
                    rowCount: 1000,
                    columnCount: 20,
                    cellData: {},
                    mergeData: [],
                    rowData: {},
                    columnData: {},
                };

                // 셀 데이터 변환
                if (worksheet['!ref']) {
                    const range = XLSX.utils.decode_range(worksheet['!ref']);
                    
                    for (let row = range.s.r; row <= range.e.r; row++) {
                        for (let col = range.s.c; col <= range.e.c; col++) {
                            const cellAddress = XLSX.utils.encode_cell({r: row, c: col});
                            const xlsxCell = worksheet[cellAddress];
                            
                            if (xlsxCell) {
                                // 행이 없으면 생성
                                if (!univerSheet.cellData[row]) {
                                    univerSheet.cellData[row] = {};
                                }
                                
                                // Univer 셀 데이터 생성
                                const univerCell = {
                                    v: xlsxCell.v || '',
                                    t: 1 // 기본 타입
                                };

                                // 함수가 있는 경우 함수 정보 포함
                                if (xlsxCell.f) {
                                    univerCell.f = convertFormulaToUniver(xlsxCell.f);
                                    console.log(`📥 함수 업로드: ${cellAddress} = ${univerCell.f} (값: ${univerCell.v})`);
                                }

                                // 데이터 타입 설정
                                if (xlsxCell.t === 'n') {
                                    univerCell.t = 2; // 숫자
                                } else if (xlsxCell.t === 's') {
                                    univerCell.t = 1; // 문자열
                                } else if (xlsxCell.t === 'b') {
                                    univerCell.t = 4; // 불린
                                }

                                univerSheet.cellData[row][col] = univerCell;
                            }
                        }
                    }
                }

                // 시트를 univerData에 추가
                univerData.sheets[sheetId] = univerSheet;
                univerData.sheetOrder.push(sheetId);
            });

            console.log('📥 변환된 Univer 데이터:', univerData);
            return univerData;

        } catch (error) {
            console.error('SheetJS to Univer 변환 오류:', error);
            throw error;
        }
    };

    // XLSX 파일 업로드 및 적용 함수
    const handleUploadXLSX = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // XLSX 파일 읽기
                const data = new Uint8Array(e.target.result);
                const xlsxWorkbook = XLSX.read(data, { type: 'array' });
                
                console.log('📥 업로드된 XLSX 워크북:', xlsxWorkbook);
                
                // SheetJS 데이터를 Univer 형식으로 변환
                const univerData = convertSheetJSToUniver(xlsxWorkbook);
                
                // 기존 Univer 인스턴스 제거 및 새로 생성
                if (univerAPIRef.current) {
                    univerAPIRef.current.dispose();
                }

                // 새로운 Univer 인스턴스 생성
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

                univerAPIRef.current = univerAPI;
                
                // 업로드된 데이터로 워크북 생성
                univerAPI.createUniverSheet(univerData);
                
                console.log('📥 XLSX 파일 업로드 완료!');
                alert(`XLSX 파일이 성공적으로 업로드되었습니다!\n파일명: ${file.name}\n시트 수: ${xlsxWorkbook.SheetNames.length}`);
                
            } catch (error) {
                console.error('XLSX 업로드 오류:', error);
                alert('XLSX 파일 업로드 중 오류가 발생했습니다.\n' + error.message);
            }
        };

        reader.readAsArrayBuffer(file);
        
        // 파일 입력 초기화 (같은 파일 재업로드 가능하도록)
        event.target.value = '';
    };

    // Univer 스냅샷을 SheetJS 워크북으로 변환하는 함수
    const convertUniverToSheetJS = (univerData) => {
        const workbook = XLSX.utils.book_new();
        
        try {
            // 시트 순서대로 처리
            const sheetOrder = univerData.sheetOrder || [];
            const sheets = univerData.sheets || {};
            
            sheetOrder.forEach(sheetId => {
                const univerSheet = sheets[sheetId];
                if (!univerSheet) return;
                
                const sheetName = univerSheet.name || `Sheet_${sheetId}`;
                
                // Univer 시트 데이터를 SheetJS 워크시트로 변환
                let worksheet = {};
                
                // cellData가 있는 경우 처리
                if (univerSheet.cellData) {
                    // cellData는 보통 {row: {col: {v: value, ...}}} 형태
                    Object.keys(univerSheet.cellData).forEach(rowKey => {
                        const rowNum = parseInt(rowKey);
                        const rowData = univerSheet.cellData[rowKey];
                        
                        Object.keys(rowData).forEach(colKey => {
                            const colNum = parseInt(colKey);
                            const cellData = rowData[colKey];
                            
                            // Excel 셀 주소 생성 (예: A1, B2)
                            const cellAddress = XLSX.utils.encode_cell({r: rowNum, c: colNum});
                            
                            // 셀 데이터 분석 (함수와 값 구분)
                            let cellValue = '';
                            let cellFormula = null;
                            let cellType = 's'; // 기본값: string
                            
                            if (cellData && typeof cellData === 'object') {
                                // 함수가 있는 경우 함수를 우선적으로 처리
                                if (cellData.f || cellData.formula) {
                                    const rawFormula = cellData.f || cellData.formula;
                                    cellFormula = rawFormula; // 직접 사용 (이미 Excel 형식)
                                    cellValue = cellData.v || cellData.value || 0; // 함수 결과값
                                    cellType = typeof cellValue === 'number' ? 'n' : 's';
                                } else {
                                    // 일반 값
                                    cellValue = cellData.v || cellData.value || '';
                                    cellType = typeof cellValue === 'number' ? 'n' : 's';
                                }
                            } else {
                                // 단순 값
                                cellValue = cellData || '';
                                cellType = typeof cellValue === 'number' ? 'n' : 's';
                            }
                            
                            // SheetJS 셀 객체 생성
                            const sheetJSCell = {
                                v: cellValue,
                                t: cellType
                            };
                            
                            // 함수가 있는 경우 함수 정보 추가
                            if (cellFormula) {
                                sheetJSCell.f = cellFormula;
                                console.log(`📊 함수 발견: ${cellAddress} = ${cellFormula} (결과: ${cellValue})`);
                            }
                            
                            worksheet[cellAddress] = sheetJSCell;
                        });
                    });
                }
                
                // 범위 설정 (데이터가 있는 경우에만)
                const cellAddresses = Object.keys(worksheet);
                if (cellAddresses.length > 0) {
                    const range = XLSX.utils.decode_range(
                        cellAddresses.reduce((acc, addr) => {
                            if (!acc) return addr + ':' + addr;
                            const currentRange = XLSX.utils.decode_range(acc);
                            const cellRef = XLSX.utils.decode_cell(addr);
                            
                            return XLSX.utils.encode_range({
                                s: {
                                    r: Math.min(currentRange.s.r, cellRef.r),
                                    c: Math.min(currentRange.s.c, cellRef.c)
                                },
                                e: {
                                    r: Math.max(currentRange.e.r, cellRef.r),
                                    c: Math.max(currentRange.e.c, cellRef.c)
                                }
                            });
                        }, '')
                    );
                    worksheet['!ref'] = XLSX.utils.encode_range(range);
                } else {
                    // 데이터가 없으면 기본 범위 설정
                    worksheet['!ref'] = 'A1:A1';
                }
                
                // 워크북에 시트 추가
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            });
            
            // 시트가 없는 경우 빈 시트 하나 추가
            if (workbook.SheetNames.length === 0) {
                const emptySheet = XLSX.utils.aoa_to_sheet([]);
                XLSX.utils.book_append_sheet(workbook, emptySheet, 'Sheet1');
            }
            
        } catch (error) {
            console.error('Univer 데이터 변환 중 오류:', error);
            // 오류 발생 시 빈 워크북 반환
            const emptySheet = XLSX.utils.aoa_to_sheet([]);
            XLSX.utils.book_append_sheet(workbook, emptySheet, 'Sheet1');
        }
        
        return workbook;
    };

    // XLSX 파일로 다운로드하는 함수
    const handleDownloadXLSX = () => {
        if (univerAPIRef.current) {
            try {
                const fWorkbook = univerAPIRef.current.getActiveWorkbook();
                const snapshot = fWorkbook.save();
                
                console.log('📊 원본 Univer 스냅샷:', snapshot);
                
                // Univer 데이터를 SheetJS 워크북으로 변환
                const xlsxWorkbook = convertUniverToSheetJS(snapshot);
                
                // 파일명 생성 (현재 날짜와 시간 포함)
                const now = new Date();
                const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `univer-export-${timestamp}.xlsx`;
                
                // XLSX 파일로 다운로드
                XLSX.writeFile(xlsxWorkbook, filename);
                
                console.log('💾 XLSX 파일 다운로드 완료:', filename);
                alert(`XLSX 파일이 다운로드되었습니다!\n파일명: ${filename}`);
                
            } catch (error) {
                console.error('XLSX 다운로드 오류:', error);
                alert('XLSX 파일 다운로드 중 오류가 발생했습니다.\n' + error.message);
            }
        } else {
            alert('Univer API가 아직 초기화되지 않았습니다.');
        }
    };

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
                {/* 채팅 메시지 리스트 (상단 85%) */}
                <div style={{
                flex: 8.5,
                overflowY: 'auto',
                padding: '12px',
                fontSize: '14px',
                }}>
                <div><strong>User:</strong> Hello!</div>
                <div><strong>AI:</strong> Welcome!</div>
                <div><strong>User:</strong> What is Univer?</div>
                </div>

                {/* 채팅 입력창 및 버튼들 (하단 15%) */}
                <div style={{ flex: 1.5, padding: '12px', borderTop: '1px solid #ccc' }}>
                <textarea
                    placeholder="Type your message..."
                    style={{
                    width: '100%',
                    height: '30%',
                    resize: 'none',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    }}
                />
                
                {/* 파일 업로드 숨겨진 input */}
                <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleUploadXLSX}
                    style={{ display: 'none' }}
                    id="xlsx-upload"
                />
                
                {/* 버튼들을 가로로 배치 */}
                <div style={{ 
                    display: 'flex', 
                    gap: '2px', 
                    marginTop: '8px',
                    flexWrap: 'wrap'
                }}>
                    <button
                    style={{
                        flex: 1,
                        padding: '4px',
                        backgroundColor: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        minWidth: '45px',
                    }}
                    >
                    Send
                    </button>
                    
                    {/* 스냅샷 가져오기 버튼 */}
                    <button
                    onClick={handleGetSnapshot}
                    style={{
                        flex: 1,
                        padding: '4px',
                        backgroundColor: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        minWidth: '45px',
                    }}
                    >
                    📊 스냅샷
                    </button>
                    
                    {/* XLSX 다운로드 버튼 */}
                    <button
                    onClick={handleDownloadXLSX}
                    style={{
                        flex: 1,
                        padding: '4px',
                        backgroundColor: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        minWidth: '45px',
                    }}
                    >
                    📄 XLSX
                    </button>
                    
                    {/* XLSX 업로드 버튼 */}
                    <button
                    onClick={() => document.getElementById('xlsx-upload').click()}
                    style={{
                        flex: 1,
                        padding: '4px',
                        backgroundColor: '#6f42c1',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        minWidth: '45px',
                    }}
                    >
                    📁 업로드
                    </button>
                </div>
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