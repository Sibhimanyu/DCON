import { initializeApp, getApp, getApps } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById("ai-chat-input");
    const sendBtn = document.getElementById("ai-chat-send-btn");
    const chatWindow = document.getElementById("ai-chat-window");
    const chatForm = document.getElementById("ai-chat-form");

    if (!chatInput) return;

    // Start multi-turn chat session with tools
    let chatSession = null;
    let model = null;

    // Listen for auth state changes to enable/disable chat
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("[AI] User logged in, initializing/enabling chat.");
            if (!model) initAI();
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.placeholder = "Ask Gemini...";
        } else {
            console.log("[AI] User logged out, disabling chat.");
            chatInput.disabled = true;
            sendBtn.disabled = true;
            chatInput.placeholder = "Please sign in to chat...";
            chatSession = null; // Clear session on logout
        }
    });

    // ——————————————————————————————————————
    // SDK Tool Definitions
    // ——————————————————————————————————————

    const TOOL_DECLARATIONS = [
        {
            functionDeclarations: [
                {
                    name: "get_live_status",
                    description: "Fetches current system status, active valves, queue, and fertigation history.",
                    parameters: {
                        type: "object",
                        properties: {
                            days: {
                                type: "number",
                                description: "Days of history to fetch (default 3)."
                            }
                        }
                    }
                },
                {
                    name: "start_manual_watering",
                    description: "Starts watering manually for a predefined valve group with a specified duration in minutes. This is for WATERING ONLY, not fertigation.",
                    parameters: {
                        type: "object",
                        properties: {
                            valve_group_name: {
                                type: "string",
                                description: "The exact name of the predefined valve group to activate."
                            },
                            duration_minutes: {
                                type: "number",
                                description: "Duration in minutes to run the valve group (e.g., 15, 30, 60)."
                            }
                        },
                        required: ["valve_group_name", "duration_minutes"]
                    }
                }
            ]
        }
    ];

    function initAI() {
        try {
            // Check if firebaseConfig is available globally
            if (typeof firebaseConfig === "undefined") {
                console.error("firebaseConfig is not defined in ai.js scope.");
                addMessage("Configuration Error: firebaseConfig is missing. Check firebase-config.js.", "system");
                return;
            }

            // Initialize modular app if needed (compat app doesn't count for modular functions)
            let app;
            if (getApps().length === 0) {
                app = initializeApp(firebaseConfig);
            } else {
                app = getApp();
            }

            // System instruction for the AI model
            const SYSTEM_INSTRUCTION = `You are DCON AI, an expert irrigation assistant. Help farmers analyze and control their fertigation system efficiently.

PREDEFINED VALVE GROUPS:
${getGroupsListText()}

ROLE:
1. You analyze data, provide logistic reports, and can control manual mode watering.
2. You DO NOT add valves to the automated queue, and you DO NOT control fertigation.
3. If the user asks for a system report, rely on 'get_live_status' to give detailed information including pressure, voltage, and current.
4. If the user asks to manually turn on/water a valve group, use the 'start_manual_watering' tool. This only works with the EXACT names of predefined valve groups. It will ask the user for confirmation.

BEHAVIOR RULES:
1. ALWAYS call 'get_live_status' FIRST for any question about "status", "history", or "analysis", then format the data clearly in a logistic report.
2. ALWAYS verify the exact PREDEFINED VALVE GROUP name before calling 'start_manual_watering'.
3. HIGHEST PRIORITY FORMATTING: Always present data (like sensor readings, timer history, logs) using rich Markdown formatting. Use **Markdown Tables** extensively for structured data to ensure it renders beautifully in the dashboard UI.
4. Be concise, actionable, and professional.`;

            // Create a `GenerativeModel` instance with gemini-3-flash-preview
            const ai = getAI(app, { backend: new GoogleAIBackend() });
            model = getGenerativeModel(ai, {
                model: "gemini-3-flash-preview",
                systemInstruction: SYSTEM_INSTRUCTION
            });

            // Start multi-turn chat session with tools
            chatSession = model.startChat({
                history: [],
                tools: TOOL_DECLARATIONS
            });

            chatInput.disabled = false;
            sendBtn.disabled = false;
            console.log("[AI] Service initialized successfully.");
        } catch (e) {
            console.error("AI Init Error:", e);
            addMessage(`Failed to initialize AI service: ${e.message}`, "system");
        }
    }

    // ——————————————————————————————————————
    // Live context helpers (read globals from main.js)
    // ——————————————————————————————————————

    function getGroupsListText() {
        if (typeof predefinedValveGroups === "undefined" || predefinedValveGroups.length === 0) {
            return "No predefined valve groups configured.";
        }
        return predefinedValveGroups
            .map(g => `  - "${g.name}" (Valves: ${g.valves.map(v => v.name).join(", ")})`)
            .join("\n");
    }

    function getCurrentQueueText() {
        if (typeof valveGroupQueue === "undefined" || valveGroupQueue.length === 0) {
            return "The fertigation queue is currently empty.";
        }
        return valveGroupQueue
            .map((g, i) => `  ${i + 1}. ${g.valves.map(v => v.name).join(", ")}`)
            .join("\n");
    }

    async function fetchRecentFertigationHistory(days = 3) {
        try {
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - days);
            const sinceTimestamp = firebase.firestore.Timestamp.fromDate(sinceDate);

            const snapshot = await db
                .collection("irrigation_devices")
                .doc("MCON874Q000568")
                .collection("fertigation_logs")
                .orderBy("startTime", "desc")
                .where("startTime", ">=", sinceTimestamp)
                .get();

            if (snapshot.empty) return `No fertigation sessions found in the past ${days} days.`;

            const fertigationLogs = snapshot.docs
                .map(doc => doc.data())
                .filter(log => log.duration > 0);

            if (fertigationLogs.length === 0) return "No completed fertigation sessions in that period.";

            let minStart = null, maxEnd = null;
            fertigationLogs.forEach(log => {
                const s = log.startTime?.toDate?.();
                const e = log.endTime?.toDate?.() || new Date();
                if (s && (!minStart || s < minStart)) minStart = s;
                if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
            });

            const today = new Date().toISOString().split("T")[0];
            const valveSnap = await db
                .collection("irrigation_devices")
                .doc("MCON874Q000568")
                .collection(today)
                .orderBy("timestamp", "desc")
                .limit(1)
                .get();
            const valveDetails = !valveSnap.empty ? (valveSnap.docs[0].data().summary?.valve_details || {}) : {};

            let timerLogs = [];
            if (minStart && maxEnd) {
                const fromDate = new Date(minStart);
                fromDate.setDate(fromDate.getDate() - 1);
                const fromStr = fromDate.toISOString().split("T")[0];
                const toStr = maxEnd.toISOString().split("T")[0];
                try {
                    const timerRes = await fetch("https://dcon.mobitechwireless.com/v1/http/", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams({
                            action: "logs", method: "timer_log", serial_no: "MCON874Q000568", from: fromStr, to: toStr
                        })
                    });
                    if (timerRes.ok) timerLogs = (await timerRes.json()).log || [];
                } catch (_) { }
            }

            const valveMap = {};
            fertigationLogs.forEach(log => {
                const start = log.startTime?.toDate?.();
                const end = log.endTime?.toDate?.();
                const sessionDuration = log.duration;
                const startStr = start?.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) || "Unknown";

                const overlapping = timerLogs.filter(timer => {
                    const ts = new Date(timer.dt);
                    const te = new Date(timer.last_sync);
                    const fertEnd = end || new Date();
                    return start <= te && fertEnd >= ts && timer.on_valves && timer.on_valves !== "0";
                });

                const involvedValves = [...new Set(
                    overlapping.flatMap(timer =>
                        (timer.on_valves || "").split("-").filter(v => v !== "0").map(v =>
                            valveDetails[v]?.valve_name || `Valve ${v}`
                        )
                    )
                )];

                const valvesToRecord = involvedValves.length > 0 ? involvedValves : ["Unknown"];
                valvesToRecord.forEach(valveName => {
                    if (!valveMap[valveName]) valveMap[valveName] = [];
                    valveMap[valveName].push({ date: startStr, duration: sessionDuration });
                });
            });

            const valveLines = Object.entries(valveMap).map(([valveName, sessions]) => {
                const totalMin = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
                const sessionLines = sessions.map(s => `      • ${s.date}: ${s.duration} min`).join("\n");
                return `  - ${valveName}: ${sessions.length} session(s), ${totalMin} min total\n${sessionLines}`;
            }).join("\n");

            return `Valve-wise fertigation history (past ${days} days):\n${valveLines}`;
        } catch (e) {
            console.error("fetchRecentFertigationHistory error:", e);
            return "Could not fetch fertigation history.";
        }
    }

    async function fetchCurrentValveStatus() {
        try {
            const today = new Date().toISOString().split("T")[0];
            const snapshot = await db
                .collection("irrigation_devices")
                .doc("MCON874Q000568")
                .collection(today)
                .orderBy("timestamp", "desc")
                .limit(1)
                .get();

            if (snapshot.empty) return "No live valve data available for today yet.";

            const data = snapshot.docs[0].data();
            const summary = data.summary || {};
            const live = summary.live_data || {};
            const timers = summary.timers || { current: { name: "Idle", valves: "0", remaining_time: 0 } };

            const motorRunning = live.sump_status === "On" || live.motor_on === true;
            let activeStr = timers.current.valves && timers.current.valves !== "0" ? timers.current.valves : "No valves currently active";
            if (timers.current.name && timers.current.name.toLowerCase().includes("manual mode") && timers.current.valve_name) {
                activeStr = `${timers.current.valve_name} (Manual Mode)`;
            }

            const fertActive = summary.fertigation_active ? "Yes" : "No";
            const timerInfo = timers.current.name !== "Idle"
                ? ` | Current Timer: ${timers.current.name} (${timers.current.remaining_time} min remaining)`
                : " | System Status: Idle";

            const pIn = live.pressure_in || "N/A";
            const pOut = live.pressure_out || "N/A";
            const v1 = live.voltage_phase_1 || "N/A";
            const v2 = live.voltage_phase_2 || "N/A";
            const v3 = live.voltage_phase_3 || "N/A";
            const c1 = live.current_phase_1 || "N/A";
            const c2 = live.current_phase_2 || "N/A";
            const c3 = live.current_phase_3 || "N/A";

            const detailedTelemetry = ` | Pressure In: ${pIn} bar, Out: ${pOut} bar | Voltage: L1 ${v1}V, L2 ${v2}V, L3 ${v3}V | Current: L1 ${c1}A, L2 ${c2}A, L3 ${c3}A`;

            return `Motor running: ${motorRunning ? "Yes" : "No"} | Active valves: ${activeStr} | Fertigation active: ${fertActive}${timerInfo}${detailedTelemetry}`;
        } catch (e) {
            console.error("fetchCurrentValveStatus error:", e);
            return "Could not fetch live valve status.";
        }
    }

    // ——————————————————————————————————————
    // Tool handler
    // ——————————————————————————————————————

    async function handleToolCall(fnCall) {
        const { name, args } = fnCall;
        console.log(`[AI] Handling tool: ${name}`, args);

        if (name === "get_live_status") {
            const days = args?.days || 3;
            const [status, history] = await Promise.all([
                fetchCurrentValveStatus(),
                fetchRecentFertigationHistory(days)
            ]);
            return {
                valve_status: status,
                recent_history: history,
                current_queue: getCurrentQueueText(),
                available_groups: getGroupsListText()
            };
        }

        if (name === "start_manual_watering") {
            const groupName = args?.valve_group_name;
            const duration = args?.duration_minutes;

            // Add custom verification using the browser's confirm dialog
            const isConfirmed = window.confirm(`SECURITY VERIFICATION:\n\nThe AI Assistant is requesting to activate the valve group '${groupName}' for ${duration} minutes in Manual Watering Mode.\n\nDo you want to proceed?`);

            if (!isConfirmed) {
                return { status: "cancelled", message: "User denied the manual activation. Tell the user you cannot proceed without their confirmation." };
            }

            try {
                const response = await fetch("/api/switchManualMode", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ valveGroupName: groupName, durationMinutes: duration })
                });

                const contentType = response.headers.get("content-type");
                let errorData = {};
                let result = {};

                if (contentType && contentType.includes("application/json")) {
                    if (!response.ok) {
                        errorData = await response.json();
                    } else {
                        result = await response.json();
                    }
                } else {
                    const text = await response.text();
                    if (!response.ok) {
                        return { status: "error", message: `Server returned non-JSON error (${response.status}): ${text.substring(0, 100)}... Please ensure your local server is restarted or the endpoint URL is correct.` };
                    }
                    result = { message: text };
                }

                if (!response.ok) {
                    return { status: "error", message: `Failed to activate manual watering mode: ${errorData.error || response.statusText}` };
                }

                return { status: "success", message: `Manual watering mode activated for ${groupName} for ${duration} minutes. Server response: ${result.message}` };
            } catch (error) {
                return { status: "error", message: `Network error while activating manual watering mode: ${error.message}` };
            }
        }

        return { error: "Unknown tool" };
    }

    // ——————————————————————————————————————
    // Submit handler
    // ——————————————————————————————————————

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text || !chatSession) return;

        addMessage(text, "user");
        chatInput.value = "";
        chatInput.disabled = true;
        sendBtn.disabled = true;

        const typingHtml = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
        const loadingId = addMessage(typingHtml, "ai", true);

        try {
            // Send user message
            let result = await chatSession.sendMessage(text);
            let response = result.response;

            // Handle tool calls recursively
            while (response.functionCalls()?.length > 0) {
                const toolResults = {};
                for (const fnCall of response.functionCalls()) {
                    toolResults[fnCall.name] = await handleToolCall(fnCall);
                }

                const toolParts = Object.entries(toolResults).map(([name, response]) => ({
                    functionResponse: { name, response }
                }));

                result = await chatSession.sendMessage(toolParts);
                response = result.response;
            }

            const aiText = response.text();
            document.getElementById(loadingId)?.remove();
            addMessage(aiText, "ai");

        } catch (error) {
            console.error("AI Chat Error:", error);
            document.getElementById(loadingId)?.remove();
            addMessage(`Error: ${error.message}`, "system");
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatWindow.scrollTop = chatWindow.scrollHeight;
            chatInput.focus();
        }
    });

    // ——————————————————————————————————————
    // UI helpers
    // ——————————————————————————————————————

    // ——————————————————————————————————————
    // UI helpers: Lightweight Native Markdown Parser
    // ——————————————————————————————————————

    function formatText(raw) {
        const slots = [];

        // Step 1a: Extract markdown TABLES before any escaping
        let result = raw.replace(/(\|[^\n]+\|\r?\n)(\|(?:[\s:]*-+[\s:]*\|)+\r?\n)((?:\|[^\n]+\|\r?\n?)+)/g,
            (match, headerRow, divider, bodyRows) => {
                const extractCells = (row) => row.split('|').map(s => s.trim()).filter(Boolean);
                const applyBold = (s) => s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                const headers = extractCells(headerRow);
                const rows = bodyRows.trim().split('\n').map(extractCells);
                const thead = `<tr>${headers.map(h => `<th>${applyBold(escapeHtml(h))}</th>`).join('')}</tr>`;
                const tbody = rows.map(r => `<tr>${r.map(c => `<td>${applyBold(escapeHtml(c))}</td>`).join('')}</tr>`).join('');
                const html = `<div class="table-responsive my-3">
                    <table class="table table-dark table-hover table-striped table-bordered text-center align-middle" style="background:rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.1);">
                        <thead style="background:rgba(255,255,255,0.05);">${thead}</thead>
                        <tbody>${tbody}</tbody>
                    </table></div>`;
                const idx = slots.length; slots.push(html);
                return `\x00SLOT${idx}\x00`;
            }
        );

        // Step 1b: Extract HEADINGS before escaping
        result = result.replace(/^(#{1,3})\s+(.+)$/gm, (match, hashes, content) => {
            const tag = hashes.length === 1 ? 'h4' : hashes.length === 2 ? 'h5' : 'h6';
            const html = `<${tag} class="mt-3 mb-1 fw-bold text-info">${escapeHtml(content)}</${tag}>`;
            const idx = slots.length; slots.push(html);
            return `\x00SLOT${idx}\x00`;
        });

        // Step 2: Escape ALL remaining plain text
        result = escapeHtml(result);

        // Step 3: Restore slots (tables + headings)
        result = result.replace(/\x00SLOT(\d+)\x00/g, (_, i) => slots[i]);

        // Step 4: Bold
        result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Step 5: Inline code
        result = result.replace(/`(.*?)`/g, '<code class="bg-dark text-light px-1 rounded border border-secondary">$1</code>');

        // Step 6: Newlines to <br>
        result = result.replace(/\n/g, '<br/>');

        return result;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function addMessage(text, type, isLoading = false) {
        const id = "msg-" + Date.now();
        const div = document.createElement("div");
        div.id = id;

        // System/loading text doesn't need markdown parsing
        const formattedText = type === "system" || isLoading ? text : formatText(text);

        if (type === "user") {
            div.className = "ai-message d-flex gap-3 align-items-start align-self-end flex-row-reverse max-w-75";
            div.innerHTML = `
                <div class="msg-avatar user-avatar flex-shrink-0 d-flex justify-content-center align-items-center rounded-circle bg-secondary text-white" style="width:36px;height:36px;"><i class="fas fa-user" style="font-size:14px;"></i></div>
                <div class="msg-bubble user-bubble p-3 rounded-4 text-light" style="border-top-right-radius:6px!important;line-height:1.6;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1); white-space: pre-wrap;">${formattedText}</div>`;
        } else if (type === "ai") {
            div.className = "ai-message d-flex gap-3 align-items-start max-w-75";
            div.innerHTML = `
                <div class="msg-avatar ai-avatar flex-shrink-0 d-flex justify-content-center align-items-center rounded-circle text-white" style="width:36px;height:36px;background:linear-gradient(135deg,#06b6d4,#6366f1);"><i class="fas ${isLoading ? "fa-spinner fa-spin" : "fa-robot"}" style="font-size:14px;"></i></div>
                <div class="msg-bubble ai-bubble flex-grow-1 p-3 rounded-4 text-light w-100 markdown-body" style="border-top-left-radius:6px!important;line-height:1.6;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08); overflow-x: auto; font-family: var(--font-primary); ${isLoading ? 'padding: 8px 16px !important;' : ''}">${formattedText}</div>`;
        } else {
            div.className = "w-100 text-center my-2";
            div.innerHTML = `<span class="text-muted small">${formattedText}</span>`;
        }

        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return id;
    }

    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event("submit"));
        }
    });
});
