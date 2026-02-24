/* eslint-disable max-len, camelcase */
const cors = require("cors")({ origin: true });
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onValueWritten } = require("firebase-functions/v2/database");
const { getDatabase } = require("firebase-admin/database");
const axios = require("axios");
const config = require("./config");

initializeApp();
const db = getFirestore();

const formData = new URLSearchParams({
  action: "dashboard",
  p: "app",
  token_id: config.DEVICE_TOKEN,
  product: "DCON",
});

const headers = {
  "Content-Type": "application/x-www-form-urlencoded",
  "user-agent": "DCON/161 CFNetwork/3826.500.131 Darwin/24.5.0",
};


exports.fetchIrrigationDataOnDemand = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const response = await axios.post(config.DCON_API_URL, formData, {
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

      // (Removed unused emergencyShutdown variable)

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

      const runTimeByRemainingTime = (currentTimer.run_time || "").split("-");
      const runTime = runTimeByRemainingTime[1] || null;
      const remainingTime = runTimeByRemainingTime[0] || null;

      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
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
              irrigation_status: livePacket.includes("TM") ?
                "Active" :
                "Inactive",
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

      return res.json({ success: true, message: "Data fetched and stored", timestamp: now.toISOString() });
    } catch (error) {
      console.error("Error fetching or storing data on demand:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Calculates the best valve group to irrigate based on a 15-day history.
 * @return {Promise<Object|null>} The recommended valve group object or null if none found.
 */
async function calculateSmartRecommendation() {
  try {
    const getISTDateStr = (dateObj) => {
      const d = new Date(dateObj.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const todayStr = getISTDateStr(new Date());
    const lookupDays = 90; // Extended from 15 → 90 days for richer history
    const lookupDate = new Date();
    lookupDate.setDate(lookupDate.getDate() - lookupDays);

    // 1. Fetch valve groups
    const groupsSnapshot = await db.collection("irrigation_devices")
      .doc(config.DEVICE_ID)
      .collection("valve_groups")
      .orderBy("createdAt", "desc")
      .get();

    const predefinedValveGroups = groupsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })).filter((g) => Array.isArray(g.valves) && g.valves.length > 0);

    if (predefinedValveGroups.length === 0) return null;

    // 2. Fetch valve details for name/ID mapping
    let dailySnap = await db.collection("irrigation_devices")
      .doc(config.DEVICE_ID)
      .collection(todayStr)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    if (dailySnap.empty) {
      console.log("No valve details for today, searching for most recent collection...");
      const collections = await db.collection("irrigation_devices")
        .doc(config.DEVICE_ID)
        .listCollections();

      const dateCollections = collections
        .filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.id))
        .sort((a, b) => b.id.localeCompare(a.id));

      if (dateCollections.length > 0) {
        dailySnap = await dateCollections[0]
          .orderBy("timestamp", "desc")
          .limit(1)
          .get();
      }
    }

    if (!dailySnap || dailySnap.empty) {
      console.warn("No valve details found in any collection.");
      return null;
    }
    const valveDetails = dailySnap.docs[0].data().summary?.valve_details || {};

    // 3. Map of valve name -> accumulated fertigation minutes
    const valveAccumulatedMinutes = {};
    Object.keys(valveDetails).forEach((id) => {
      valveAccumulatedMinutes[valveDetails[id].valve_name] = 0;
    });

    // 4. Fetch fertigation logs for the lookback period
    const logsSnapshot = await db.collection("irrigation_devices")
      .doc(config.DEVICE_ID)
      .collection("fertigation_logs")
      .where("startTime", ">=", lookupDate)
      .orderBy("startTime", "desc")
      .get();

    const fertLogs = logsSnapshot.docs.map((d) => d.data());

    // 5. Fetch timer logs from Mobitech for the same period
    const fromDate = getISTDateStr(lookupDate);
    const toDate = todayStr;

    const timerRes = await axios.post("https://dcon.mobitechwireless.com/v1/http/",
      new URLSearchParams({
        action: "logs", method: "timer_log", serial_no: config.DEVICE_ID,
        from: fromDate, to: toDate,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    const timerLogs = timerRes.data.log || [];

    // 6. Correlate: calculate total accumulated minutes per valve
    const parseIST = (dateStr) => {
      if (!dateStr) return new Date();
      return new Date(dateStr.replace(" ", "T") + "+05:30");
    };

    fertLogs.forEach((log) => {
      const start = log.startTime.toDate ? log.startTime.toDate() : new Date(log.startTime);
      const end = (log.endTime?.toDate ? log.endTime.toDate() : (log.endTime ? new Date(log.endTime) : new Date()));

      timerLogs.forEach((t) => {
        const ts = parseIST(t.dt);
        const te = parseIST(t.last_sync);

        // Calculate overlap
        const overlapStart = new Date(Math.max(start, ts));
        const overlapEnd = new Date(Math.min(end, te));

        // Only process if there is a valid overlap and valid valves
        if (overlapStart < overlapEnd && t.on_valves && t.on_valves !== "0") {
          const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000); // 60,000 ms in a minute

          if (overlapMinutes > 0) {
            t.on_valves.split("-").forEach((vId) => {
              const name = valveDetails[vId]?.valve_name;
              if (name !== undefined) {
                valveAccumulatedMinutes[name] += overlapMinutes;
              }
            });
          }
        }
      });
    });

    // 7. Score each group by avg accumulated minutes (lowest is best/most starved)
    const lookupDaysText = `${lookupDays} days`;

    const groupScores = predefinedValveGroups.map((group) => {
      let totalMinutes = 0;

      group.valves.forEach((v) => {
        totalMinutes += (valveAccumulatedMinutes[v.name] || 0);
      });

      const avgMinutes = Math.round(totalMinutes / group.valves.length);

      // Build a human-readable reason
      let reason;
      if (avgMinutes === 0) {
        reason = `No fertigation history found in the last ${lookupDaysText}`;
      } else if (avgMinutes < 60) {
        reason = `Fertigated for ~${avgMinutes} min${avgMinutes !== 1 ? "s" : ""} in the last ${lookupDaysText}`;
      } else {
        const hours = (avgMinutes / 60).toFixed(1);
        reason = `Fertigated for ~${hours} hr${hours !== "1.0" ? "s" : ""} in the last ${lookupDaysText}`;
      }

      return { ...group, avgMinutes, reason };
    });

    // Sort ascending by accumulated minutes (lowest minutes get priority)
    groupScores.sort((a, b) => a.avgMinutes - b.avgMinutes);

    // Return top 5 recommendations instead of just 1
    return groupScores.slice(0, 5);
  } catch (err) {
    console.error("Error calculating smart recommendation:", err);
    return [];
  }
}

/**
 * Cloud Function to fetch the current smart recommendation.
 */
exports.getSmartRecommendation = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const groupsSnapshot = await db
        .collection("irrigation_devices")
        .doc(config.DEVICE_ID)
        .collection("valve_groups")
        .get();

      const groupsCount = groupsSnapshot.size;
      const recommendation = await calculateSmartRecommendation();

      return res.json({
        success: true,
        recommendation,
        debug: {
          groupsCount,
          deviceId: config.DEVICE_ID,
        },
      });
    } catch (error) {
      console.error("Error in getSmartRecommendation function:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
});

// Internal logic for starting fertigation
async function internalStartFertigation(notes = "") {
  const startTime = new Date();
  const log = {
    quantity: "1 Tank",
    notes,
    startTime,
    deviceId: config.DEVICE_ID,
    date: startTime.toISOString().split("T")[0],
    endTime: null,
  };

  const logsRef = db
    .collection("irrigation_devices")
    .doc(config.DEVICE_ID)
    .collection("fertigation_logs");

  try {
    const activeQuery = await logsRef
      .where("endTime", "==", null)
      .limit(1)
      .get();

    if (!activeQuery.empty) {
      return { success: false, message: "Fertigation already running" };
    }

    // Verify RTDB state if not triggered by sync itself
    if (notes !== "Triggered by RTDB Sync") {
      const rtdbState = await getDatabase().ref("devices/MCON874Q000568/motorState").get();
      if (rtdbState.val() !== true) {
        return { success: false, message: "Cannot start log: Motor is currently OFF in Realtime Database." };
      }
    }

    // Create new log document
    await logsRef.add(log);

    try {
      const startIst = startTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, dateStyle: "medium", timeStyle: "short" });
      await axios.post(
        `${config.ZOHO_CLIQ_WEBHOOK}?zapikey=${config.ZOHO_CLIQ_API_KEY}`,
        {
          text: [
            `🌿 *Fertigation Started*`,
            `⏰ Time: ${startIst}`,
            `📟 Device: ${config.DEVICE_ID}`,
            `📋 Notes: ${notes || "—"}`,
          ].join("\n"),
        },
      );
    } catch (notifyErr) {
      console.error("Failed to notify Zoho Cliq (start):", notifyErr.message);
    }

    // --- New valve queue logic ---
    const fertigationQueueRef = db
      .collection("irrigation_devices")
      .doc(config.DEVICE_ID)
      .collection("fertigation_queue")
      .doc("current_queue");

    const queueDoc = await fertigationQueueRef.get();
    let valveGroupQueue = (queueDoc.exists ? (queueDoc.data().queue || []) : []);
    let nextValveGroup;
    let isAutoRec = false;

    if (!Array.isArray(valveGroupQueue) || valveGroupQueue.length === 0) {
      console.log("Queue empty, calculating smart recommendation...");
      const recommendations = await calculateSmartRecommendation();
      nextValveGroup = recommendations.length > 0 ? recommendations[0] : null;
      isAutoRec = true;
    } else {
      nextValveGroup = valveGroupQueue[0];
      valveGroupQueue = valveGroupQueue.slice(1);
      await fertigationQueueRef.set({ queue: valveGroupQueue }, { merge: true });
    }

    if (nextValveGroup && Array.isArray(nextValveGroup.valves)) {
      const valveIds = nextValveGroup.valves.map((v) => v.id.toString().padStart(3, "0")).join(",");
      const command = `V${valveIds}ON 01 00@A8`;

      await axios.post(
        "https://dcon.mobitechwireless.com/v1/command/",
        { command, device_id: "12043" },
        {
          headers: {
            "accept": "*/*",
            "content-type": "application/json",
            "authorization": config.DEVICE_TOKEN,
          },
          maxRedirects: 5,
        },
      );

      // Notify Zoho about valve activation
      try {
        const valveNamesList = nextValveGroup.valves.map((v) => v.name).join(", ");
        const cmdIst = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, timeStyle: "short" });
        let cliqText;
        if (isAutoRec) {
          cliqText = [
            `🤖 *Auto-Scheduler Activated*`,
            `💧 Group: *${nextValveGroup.name}*`,
            `🪴 Valves: ${valveNamesList}`,
            `📊 Reason: ${nextValveGroup.reason || "Highest staleness score"}`,
            `⏰ Time: ${cmdIst}`,
          ].join("\n");
        } else {
          cliqText = [
            `✅ *Valve Group Activated*`,
            `💧 Group: *${nextValveGroup.name}*`,
            `🪴 Valves: ${valveNamesList}`,
            `📋 Queue remaining: ${valveGroupQueue.length} group(s)`,
            `⏰ Time: ${cmdIst}`,
          ].join("\n");
        }
        await axios.post(`${config.ZOHO_CLIQ_WEBHOOK}?zapikey=${config.ZOHO_CLIQ_API_KEY}`, { text: cliqText });
      } catch (notifyErr) {
        console.error("Failed to notify Zoho Cliq (valve):", notifyErr.message);
      }
    }

    return { success: true, message: "Fertigation started", startTime };
  } catch (err) {
    console.error("Error in internalStartFertigation:", err);
    throw err;
  }
}

// Internal logic for stopping fertigation
async function internalStopFertigation() {
  try {
    const endTime = new Date();
    const logsRef = db
      .collection("irrigation_devices")
      .doc(config.DEVICE_ID)
      .collection("fertigation_logs");

    const activeQuery = await logsRef.where("endTime", "==", null).limit(1).get();

    if (activeQuery.empty) {
      return { success: false, message: "No active fertigation log found" };
    }

    // Verify RTDB state if not triggered by sync itself
    const logsRefCheck = db.collection("irrigation_devices").doc(config.DEVICE_ID).collection("fertigation_logs");
    const activeLogDoc = activeQuery.docs[0];
    const notes = activeLogDoc.data().notes || "";

    if (notes !== "Triggered by RTDB Sync") {
      const rtdbState = await getDatabase().ref("devices/MCON874Q000568/motorState").get();
      if (rtdbState.val() !== false) {
        return { success: false, message: "Cannot stop log: Motor is still ON in Realtime Database." };
      }
    }

    const activeLog = activeQuery.docs[0];
    const startTime = activeLog.data().startTime.toDate();
    const duration = Math.round((endTime - startTime) / 60000);

    await activeLog.ref.update({ endTime, duration });

    try {
      const stopIst = endTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, dateStyle: "medium", timeStyle: "short" });
      const startIst = startTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, timeStyle: "short" });
      const hrs = Math.floor(duration / 60);
      const mins = duration % 60;
      const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`;
      await axios.post(
        `${config.ZOHO_CLIQ_WEBHOOK}?zapikey=${config.ZOHO_CLIQ_API_KEY}`,
        {
          text: [
            `🛑 *Fertigation Stopped*`,
            `⏱️ Duration: ${durationStr}`,
            `🕐 Started: ${startIst}  →  Stopped: ${stopIst}`,
            `📟 Device: ${config.DEVICE_ID}`,
          ].join("\n"),
        },
      );
    } catch (notifyErr) {
      console.error("Failed to notify Zoho Cliq (stop):", notifyErr.message);
    }

    return { success: true, message: "Fertigation stopped", endTime };
  } catch (err) {
    console.error("Error in internalStopFertigation:", err);
    throw err;
  }
}

// RTDB Trigger to sync motor state
exports.onMotorStateWritten = onValueWritten(
  "devices/MCON874Q000568/motorState",
  async (event) => {
    console.log("RTDB Trigger event received:", JSON.stringify(event.data));
    const before = event.data.before.val();
    const after = event.data.after.val();

    console.log(`Motor state changed: ${before} -> ${after}`);

    if (before === after) {
      console.log("No change in motorState. Skipping.");
      return;
    }

    try {
      if (after === true) {
        await internalStartFertigation("Triggered by RTDB Sync");
      } else if (after === false) {
        await internalStopFertigation();
      }
    } catch (err) {
      console.error("Error processing motor state sync:", err);
    }
  });

// Start Fertigation (HTTP)
exports.startFertigation = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const result = await internalStartFertigation(req.body.notes || "");
      if (!result.success) return res.status(400).json(result);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
});

// Stop Fertigation (HTTP)
exports.stopFertigation = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const result = await internalStopFertigation();
      if (!result.success) return res.status(400).json(result);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
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
        "accept": "*/*",
        "content-type": "application/json",
        "authorization": authToken,
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
        },
      );

      return res.json({
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
      return res.status(error.response?.status || 500).json({
        success: false,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        response: error.response?.data || null,
      });
    }
  });
});
