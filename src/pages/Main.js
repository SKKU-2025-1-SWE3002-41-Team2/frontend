import { useEffect, useRef, useState, useCallback } from "react";
import {
    createUniver,
    defaultTheme,
    LocaleType,
    merge,
} from "@univerjs/presets";
import {
    UniverSheetsCorePreset,
    CalculationMode,
} from "@univerjs/presets/preset-sheets-core";
import sheetsCoreEnUS from "@univerjs/presets/preset-sheets-core/locales/en-US";
import "@univerjs/presets/lib/styles/preset-sheets-core.css";
import * as XLSX from "xlsx";
import "../styles/Main.css";
import { chatAPI, sheetUtils } from "../features/API";
import ReactMarkdown from "react-markdown";

function App() {
    /*세션 창 */
    const [isHistoryOpen, setHistoryOpen] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    //새 세션 생성
    const handleNewChat = async () => {
        setIsLoading(true);
        try {
            const sheetFile = buildEmptySheetFile();
            const responseRaw = await chatAPI.createSession(
                userId,
                "새 채팅 시작",
                sheetFile
            );
            const response = responseRaw;

            setCurrentSessionId(response.sessionId);
            setChatMessages([]);
            if (response.sheetData) {
                const univerSheetData = parseSheetData(response.sheetData);
                if (univerSheetData) {
                    await updateUniverWithData(univerSheetData);
                }
            }

            await loadSessions();
        } catch (error) {
            console.error("새 채팅 생성 실패:", error);
            alert("새 채팅 생성 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };
    
    // 세션 제목 저장
    const saveSessionName = async () => {
        if (!editingId) return;
        try {
            await chatAPI.updateSession(
                editingId,
                editingText.trim() || "제목 없음"
            );
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === editingId ? { ...s, name: editingText.trim() } : s
                )
            );
        } catch (e) {
            alert("세션 이름 변경 실패");
        } finally {
            setEditingId(null);
            setEditingText("");
        }
    };
    
    // 백에서 불러온 엑셀 디코딩
    const parseSheetData = (sheetData) => {
        if (typeof sheetData === "string") {
            try {
                const binaryString = atob(sheetData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const workbook = XLSX.read(bytes, {
                    type: "array",
                    cellFormula: true,
                    cellNF: true,
                    cellText: false,
                });
                return convertSheetJSToUniver(workbook);
            } catch (err) {
                console.error("시트 데이터(xlsx) 디코딩 오류:", err);
                return null;
            }
        }
        return sheetData;
    };
    
    //세션 로드
    const loadSessions = async () => {
        try {
            const sessionsData = await chatAPI.getSessions(userId);
            console.log("[loadSessions] sessionsData", sessionsData);
            setSessions(sessionsData);
        } catch (error) {
            console.error("세션 로드 실패:", error);
        }
    };
    useEffect(() => {
        loadSessions();
    }, []);
    
    // 채팅 메시지를 처리하고 시트 데이터와 함께 전송
    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;
        setIsLoading(true);

        try {
            let response;
            const snapshot = univerAPIRef.current?.getActiveWorkbook()?.save(); //현재 sheet을 스냅샷
            let sheetFile = null;
            if (snapshot) {
                const xlsxWorkbook = convertUniverToSheetJS(snapshot);
                sheetFile = sheetUtils.xlsxWorkbookToFile(xlsxWorkbook);
            }

            if (!currentSessionId) {
                response = await chatAPI.createSession(
                    userId,
                    chatInput,
                    sheetFile
                );
                setCurrentSessionId(response.sessionId);
                setChatMessages([
                    { role: "user", text: chatInput },
                    { role: "ai", text: response.message.content },
                ]);
            } else {
                response = await chatAPI.sendMessage(
                    currentSessionId,
                    chatInput,
                    sheetFile
                );
                setChatMessages((prev) => [
                    ...prev,
                    { role: "user", text: chatInput },
                    { role: "ai", text: response.message.content },
                ]);
            }

            if (response.sheetData) {
                const univerSheetData = parseSheetData(response.sheetData);
                if (univerSheetData) {
                    await updateUniverWithData(univerSheetData);
                }
            }
            await loadSessions();
        } catch (error) {
            console.error("메시지 전송 실패:", error);
            alert("메시지 전송 중 오류가 발생했습니다.");
        } finally {
            setChatInput("");
            setIsLoading(false);
        }
    };

    // 기존 세션 선택 시, 메시지 및 시트 데이터를 불러와 상태에 반영
    const handleSessionSelect = async (sessionId) => {
        try {
            setIsLoading(true);
            let sessionData = await chatAPI.getSessionMessages(sessionId);
            setCurrentSessionId(sessionId);

            const messages = sessionData.messages.map((msg) => ({
                role: msg.senderType === "USER" ? "user" : "ai",
                text: msg.content,
            }));
            setChatMessages(messages);

            if (sessionData.sheetData) {
                const univerSheetData = parseSheetData(sessionData.sheetData);
                if (univerSheetData) {
                    await updateUniverWithData(univerSheetData);
                }
            }
        } catch (error) {
            console.error("세션 로드 실패:", error);
            alert("세션을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };
    

    /* 채팅창 */
    //채팅 치면 맨 끝으로 내려가기 위해
    const chatEndRef = useRef(null);
    //채팅 기본으로 비어있음
    const [chatInput, setChatInput] = useState("");
    // 백엔드 연동전에 넣어 놓은 프리셋 메시지
    const [chatMessages, setChatMessages] = useState([
    ]);
    // 채팅창 크기 조절 위함
    const [chatWidth, setChatWidth] = useState(20);
    const minChat = 15;
    const maxChat = 50;
    // 채팅 맨 아래로
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);
    const [editingText, setEditingText] = useState("");

    const [userId] = useState(1);
    const containerRef = useRef(null);
    const univerAPIRef = useRef(null);
    
    // 채팅창 리사이즈
    const startResize = useCallback(
        (e) => {
            e.preventDefault();
            const startX = e.clientX;
            const start = chatWidth;
            const onMove = (moveEvt) => {
                const delta = moveEvt.clientX - startX;
                const newW = start + (delta / window.innerWidth) * 100;
                setChatWidth(Math.min(maxChat, Math.max(minChat, newW)));
            };
            const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        },
        [chatWidth]
    );
    // XLSX 파일로 다운로드하는 함수
    const handleDownloadXLSX = () => {
        if (univerAPIRef.current) {
            try {
                const fWorkbook = univerAPIRef.current.getActiveWorkbook();
                const snapshot = fWorkbook.save();
                console.log(" 원본 Univer 스냅샷:", snapshot);
                const xlsxWorkbook = convertUniverToSheetJS(snapshot);
                const now = new Date();
                const timestamp = now
                    .toISOString()
                    .replace(/[:.]/g, "-")
                    .slice(0, -5);
                const filename = `univer-export-${timestamp}.xlsx`;
                XLSX.writeFile(xlsxWorkbook, filename);
                console.log(" XLSX 파일 다운로드 완료:", filename);
                alert(`XLSX 파일이 다운로드되었습니다!\n파일명: ${filename}`);
            } catch (error) {
                console.error("XLSX 다운로드 오류:", error);
                alert(
                    "XLSX 파일 다운로드 중 오류가 발생했습니다.\n" +
                        error.message
                );
            }
        } else {
            alert("Univer API가 아직 초기화되지 않았습니다.");
        }
    };

    // XLSX 파일 업로드 및 적용 함수
    const handleUploadXLSX = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const xlsxWorkbook = XLSX.read(data, { type: "array" });

                console.log(" 업로드된 XLSX 워크북:", xlsxWorkbook);
                const univerData = convertSheetJSToUniver(xlsxWorkbook);

                if (univerAPIRef.current) {
                    univerAPIRef.current.dispose();
                }

                const containerId = "univer-container";
                const { univerAPI } = createUniver({
                    locale: LocaleType.EN_US,
                    locales: {
                        [LocaleType.EN_US]: merge({}, sheetsCoreEnUS),
                    },
                    theme: defaultTheme,
                    presets: [
                        UniverSheetsCorePreset({
                            container: containerId,
                            formula: {
                                initialFormulaComputing: CalculationMode.FORCED,
                            },
                        }),
                    ],
                });

                univerAPIRef.current = univerAPI;
                univerAPI.createUniverSheet(univerData);
                console.log(" XLSX 파일 업로드 완료!");
                alert(
                    `XLSX 파일이 성공적으로 업로드되었습니다!\n파일명: ${file.name}\n시트 수: ${xlsxWorkbook.SheetNames.length}`
                );
            } catch (error) {
                console.error("XLSX 업로드 오류:", error);
                alert(
                    "XLSX 파일 업로드 중 오류가 발생했습니다.\n" + error.message
                );
            }
        };

        reader.readAsArrayBuffer(file);
        event.target.value = "";
    };

    /*유니버sheet */
    const buildEmptySheetFile = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), "Sheet1");
        return sheetUtils.xlsxWorkbookToFile(wb, "empty.xlsx");
    };
    const updateUniverWithData = async (sheetData) => {
        try {
            if (univerAPIRef.current && sheetData) {
                univerAPIRef.current.dispose();
                const containerId = "univer-container";
                const { univerAPI } = createUniver({
                    locale: LocaleType.EN_US,
                    locales: {
                        [LocaleType.EN_US]: merge({}, sheetsCoreEnUS),
                    },
                    theme: defaultTheme,
                    presets: [
                        UniverSheetsCorePreset({
                            container: containerId,
                            formula: {
                                initialFormulaComputing: CalculationMode.FORCED,
                            },
                        }),
                    ],
                });

                univerAPIRef.current = univerAPI;
                univerAPI.createUniverSheet(sheetData);
            }
        } catch (error) {
            console.error("시트 데이터 업데이트 실패:", error);
        }
    };

    // univerAPI 제어
    useEffect(() => {
        if (!containerRef.current) return;
        const containerId = "univer-container";
        const { univerAPI } = createUniver({
            locale: LocaleType.EN_US,
            locales: {
                [LocaleType.EN_US]: merge({}, sheetsCoreEnUS),
            },
            theme: defaultTheme,
            presets: [
                UniverSheetsCorePreset({
                    container: containerId,
                    formula: {
                        initialFormulaComputing: CalculationMode.FORCED,
                    },
                }),
            ],
        });

        univerAPIRef.current = univerAPI;
        univerAPI.createUniverSheet({});
    }, []);
    
    //convertFormulaToUniver, convertSheetJSToUniver 엑셀 유니버 표시
    const convertFormulaToUniver = (excelFormula) => {
        if (!excelFormula) return null;
        let univerFormula = excelFormula.toString();
        if (!univerFormula.startsWith("=")) {
            univerFormula = "=" + univerFormula;
        }
        return univerFormula;
    };
    const convertSheetJSToUniver = (xlsxWorkbook) => {
        const univerData = {
            id: "uploaded-workbook-" + Date.now(),
            name: "Uploaded Workbook",
            appVersion: "0.7.0",
            locale: "zhCN",
            sheets: {},
            sheetOrder: [],
            styles: {},
            resources: [],
        };
        try {
            xlsxWorkbook.SheetNames.forEach((sheetName, index) => {
                const worksheet = xlsxWorkbook.Sheets[sheetName];
                const sheetId = `sheet-${index}-${Date.now()}`;

                const univerSheet = {
                    id: sheetId,
                    name: sheetName,
                    tabColor: "",
                    hidden: 0,
                    rowCount: 1000,
                    columnCount: 20,
                    cellData: {},
                    mergeData: [],
                    rowData: {},
                    columnData: {},
                };

                if (worksheet["!ref"]) {
                    const range = XLSX.utils.decode_range(worksheet["!ref"]);
                    for (let row = range.s.r; row <= range.e.r; row++) {
                        for (let col = range.s.c; col <= range.e.c; col++) {
                            const cellAddress = XLSX.utils.encode_cell({
                                r: row,
                                c: col,
                            });
                            const xlsxCell = worksheet[cellAddress];

                            if (xlsxCell) {
                                if (!univerSheet.cellData[row]) {
                                    univerSheet.cellData[row] = {};
                                }

                                const univerCell = {
                                    v: xlsxCell.v ?? "",
                                    t: 1, 
                                };

                                if (xlsxCell.f) {
                                    univerCell.f = convertFormulaToUniver(
                                        xlsxCell.f
                                    );
                                    console.log(
                                        ` 함수 업로드: ${cellAddress} = ${univerCell.f} (값: ${univerCell.v})`
                                    );
                                }

                                if (xlsxCell.t === "n") {
                                    univerCell.t = 2; // 숫자
                                } else if (xlsxCell.t === "s") {
                                    univerCell.t = 1; // 문자열
                                } else if (xlsxCell.t === "b") {
                                    univerCell.t = 4; // 불린
                                }
                                univerSheet.cellData[row][col] = univerCell;
                            }
                        }
                    }
                }
                univerData.sheets[sheetId] = univerSheet;
                univerData.sheetOrder.push(sheetId);
            });
            console.log(" 변환된 Univer 데이터:", univerData);
            return univerData;
        } catch (error) {
            console.error("SheetJS to Univer 변환 오류:", error);
            throw error;
        }
    };
    
    // Univer 시트 데이터를 엑셀 포맷으로 변환
    const convertUniverToSheetJS = (univerData) => {
        const workbook = XLSX.utils.book_new();
        try {
            const sheetOrder = univerData.sheetOrder || [];
            const sheets = univerData.sheets || {};
            sheetOrder.forEach((sheetId) => {
                const univerSheet = sheets[sheetId];
                if (!univerSheet) return;
                const sheetName = univerSheet.name || `Sheet_${sheetId}`;
                let worksheet = {};

                if (univerSheet.cellData) {
                    Object.keys(univerSheet.cellData).forEach((rowKey) => {
                        const rowNum = parseInt(rowKey);
                        const rowData = univerSheet.cellData[rowKey];

                        Object.keys(rowData).forEach((colKey) => {
                            const colNum = parseInt(colKey);
                            const cellData = rowData[colKey];

                            const cellAddress = XLSX.utils.encode_cell({
                                r: rowNum,
                                c: colNum,
                            });

                            let cellValue = "";
                            let cellFormula = null;
                            let cellType = "s"; 

                            if (cellData && typeof cellData === "object") {
                                if (cellData.f || cellData.formula) {
                                    let rawFormula =
                                        cellData.f || cellData.formula;
                                    cellFormula = rawFormula; 
                                    cellValue =
                                        cellData.v || cellData.value || 0;
                                    cellType =
                                        typeof cellValue === "number"
                                            ? "n"
                                            : "s";
                                } else {
                                    cellValue =
                                        cellData.v || cellData.value || "";
                                    cellType =
                                        typeof cellValue === "number"
                                            ? "n"
                                            : "s";
                                }
                            } else {
                                cellValue = cellData || "";
                                cellType =
                                    typeof cellValue === "number" ? "n" : "s";
                            }

                            const sheetJSCell = {
                                v: cellValue,
                                t: cellType,
                            };

                            if (cellFormula) {
                                sheetJSCell.f = cellFormula;
                                console.log(
                                    `함수 발견: ${cellAddress} = ${cellFormula} (결과: ${cellValue})`
                                );
                            }
                            worksheet[cellAddress] = sheetJSCell;
                        });
                    });
                }

                const cellAddresses = Object.keys(worksheet);
                if (cellAddresses.length > 0) {
                    const range = XLSX.utils.decode_range(
                        cellAddresses.reduce((acc, addr) => {
                            if (!acc) return addr + ":" + addr;
                            const currentRange = XLSX.utils.decode_range(acc);
                            const cellRef = XLSX.utils.decode_cell(addr);

                            return XLSX.utils.encode_range({
                                s: {
                                    r: Math.min(currentRange.s.r, cellRef.r),
                                    c: Math.min(currentRange.s.c, cellRef.c),
                                },
                                e: {
                                    r: Math.max(currentRange.e.r, cellRef.r),
                                    c: Math.max(currentRange.e.c, cellRef.c),
                                },
                            });
                        }, "")
                    );
                    worksheet["!ref"] = XLSX.utils.encode_range(range);
                } else {
                    worksheet["!ref"] = "A1:A1";
                }
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            });

            if (workbook.SheetNames.length === 0) {
                const emptySheet = XLSX.utils.aoa_to_sheet([]);
                XLSX.utils.book_append_sheet(workbook, emptySheet, "Sheet1");
            }
        } catch (error) {
            console.error("Univer 데이터 변환 중 오류:", error);
            const emptySheet = XLSX.utils.aoa_to_sheet([]);
            XLSX.utils.book_append_sheet(workbook, emptySheet, "Sheet1");
        }
        return workbook;
    };

    return (
        <div className="main-container">
            {/*  1. 슬라이딩 과거 이력 (왼쪽 고정) */}
            {/* <div className={`history-panel ${isHistoryOpen ? 'open' : 'closed'}`}>
                <div className="history-title">Chat History</div>
                <ul className="history-list">
                    <li> Prompt 1</li>
                    <li> Prompt 2</li>
                    <li> Prompt 3</li>
                </ul>
            </div> */}
            <div
                className={`history-panel ${isHistoryOpen ? "open" : "closed"}`}
            >
                <div className="history-header">
                    <div className="history-title">Chat History</div>
                    <button onClick={handleNewChat} className="new-chat-button">
                        새 채팅
                    </button>
                </div>

                {isLoading ? (
                    <div className="loading">로딩 중...</div>
                ) : (
                    <ul className="history-list">
                        {sessions.map((session) => (
                            <li
                                key={session.id}
                                onClick={() => handleSessionSelect(session.id)}
                                className={`session-item ${
                                    currentSessionId === session.id
                                        ? "active"
                                        : ""
                                }`}
                            >
                                <div
                                    className="session-name"
                                    onDoubleClick={(e) => {
                                        e.stopPropagation(); // 선택 클릭 막기
                                        setEditingId(session.id);
                                        setEditingText(session.name || "");
                                    }}
                                >
                                    {editingId === session.id ? (
                                        <input
                                            autoFocus
                                            value={editingText}
                                            onChange={(e) =>
                                                setEditingText(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter")
                                                    saveSessionName();
                                                if (e.key === "Escape") {
                                                    setEditingId(null);
                                                    setEditingText("");
                                                }
                                            }}
                                            onBlur={saveSessionName}
                                            className="session-edit-input"
                                        />
                                    ) : (
                                        <>
                                            {session.name ||
                                                `세션 ${session.id}`}
                                            <span
                                                className="edit-icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingId(session.id);
                                                    setEditingText(
                                                        session.name || ""
                                                    );
                                                }}
                                            >
                                                ✏️
                                            </span>
                                        </>
                                    )}
                                </div>
                                <div className="session-date">
                                    {new Date(
                                        session.modifiedAt
                                    ).toLocaleDateString()}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {/* 토글 버튼 (왼쪽 화면 가장자리) */}
            <button
                onClick={() => setHistoryOpen(!isHistoryOpen)}
                className={`toggle-button ${isHistoryOpen ? "open" : "closed"}`}
            >
                {isHistoryOpen ? "◀" : "▶"}
            </button>

            {/* 2. 고정된 채팅 패널 */}
            <div className="chat-panel" style={{ width: `${chatWidth}%` }}>
                {/* 채팅 메시지 리스트 (상단 85%) */}
                <div className="chat-messages">
                    {chatMessages.map((msg, index) => (
                        <div key={index}>
                            <strong>
                                {msg.role === "user" ? "User" : "AI"}:
                            </strong>
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                    ))}
                    {/* ← 스크롤 목적지 */}
                    <div ref={chatEndRef} />
                </div>

                {/* 채팅 입력창 및 버튼들 (하단 15%) */}
                <div className="chat-input-area">
                    <textarea
                        placeholder="Type your message..."
                        className="chat-textarea"
                        value={chatInput} //**채팅이 입력시 엔터키로 전송
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                    />

                    {/* 파일 업로드 숨겨진 input */}
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleUploadXLSX}
                        className="file-upload-hidden"
                        id="xlsx-upload"
                    />

                    {/* 버튼들을 가로로 배치 */}
                    <div className="button-container">
                        <button
                            className="button-base button-send"
                            onClick={handleSendMessage}
                        >
                            Send
                        </button>

                        {/* XLSX 다운로드 버튼 */}
                        <button
                            onClick={handleDownloadXLSX}
                            className="button-base button-download"
                        >
                            XLSX
                        </button>

                        {/* XLSX 업로드 버튼 */}
                        <button
                            onClick={() =>
                                document.getElementById("xlsx-upload").click()
                            }
                            className="button-base button-upload"
                        >
                            업로드
                        </button>
                    </div>
                </div>
            </div>
            <div className="vertical-resizer" onMouseDown={startResize} />

            {/* 3. Univer 시트 */}
            <div
                id="univer-container"
                ref={containerRef}
                className={`univer-container ${
                    isHistoryOpen ? "history-open" : "history-closed"
                }`}
                style={{ flex: 1 }}
            />
        </div>
    );
}

export default App;
