import { initializeApp, getApp, getApps } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById("ai-chat-input");
    const sendBtn = document.getElementById("ai-chat-send-btn");
    const chatWindow = document.getElementById("ai-chat-window");
    const chatForm = document.getElementById("ai-chat-form");

    if (!chatInput) return;

    let chatSession = null;
    let model = null;

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
                }
            ]
        }
    ];

    // Initialize AI service immediately (no API key needed)
    initAI();

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
            const SYSTEM_INSTRUCTION = `You are DCON AI, an expert irrigation assistant. Help farmers analyze their fertigation system efficiently.

PREDEFINED VALVE GROUPS:
${getGroupsListText()}

ROLE:
1. You are purely informational. You can analyze data and provide insights.
2. You CANNOT add valves to the queue or change any system state.
3. If the user asks to "water" or "add to queue", explain that you are an analysis assistant and they should select the "Suggested" group in the "Valve Queue" on the fertigation tab for automated scheduling based on staleness.

BEHAVIOR RULES:
1. ALWAYS call 'get_live_status' FIRST for any question about "status", "history", or "analysis".
2. Be concise, actionable, and professional.`;

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

            return `Motor running: ${motorRunning ? "Yes" : "No"} | Active valves: ${activeStr} | Fertigation active: ${fertActive}${timerInfo}`;
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

        const loadingId = addMessage("Thinking...", "ai", true);

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

    function formatText(raw) {
        return raw
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/`(.*?)`/g, "<code class='inline-code'>$1</code>")
            .replace(/\n/g, "<br>");
    }

    function addMessage(text, type, isLoading = false) {
        const id = "msg-" + Date.now();
        const div = document.createElement("div");
        div.id = id;
        const formattedText = type === "system" ? text : formatText(text);

        if (type === "user") {
            div.className = "ai-message d-flex gap-3 align-items-start align-self-end flex-row-reverse";
            div.innerHTML = `
                <div class="msg-avatar user-avatar"><i class="fas fa-user"></i></div>
                <div class="msg-bubble user-bubble">${formattedText}</div>`;
        } else if (type === "ai") {
            div.className = "ai-message d-flex gap-3 align-items-start";
            div.innerHTML = `
                <div class="msg-avatar ai-avatar"><i class="fas ${isLoading ? "fa-spinner fa-spin" : "fa-robot"}"></i></div>
                <div class="msg-bubble ai-bubble">${formattedText}</div>`;
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
