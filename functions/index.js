const cors = require("cors")({ origin: true });
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const config = require("./config");

initializeApp();
const db = getFirestore();
if (process.env.FUNCTIONS_EMULATOR === "true") {
    db.settings({
        host: "localhost:8082",
        ssl: false,
    });
}

const form_data = new URLSearchParams({
    action: "dashboard",
    p: "app",
    token_id: config.DEVICE_TOKEN,
    product: "DCON",
});

const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "user-agent": "DCON/161 CFNetwork/3826.500.131 Darwin/24.5.0",
};

// Check Fertigation Motor State from Logs
exports.getFertigationMotorState = onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const logsRef = db
                .collection("irrigation_devices")
                .doc(config.DEVICE_ID)
                .collection("fertigation_logs");

            // Find active fertigation (no endTime yet)
            const activeQuery = await logsRef
                .where("endTime", "==", null)
                .limit(1)
                .get();

            const motorState = !activeQuery.empty; // true if ON, false if OFF

            res.json({
                success: true,
                motorState, // true = ON, false = OFF
            });
        } catch (error) {
            console.error("Error fetching fertigation motor state:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });
});

exports.fetchIrrigationDataOnDemand = onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const response = await axios.post(config.DCON_API_URL, form_data, {
                headers,
            });
            const jsonData = response.data;

            const deviceKey = Object.keys(jsonData)[0]; // Get device key (e.g., MCON874Q000568)
            const deviceInfo = jsonData[deviceKey];
            const livePacket = deviceInfo.packets.live || "";

            // Extract live packet data (pressure, etc.)
            const pressureInOut = livePacket.match(/(\d+\.\d+)-(\d+\.\d+)/);
            const pressureIn = pressureInOut ? pressureInOut[1] : null;
            const pressureOut = pressureInOut ? pressureInOut[2] : null;

            // Extract current and next timers
            const currentTimer = deviceInfo.timers.current || {};
            const nextTimer = deviceInfo.timers.next || {};

            // Extract valve details
            const valveDetails = deviceInfo.valve_details || {};

            // Fertilizer data
            const fertilizer = deviceInfo.fertilizer || {};

            // Weather station data
            const weatherStation = deviceInfo.weather_station || {};

            // User details
            const users = deviceInfo.users || {};

            // Emergency shutdown status
            const emergencyShutdown = {
                state: deviceInfo.emergency_shutdown_state,
                status: deviceInfo.emergency_shutdown_status,
            };

            // Extract the sixth packet for voltage, current, and frequency
            const sixthPacket = deviceInfo.packets[6] || "";

            // Split the packet into parts based on commas
            const packetParts = sixthPacket.split(",");

            // Assuming that the voltage and current values are in specific positions
            const voltageValues = packetParts[4]?.split("-") || [];
            const currentValues = packetParts[6]?.split("-") || [];
            const frequencyValue = packetParts[10] || "";

            // Extract the voltage and current values
            const voltage1 = voltageValues[0] || null;
            const voltage2 = voltageValues[1] || null;
            const voltage3 = voltageValues[2] || null;

            const current1 = currentValues[0] || null;
            const current2 = currentValues[1] || null;
            const current3 = currentValues[2] || null;

            const runTimeByRemainingTime = currentTimer.run_time.split("-");
            const runTime = runTimeByRemainingTime[1] || null;
            const remainingTime = runTimeByRemainingTime[0] || null;

            const now = new Date(
                new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
            );
            const dateKey = now.toISOString().split("T")[0]; // "YYYY-MM-DD"

            await db
                .collection("irrigation_devices")
                .doc(deviceKey)
                .collection(dateKey)
                .add({
                    timestamp: now.toISOString(),
                    summary: {
                        device_info: {
                            server_time: deviceInfo.server_time || null,
                        },
                        live_data: {
                            pressure_in: pressureIn,
                            pressure_out: pressureOut,
                            sump_status: (() => {
                                const fields = livePacket.split(",");
                                const status = fields[7];
                                return status === "1" ? "On" : "Off";
                            })(),
                            irrigation_status: livePacket.includes("TM")
                                ? "Active"
                                : "Inactive",
                            voltage_phase_1: voltage1,
                            voltage_phase_2: voltage2,
                            voltage_phase_3: voltage3,
                            current_phase_1: current1,
                            current_phase_2: current2,
                            current_phase_3: current3,
                            frequency: frequencyValue,
                        },
                        timers: {
                            current: {
                                name: currentTimer.timer_name || null,
                                number: currentTimer.timer_no || null,
                                valves: currentTimer.on_valves || null,
                                run_time: runTime,
                                remaining_time: remainingTime,
                                completed: currentTimer.completed === "1",
                                start_time: currentTimer.time || null,
                            },
                            next: {
                                name: nextTimer.timer_name || null,
                                number: nextTimer.timer_no || null,
                                valves: nextTimer.valves || null,
                                on_time: nextTimer.on_time || null,
                                on_days: nextTimer.on_days || null,
                            },
                        },
                        valve_details: valveDetails,
                        fertilizer: fertilizer,
                        weather_station: weatherStation,
                        users: users,
                    },
                });

            res.json({ success: true, message: "Data fetched and stored", timestamp: now.toISOString() });
        } catch (error) {
            console.error("Error fetching or storing data on demand:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// Start Fertigation
exports.startFertigation = onRequest((req, res) => {
    cors(req, res, async () => {
        let queueDoc, valveGroupQueue, nextValveGroup, valveIds, command;

        const notes = req.body.notes || "";
        const startTime = new Date();
        const log = {
            quantity: "1 Tank",
            notes,
            startTime,
            deviceId: config.DEVICE_ID,
            date: startTime.toISOString().split("T")[0], // Store date within log
            endTime: null,
        };

        const logsRef = db
            .collection("irrigation_devices")
            .doc(config.DEVICE_ID)
            .collection("fertigation_logs");

        let fertigationStarted = false;

        try {
            // Check for active fertigation
            const activeQuery = await logsRef
                .where("endTime", "==", null)
                .limit(1)
                .get();

            if (!activeQuery.empty) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message: "Fertigation already running",
                    });
            }

            // Create new log document
            await logsRef.add(log);
            fertigationStarted = true;
            res.json({
                success: true,
                message: "Fertigation started",
                startTime,
            });

            try {
                await axios.post(
                    `${config.ZOHO_CLIQ_WEBHOOK}?zapikey=${config.ZOHO_CLIQ_API_KEY}`,
                    {
                        text: `🌿 Fertigation started at ${startTime.toLocaleString(
                            "en-IN",
                            { timeZone: "Asia/Kolkata" }
                        )}`,
                    }
                );
            } catch (notifyErr) {
                console.error(
                    "Failed to notify Zoho Cliq (start):",
                    notifyErr.message
                );
            }
        } catch (err) {
            console.error("Error starting fertigation:", err);
            return res.status(500).json({ success: false, error: err.message });
        }

        // --- New valve queue logic (run only if fertigation start was successful) ---
        if (fertigationStarted) {
            try {
                const fertigationQueueRef = db
                    .collection("irrigation_devices")
                    .doc(config.DEVICE_ID)
                    .collection("fertigation_queue")
                    .doc("current_queue");

                queueDoc = await fertigationQueueRef.get();

                if (!queueDoc.exists) {
                    console.warn("Queue document does not exist");
                    return;
                }

                valveGroupQueue = queueDoc.data().queue || [];

                if (
                    !Array.isArray(valveGroupQueue) ||
                    valveGroupQueue.length === 0
                ) {
                    console.warn("Valve queue is empty");
                    return;
                }

                // Take the first group and remove it manually
                nextValveGroup = valveGroupQueue[0];
                valveGroupQueue = valveGroupQueue.slice(1);

                if (!nextValveGroup || !Array.isArray(nextValveGroup.valves)) {
                    console.warn("Invalid valve group structure");
                    return;
                }

                // Save updated queue before running the command
                await fertigationQueueRef.set(
                    { queue: valveGroupQueue },
                    { merge: true }
                );

                valveIds = nextValveGroup.valves
                    .map((v) => v.id.toString().padStart(3, "0"))
                    .join(",");
                command = `V${valveIds}ON 01 00@A8`;

                console.log("Sending valve command:", {
                    command,
                    device_id: "12043",
                });

                const commandResponse = await axios.post(
                    "https://dcon.mobitechwireless.com/v1/command/",
                    { command, device_id: "12043" },
                    {
                        headers: {
                            accept: "*/*",
                            "content-type": "application/json",
                            authorization: config.DEVICE_TOKEN,
                        },
                        maxRedirects: 5, // Follow redirects like curl --location
                    }
                );

                console.log("Command response:", {
                    status: commandResponse.status,
                    data: commandResponse.data,
                });

                // Confirm update to Firestore after execution
                await fertigationQueueRef.set(
                    { queue: valveGroupQueue },
                    { merge: true }
                );

                try {
                    await axios.post(
                        `${config.ZOHO_CLIQ_WEBHOOK}?zapikey=${config.ZOHO_CLIQ_API_KEY}`,
                        {
                            text: `✅ Fertigation Valve Chnaged to ${valveIds}. Remaining queue length: ${valveGroupQueue.length}`,
                        }
                    );
                } catch (notifyErr) {
                    console.error("Failed to notify Zoho Cliq (success):", notifyErr.message);
                }
            } catch (queueErr) {
                console.error("Error processing valve queue:", {
                    message: queueErr.message,
                    status: queueErr.response?.status,
                    statusText: queueErr.response?.statusText,
                    data: queueErr.response?.data,
                    headers: queueErr.response?.headers,
                });
                try {
                    await axios.post(
                        `${config.ZOHO_CLIQ_WEBHOOK}?zapikey=${config.ZOHO_CLIQ_API_KEY}`,
                        {
                            text: `❌ Error processing valve queue: ${queueErr.message}${queueErr.response?.status ? ` (Status: ${queueErr.response.status})` : ""}`,
                        }
                    );
                } catch (notifyErr) {
                    console.error("Failed to notify Zoho Cliq (error):", notifyErr.message);
                }
            }
        }
    });
});

// Stop Fertigation
exports.stopFertigation = onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const endTime = new Date();
            const logsRef = db
                .collection("irrigation_devices")
                .doc(config.DEVICE_ID)
                .collection("fertigation_logs");

            // Find active fertigation log
            const activeQuery = await logsRef
                .where("endTime", "==", null)
                .limit(1)
                .get();

            if (activeQuery.empty) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message: "No active fertigation log found",
                    });
            }

            const activeLog = activeQuery.docs[0];
            const startTime = activeLog.data().startTime.toDate();
            const duration = Math.round((endTime - startTime) / 60000);

            // Update the log with end time and duration
            await activeLog.ref.update({
                endTime,
                duration,
            });

            res.json({
                success: true,
                message: "Fertigation stopped",
                endTime,
            });

            try {
                await axios.post(
                    `${config.ZOHO_CLIQ_WEBHOOK}?zapikey=${config.ZOHO_CLIQ_API_KEY}`,
                    {
                        text: `🛑 Fertigation stopped at ${endTime.toLocaleString(
                            "en-IN",
                            { timeZone: "Asia/Kolkata" }
                        )} (duration: ${duration} mins)`,
                    }
                );
            } catch (notifyErr) {
                console.error(
                    "Failed to notify Zoho Cliq (stop):",
                    notifyErr.message
                );
            }
        } catch (err) {
            console.error("Error stopping fertigation:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });
});

// Test Command Function
exports.testCommand = onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            // Default values from curl command, can be overridden by request body
            const command = req.body?.command || "V012,015ON 01 20@A8";
            const deviceId = req.body?.device_id || "12043";
            const authToken = req.body?.authorization || config.DEVICE_TOKEN;
            const cookies = req.body?.cookies || null;

            // Build headers - cookies are optional (may be session-specific)
            const headers = {
                accept: "*/*",
                "content-type": "application/json",
                authorization: authToken,
            };

            // Add cookies if provided
            if (cookies) {
                headers.Cookie = cookies;
            }

            console.log("Sending test command:", {
                url: "https://dcon.mobitechwireless.com/v1/command/",
                command,
                device_id: deviceId,
                hasCookies: !!cookies,
            });

            const response = await axios.post(
                "https://dcon.mobitechwireless.com/v1/command/",
                {
                    command,
                    device_id: deviceId,
                },
                {
                    headers,
                    maxRedirects: 5, // Follow redirects like curl --location
                }
            );

            res.json({
                success: true,
                message: "Command sent successfully",
                request: {
                    command,
                    device_id: deviceId,
                },
                response: response.data,
                status: response.status,
            });
        } catch (error) {
            console.error("Error sending test command:", {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers,
            });
            res.status(error.response?.status || 500).json({
                success: false,
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                response: error.response?.data || null,
            });
        }
    });
});