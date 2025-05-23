const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
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
};

exports.fetchAndStoreIrrigationData = onSchedule("every 1 minutes", async (event) => {
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
        raw: jsonData,
        summary: {
          device_id: deviceKey,
          device_info: {
            version: deviceInfo.version || {},
            server_time: deviceInfo.server_time || null,
            sim: deviceInfo.sim || null,
            time_zone: deviceInfo.time_zone || null,
          },
          live_data: {
            pressure_in: pressureIn,
            pressure_out: pressureOut,
            sump_status: livePacket.includes("Sump5HP") ? "On" : "Off",
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
          emergency_shutdown: emergencyShutdown,
        }
      });

    console.log("Full JSON data and extracted summary saved successfully.");
  } catch (error) {
    console.error("Error fetching or storing data:", error.response?.data || error.message);
  }
});