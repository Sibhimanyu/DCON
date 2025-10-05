const cors = require("cors")({ origin: true });
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");

initializeApp();
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  const db = getFirestore();
  db.settings({
    host: 'localhost:8081',
    ssl: false,
  });
}
const db = getFirestore();

const form_data = new URLSearchParams({
  action: "dashboard",
  p: "app",
  token_id: "dyWWPoMA100JjehCnvnVHC:APA91bGRCO2MF-aNvdAG8SUYW0LUmaISV5cBYQDoVWUS6QN4UyiVZQ3IljhMeTf-Ss4drnqMo5H57oWXE08U4XxgSB42huq_mHxLXQiensiu6Aq-pNqAQtY@ios",
  product: "DCON",
});

const headers = {
  "Content-Type": "application/x-www-form-urlencoded",
  "user-agent": "DCON/161 CFNetwork/3826.500.131 Darwin/24.5.0"
};

exports.fetchAndStoreIrrigationData = onSchedule("every 5 minutes", async (event) => {
  try {
    const response = await axios.post("https://dcon.mobitechwireless.com/v1/http/", form_data, { headers });
    const jsonData = response.data;

    const deviceKey = Object.keys(jsonData)[0]; // Get device key (e.g., MCON874Q000568)
    const deviceInfo = jsonData[deviceKey];
    const livePacket = deviceInfo.packets.live || '';
    
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
      status: deviceInfo.emergency_shutdown_status
    };

    // Extract the sixth packet for voltage, current, and frequency
    const sixthPacket = deviceInfo.packets[6] || '';

    // Split the packet into parts based on commas
    const packetParts = sixthPacket.split(',');

    // Assuming that the voltage and current values are in specific positions
    const voltageValues = packetParts[4]?.split('-') || [];
    const currentValues = packetParts[6]?.split('-') || [];
    const frequencyValue = packetParts[10] || '';

    // Extract the voltage and current values
    const voltage1 = voltageValues[0] || null;
    const voltage2 = voltageValues[1] || null;
    const voltage3 = voltageValues[2] || null;

    const current1 = currentValues[0] || null;
    const current2 = currentValues[1] || null;
    const current3 = currentValues[2] || null;

    const runTimeByRemainingTime = currentTimer.run_time.split('-');
    const runTime = runTimeByRemainingTime[1] || null;
    const remainingTime = runTimeByRemainingTime[0] || null;

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dateKey = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

    await db
      .collection("irrigation_devices")
      .doc(deviceKey)
      .collection(dateKey)
      .add({
        timestamp: now.toISOString(),
        summary: {
          // device_id: deviceKey,
          device_info: {
            server_time: deviceInfo.server_time || null,
            // sim: deviceInfo.sim || null,
            // time_zone: deviceInfo.time_zone || null,
          },
          live_data: {
            pressure_in: pressureIn,
            pressure_out: pressureOut,
            sump_status: (() => {
              const fields = livePacket.split(',');
              const status = fields[7];
              return status === "1" ? "On" : "Off";
            })(),
            irrigation_status: livePacket.includes("TM") ? "Active" : "Inactive",
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
          // emergency_shutdown: emergencyShutdown,
        }
      });

    console.log("Full JSON data and extracted summary saved successfully.");
  } catch (error) {
    console.error("Error fetching or storing data:", error.response?.data || error.message);
  }
});

// Helper: Get today's fertigation log doc ref
function getTodayDocRef(db) {
  const currentDate = new Date().toISOString().split("T")[0];
  return db.collection("irrigation_devices")
           .doc("MCON874Q000568")
           .collection(currentDate)
           .doc("FERTIGATION_LOGS");
}

// Start Fertigation
exports.startFertigation = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const notes = req.body.notes || "";
      const startTime = new Date();
      const log = {
        quantity: "1 Tank",
        notes,
        startTime,
        deviceId: "MCON874Q000568"
      };

      const dateRef = getTodayDocRef(db);
      const doc = await dateRef.get();
      let logs = [];

      if (doc.exists) {
        logs = doc.data().logs || [];

        // Check if there's already an active log
        const hasActiveLog = logs.some(l => !l.endTime);

        if (hasActiveLog) {
          return res.status(400).json({ success: false, message: "Fertigation already running" });
        } else {
          logs.push(log);
        }
      } else {
        logs = [log];
      }

      await dateRef.set({ logs }, { merge: true });
      res.json({ success: true, message: "Fertigation started", startTime });
      try {
        await axios.post(
          "https://cliq.zoho.in/api/v2/channelsbyname/workerlogsh/message?zapikey=1001.206f6f66d7b8b1245e0513e3cd6cfafd.b4844f18747e01a15d27ed0639dedf2f",
          { text: `🌿 Fertigation started at ${startTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` }
        );
      } catch (notifyErr) {
        console.error("Failed to notify Zoho Cliq (start):", notifyErr.message);
      }
    } catch (err) {
      console.error("Error starting fertigation:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
});

// Stop Fertigation
exports.stopFertigation = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const endTime = new Date();
      const dateRef = getTodayDocRef(db);
      const doc = await dateRef.get();
      if (!doc.exists) {
        return res.status(400).json({ success: false, message: "No active fertigation log found" });
      }

      let logs = doc.data().logs || [];
      let updated = false;
      logs = logs.map(l => {
        if (!l.endTime && !updated) {
          updated = true;
          return { ...l, endTime, duration: Math.round((endTime - l.startTime.toDate())/60000) };
        }
        return l;
      });

      await dateRef.set({ logs }, { merge: true });
      res.json({ success: true, message: "Fertigation stopped", endTime });
      try {
        const lastLog = logs.find(l => l.endTime);
        const duration = lastLog?.duration || "unknown";
        await axios.post(
          "https://cliq.zoho.in/api/v2/channelsbyname/workerlogsh/message?zapikey=1001.206f6f66d7b8b1245e0513e3cd6cfafd.b4844f18747e01a15d27ed0639dedf2f",
          { text: `🛑 Fertigation stopped at ${endTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (duration: ${duration} mins)` }
        );
      } catch (notifyErr) {
        console.error("Failed to notify Zoho Cliq (stop):", notifyErr.message);
      }
    } catch (err) {
      console.error("Error stopping fertigation:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
});