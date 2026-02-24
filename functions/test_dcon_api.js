const axios = require("axios");
const config = require("./config");
(async () => {
    try {
        const todayStr = new Date().toISOString().split("T")[0];
        const lookupDate = new Date();
        lookupDate.setDate(lookupDate.getDate() - 90);
        const fromDate = lookupDate.toISOString().split("T")[0];
        const res = await axios.post("https://dcon.mobitechwireless.com/v1/http/",
            new URLSearchParams({
                action: "logs", method: "timer_log", serial_no: config.DEVICE_ID,
                from: fromDate, to: todayStr,
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        console.log("Status:", res.status);
        if (res.data && res.data.log) {
            console.log("Number of logs:", res.data.log.length);
        } else {
            console.log("No log array found in response");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
})();
