const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const axios = require("axios");
const config = require("./config");

process.env.FUNCTIONS_EMULATOR = "true";

initializeApp({ projectId: "mobitech-c93c0" });
const db = getFirestore();
db.settings({
    host: "localhost:8082",
    ssl: false,
});

async function calculateSmartRecommendation() {
    try {
        const todayStr = new Date().toISOString().split("T")[0];
        const lookupDays = 15;
        const lookupDate = new Date();
        lookupDate.setDate(lookupDate.getDate() - lookupDays);

        console.log("1. Fetching valve groups...");
        const groupsSnapshot = await db.collection("irrigation_devices")
            .doc(config.DEVICE_ID)
            .collection("valve_groups")
            .orderBy("createdAt", "desc")
            .get();

        const predefinedValveGroups = groupsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        if (predefinedValveGroups.length === 0) {
            console.log("No predefined valve groups.");
            return null;
        }

        console.log("2. Fetching valve details...");
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

        console.log("3. Mapping valve names...");
        const valveLastWatered = {};
        Object.keys(valveDetails).forEach((id) => {
            valveLastWatered[valveDetails[id].valve_name] = new Date(0);
        });

        console.log("4. Fetching fert logs...");
        const logsSnapshot = await db.collection("irrigation_devices")
            .doc(config.DEVICE_ID)
            .collection("fertigation_logs")
            .where("startTime", ">=", lookupDate)
            .get();

        const fertLogs = logsSnapshot.docs.map((d) => d.data());

        console.log("5. Fetching timer logs from DCON API...");
        const fromDate = lookupDate.toISOString().split("T")[0];
        const toDate = todayStr;

        const timerRes = await axios.post("https://dcon.mobitechwireless.com/v1/http/",
            new URLSearchParams({
                action: "logs", method: "timer_log", serial_no: config.DEVICE_ID,
                from: fromDate, to: toDate,
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        );
        const timerLogs = timerRes.data.log || [];

        console.log("6. Correlating...");
        fertLogs.forEach((log) => {
            const start = log.startTime.toDate ? log.startTime.toDate() : new Date(log.startTime);
            const end = (log.endTime?.toDate ? log.endTime.toDate() : (log.endTime ? new Date(log.endTime) : new Date()));

            const overlaps = timerLogs.filter((t) => {
                const ts = new Date(t.dt);
                const te = new Date(t.last_sync);
                return start <= te && end >= ts && t.on_valves && t.on_valves !== "0";
            });

            overlaps.forEach((t) => {
                t.on_valves.split("-").forEach((vId) => {
                    const name = valveDetails[vId]?.valve_name;
                    if (name) {
                        if (start > (valveLastWatered[name] || new Date(0))) {
                            valveLastWatered[name] = start;
                        }
                    }
                });
            });
        });

        console.log("7. Calculating scores...");
        const now = new Date();
        const groupScores = predefinedValveGroups.map((group) => {
            let totalStaleness = 0;
            group.valves.forEach((v) => {
                const last = valveLastWatered[v.name] || new Date(0);
                const diffMs = now - last;
                totalStaleness += diffMs / (1000 * 60 * 60 * 24);
            });
            return {
                ...group,
                avgStaleness: totalStaleness / group.valves.length,
            };
        });

        groupScores.sort((a, b) => b.avgStaleness - a.avgStaleness);

        return groupScores.length > 0 ? groupScores[0] : null;
    } catch (err) {
        console.error("Error calculating smart recommendation:", err);
        throw err;
    }
}

(async () => {
    try {
        console.log("Testing calculateSmartRecommendation...");
        const res = await calculateSmartRecommendation();
        console.log("RESULT:", res);
    } catch (e) {
        console.error("TEST FAILED:", e);
    }
    process.exit(0);
})();
