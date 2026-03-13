// --- Firebase Authentication Setup ---
const auth = firebase.auth();

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userName = document.getElementById("user-name");
    const userAvatar = document.getElementById("user-avatar");
    const modalUserName = document.getElementById("modal-user-name");
    const modalUserEmail = document.getElementById("modal-user-email");
    const modalUserPhoto = document.getElementById("modal-user-photo");

    // --- Fertigation permission check and auth state update ---
    async function checkFertigationPermission(user) {
        const btn = document.getElementById("add-valve-group-btn"); // Make sure this matches your HTML ID
        if (!btn) return;

        try {
            const docRef = firebase.firestore().doc("irrigation_devices/Users");
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
                const allowed = data.allowedEmails || [];

                // --- Begin new permission logic for Add Valve Group and queue controls ---
                if (allowed.includes(user.email)) {
                    // ✅ Enable Add Valve Group button
                    btn.classList.remove("disabled");
                    btn.style.opacity = "";
                    btn.style.pointerEvents = "";
                    btn.onclick = null; // clear unauthorized alert
                    // ✅ Enable queue control buttons
                    document.querySelectorAll('.queue-control-btn').forEach(b => {
                        b.disabled = false;
                        b.classList.remove("disabled");
                        b.style.opacity = "";
                        b.style.pointerEvents = "";
                        // Remove previous unauthorized alert listeners if any
                        b.replaceWith(b.cloneNode(true));
                    });
                    // ✅ Enable select valves button
                    const selectBtn = document.getElementById("select-valves-btn");
                    if (selectBtn) {
                        selectBtn.classList.remove("disabled");
                        selectBtn.style.opacity = "";
                        selectBtn.style.pointerEvents = "";
                        selectBtn.onclick = null; // remove unauthorized alert if previously set
                    }
                } else {
                    // 🚫 Simulate disabled Add Valve Group button
                    btn.classList.add("disabled");
                    btn.style.opacity = "0.5";
                    btn.style.pointerEvents = "auto";

                    // Remove existing modal click events by cloning and replacing the element
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);

                    // Add alert-only behavior
                    newBtn.onclick = (e) => {
                        e.preventDefault();
                        alert("🚫 You are not authorized to add fertigation queues.");
                    };
                    // ✅ Disable queue control buttons
                    document.querySelectorAll('.queue-control-btn').forEach(b => {
                        b.classList.add("disabled");
                        b.style.opacity = "0.5";
                        b.style.pointerEvents = "auto";
                        b.addEventListener("click", (e) => {
                            e.preventDefault();
                            alert("🚫 You are not authorized to modify the fertigation queue.");
                        });
                    });
                    // ✅ Disable select valves button
                    const selectBtn = document.getElementById("select-valves-btn");
                    if (selectBtn) {
                        selectBtn.classList.add("disabled");
                        selectBtn.style.opacity = "0.5";
                        selectBtn.style.pointerEvents = "auto";
                        selectBtn.onclick = (e) => {
                            e.preventDefault();
                            alert("🚫 You are not authorized to select valves.");
                        };
                    }
                    console.warn(`🚫 ${user.email} is not authorized to add fertigation queue.`);
                }
                // --- End new permission logic ---
            } else {
                console.warn("⚠️ No allowed users list found in Firestore.");
                btn.disabled = true;
                // Disable all queue control buttons
                document.querySelectorAll('#valve-group-queue-list button').forEach(b => b.disabled = true);
            }
        } catch (err) {
            console.error("Error checking fertigation permission:", err);
            btn.disabled = true;
            // Disable all queue control buttons
            document.querySelectorAll('#valve-group-queue-list button').forEach(b => b.disabled = true);
        }
    }

    // Updated auth state listener for fertigation permission
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Update UI elements
            userName.textContent = user.displayName;
            userAvatar.src = user.photoURL || "images/user-default.png";

            modalUserName.textContent = user.displayName;
            modalUserEmail.textContent = user.email;
            modalUserPhoto.src = user.photoURL || "images/user-default.png";

            loginBtn.style.display = "none";
            logoutBtn.style.display = "block";

            // Check fertigation permission
            await checkFertigationPermission(user);

            // Load dashboard when logged in
            fetchAllDashboardData();
        } else {
            userName.textContent = "Sign in with Google";
            userAvatar.src = "images/user-default.png";

            modalUserName.textContent = "Not signed in";
            modalUserEmail.textContent = "";
            modalUserPhoto.src = "images/user-default.png";

            loginBtn.style.display = "block";
            logoutBtn.style.display = "none";

            const btn = document.getElementById("addFertigationBtn");
            if (btn) {
                btn.disabled = true;
                btn.addEventListener("click", () => {
                    alert("🔑 Please sign in to add fertigation queues.");
                });
            }

            // If no data is visible, show sign-in modal
            const liveData = document.getElementById("live-data");
            if (!liveData || liveData.innerHTML.trim() === "") {
                const modalElement = document.getElementById("userModal");
                const signInModal = new bootstrap.Modal(modalElement);
                setTimeout(() => {
                    signInModal.show();
                    const modalBody = modalElement.querySelector(".modal-body");
                    if (modalBody && !modalBody.querySelector(".signin-reminder")) {
                        const reminder = document.createElement("div");
                        reminder.className = "signin-reminder mt-3 text-center";
                        reminder.innerHTML = `
              <div class="alert alert-info">
                <strong>🔑 Please sign in to view your dashboard data.</strong><br>
                Click "Sign in with Google" to continue.
              </div>`;
                        modalBody.appendChild(reminder);
                    }
                }, 800);
            }
        }
    });

    // Handle Login
    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                const result = await auth.signInWithPopup(provider);
                const user = result.user;
                alert(`Welcome, ${user.displayName}!`);

                // Immediately update UI without waiting for reload
                userName.textContent = user.displayName;
                userAvatar.src = user.photoURL || "images/user-default.png";
                modalUserName.textContent = user.displayName;
                modalUserEmail.textContent = user.email;
                modalUserPhoto.src = user.photoURL || "images/user-default.png";
                loginBtn.style.display = "none";
                logoutBtn.style.display = "block";

                // Hide modal and load dashboard right away
                const modal = bootstrap.Modal.getInstance(document.getElementById("userModal"));
                modal.hide();


                // ✅ Force dashboard refresh instantly
                fetchAllDashboardData();

            } catch (err) {
                console.error("Google Sign-In failed:", err);
                alert("Login failed: " + err.message);
            }
        });
    }

    // Handle Logout
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await auth.signOut();
            alert("Logged out successfully!");
            const modal = bootstrap.Modal.getInstance(document.getElementById("userModal"));
            modal.hide();
        });
    }

    // Initialize date presets for all date selectors
    setTimeout(() => {
        setupDatePresets();
    }, 500);
});

// --- Load Moment.js and Chart.js adapter for time axis support ---
const momentScript = document.createElement("script");
momentScript.src = "https://cdn.jsdelivr.net/npm/moment@2.29.4/min/moment.min.js";
momentScript.onload = () => {
    const adapterScript = document.createElement("script");
    adapterScript.src = "https://cdn.jsdelivr.net/npm/chartjs-adapter-moment@1.0.0/dist/chartjs-adapter-moment.min.js";
    document.head.appendChild(adapterScript);
};
document.head.appendChild(momentScript);

// --- Fetch live data ---
async function fetchLiveData() {
    const liveContainer = document.getElementById("live-data");
    const currentTimer = document.getElementById("current-timer");
    const nextTimer = document.getElementById("next-timer");
    liveContainer.innerHTML = "";
    currentTimer.textContent = "";
    nextTimer.textContent = "";

    const snapshot = await db
        .collection("irrigation_devices")
        .doc("MCON874Q000568")
        .collection(new Date().toISOString().split("T")[0])
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();

    if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        const live = data.summary.live_data;

        Object.entries(live).forEach(([key, val]) => {
            const col = document.createElement("div");
            col.className = "col-md-4";
            col.innerHTML = `
                <div class="card h-100">
                    <div class="card-body d-flex flex-column justify-content-center text-center">
                        <h5 class="card-title text-uppercase text-muted" style="font-size: 0.9rem;">
                            ${key.replace(/_/g, " ")}
                        </h5>
                        <p class="display-6 fw-semibold text-primary mb-0">${val}</p>
                    </div>
                </div>
            `;
            liveContainer.appendChild(col);
        });

        const timers = data.summary.timers;
        // Progress bar for current timer
        const currentTimerDuration = parseInt(timers.current.run_time) || 0;
        const currentTimerRemaining = parseInt(timers.current.remaining_time) || 0;
        const currentTimerProgress = currentTimerDuration > 0
            ? Math.round(
                ((currentTimerDuration - currentTimerRemaining) / currentTimerDuration) * 100
            )
            : 0;
        currentTimer.innerHTML = `
            <strong>${timers.current.name}</strong>
            <div class="progress mt-2">
                <div class="progress-bar" role="progressbar" style="width: ${currentTimerProgress}%;" aria-valuenow="${currentTimerProgress}" aria-valuemin="0" aria-valuemax="100">
                    ${currentTimerProgress}%
                </div>
            </div>
            <small>${currentTimerRemaining} min remaining of ${currentTimerDuration} min</small>
        `;
        nextTimer.textContent = `${timers.next.name} (On Time: ${timers.next.on_time})`;
        // Add entrance animation
        liveContainer.classList.add("animate__animated", "animate__fadeIn");
    }
}

function drawGauge(canvasId, value, maxValue, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas with ID '${canvasId}' not found.`);
        return;
    }
    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.25 * Math.PI, false);
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.stroke();

    // Draw value arc
    const endAngle = 0.75 * Math.PI + (value / maxValue) * (1.5 * Math.PI);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, endAngle, false);
    ctx.lineWidth = 10;
    ctx.strokeStyle = color;
    ctx.stroke();

    // Draw text
    ctx.font = "16px Arial";
    ctx.fillStyle = "#f0f4f8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${value} bar`, centerX, centerY); // Display value in bar
}

// --- Update pressure difference bar and value ---
function updatePressureDifference(inputPressure, outputPressure) {
    const difference = Math.abs(inputPressure - outputPressure);
    const maxDifference = 3; // Assuming max difference is 6 bar
    const percentage = Math.min((difference / maxDifference) * 100, 100);
    const bar = document.getElementById("pressure-difference-bar");
    const valueDisplay = document.getElementById("pressure-difference-value");

    bar.style.width = `${percentage}%`;
    bar.ariaValueNow = percentage;
    valueDisplay.textContent = `${difference.toFixed(2)}`;

    // Set color based on intensity
    if (difference <= 0.2) {
        bar.className = "progress-bar bg-success"; // Low intensity
    } else if (difference > 0.2 && difference <= 0.9) {
        bar.className = "progress-bar bg-warning"; // Good intensity
    } else if (difference > 0.9 && difference <= 2) {
        bar.className = "progress-bar bg-danger"; // Bad intensity
    } else {
        bar.className = "progress-bar bg-dark"; // Extreme cases
    }
}

// --- Dashboard Overview ---
async function populateDashboardOverview() {
    const snapshot = await db
        .collection("irrigation_devices")
        .doc("MCON874Q000568")
        .collection(new Date().toISOString().split("T")[0])
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();
    if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        const valveDetails = data.summary.valve_details || {};
        const live = data.summary.live_data || {};

        // Update last updated time
        const serverTime = data.summary.device_info.server_time || "N/A";
        document.getElementById(
            "last-updated-time"
        ).textContent = `Last updated: ${serverTime}`;

        // Update voltage and current boxes
        const volt1 = live.voltage_phase_1 ?? "N/A";
        const volt2 = live.voltage_phase_2 ?? "N/A";
        const volt3 = live.voltage_phase_3 ?? "N/A";
        const curr1 = live.current_phase_1 ?? "N/A";
        const curr2 = live.current_phase_2 ?? "N/A";
        const curr3 = live.current_phase_3 ?? "N/A";

        document.getElementById(
            "voltage-phase-1-box"
        ).textContent = `${volt1} V`;
        document.getElementById(
            "current-phase-1-box"
        ).textContent = `${curr1} A`;
        document.getElementById(
            "voltage-phase-2-box"
        ).textContent = `${volt2} V`;
        document.getElementById(
            "current-phase-2-box"
        ).textContent = `${curr2} A`;
        document.getElementById(
            "voltage-phase-3-box"
        ).textContent = `${volt3} V`;
        document.getElementById(
            "current-phase-3-box"
        ).textContent = `${curr3} A`;

        // Set phase card background color based on voltage
        function setPhaseCardColor(phase, voltage) {
            const phaseCard = document
                .querySelector(`#voltage-phase-${phase}-box`)
                .closest(".text-center");
            if (phaseCard) {
                if (parseFloat(voltage) === 0) {
                    phaseCard.style.backgroundColor = "rgba(100, 100, 120, 0.3)"; // greyish
                    phaseCard.style.color = "#f0f4f8";
                } else {
                    if (phase === "1") {
                        phaseCard.style.backgroundColor = "rgba(248, 113, 113, 0.2)";
                    } else if (phase === "2") {
                        phaseCard.style.backgroundColor = "rgba(251, 191, 36, 0.2)";
                    } else if (phase === "3") {
                        phaseCard.style.backgroundColor = "rgba(96, 165, 250, 0.2)";
                    }
                    phaseCard.style.color = "#f0f4f8";
                }
            }
        }
        setPhaseCardColor("1", volt1);
        setPhaseCardColor("2", volt2);
        setPhaseCardColor("3", volt3);

        // Update pressure gauges
        const inputPressure = parseFloat(live.pressure_in) || 0;
        const outputPressure = parseFloat(live.pressure_out) || 0;
        drawGauge("input-pressure-gauge", inputPressure, 6, "#34d399"); // Emerald
        drawGauge("output-pressure-gauge", outputPressure, 6, "#fbbf24"); // Amber

        // Update pressure difference
        updatePressureDifference(inputPressure, outputPressure);

        // Update pressure flow bar visuals
        const inputFlow = document.getElementById("input-flow");
        const outputFlow = document.getElementById("output-flow");
        if (inputFlow && outputFlow) {
            inputFlow.style.width = `${Math.min(
                (inputPressure / 100) * 100,
                100
            )}%`;
            outputFlow.style.width = `${Math.min(
                (outputPressure / 100) * 100,
                100
            )}%`;
        }

        const timers = data.summary.timers;

        // Update timer text
        let currentTimerText = `${timers.current.name} (${timers.current.remaining_time} min)`;
        // Show open valve name if in Manual Mode and valve name is present
        if (
            timers.current.name &&
            timers.current.name.toLowerCase().includes("manual mode") &&
            timers.current.valve_name
        ) {
            currentTimerText += ` - ${timers.current.valve_name}`;
        }
        document.getElementById("dashboard-current-timer").textContent =
            currentTimerText;

        // Add: Show valves list if present
        const valvesDiv = document.getElementById("dashboard-current-valves");
        valvesDiv.innerHTML = `<strong>Valves:</strong> <span style="color: var(--text-primary); font-weight: 500;">${timers.current.valves}</span>`;

        // Enhanced visuals for Sump Status
        const motorImage = document.getElementById("motor-image");
        const motorStatusText = document.getElementById("motor-status-text");
        const motorStatusDot = document.getElementById("motor-status-dot");
        if (live.sump_status === "On") {
            motorImage.src = "images/motor-on.png";
            if (motorStatusText) motorStatusText.textContent = "Running";
            if (motorStatusDot) {
                motorStatusDot.classList.remove("inactive", "warning");
                motorStatusDot.classList.add("active");
            }
        } else {
            motorImage.src = "images/motor-off.png";
            if (motorStatusText) motorStatusText.textContent = "Stopped";
            if (motorStatusDot) {
                motorStatusDot.classList.remove("active", "warning");
                motorStatusDot.classList.add("inactive");
            }
        }

        // --- Timer image selection based on open valve(s) ---
        const timerImagesDiv = document.getElementById("timer-images");
        // Make the container flex and wrap for side-by-side images
        timerImagesDiv.style.display = "flex";
        timerImagesDiv.style.flexWrap = "wrap";
        timerImagesDiv.style.justifyContent = "center";
        timerImagesDiv.innerHTML = "";
        let openValveNos = [];
        if (timers.current.valves) {
            const valveArr = timers.current.valves.split("-");
            for (let i = 0; i < valveArr.length; i++) {
                if (valveArr[i] !== "0") {
                    openValveNos.push(valveArr[i]);
                }
            }
        }
        // Responsive valve image sizing
        let valveImgWidth = 150; // default large
        if (openValveNos.length > 2) valveImgWidth = 120;
        if (openValveNos.length > 4) valveImgWidth = 80;
        if (openValveNos.length > 6) valveImgWidth = 55;
        if (openValveNos.length === 0) {
            // No open valves, show default image
            const img = document.createElement("img");
            img.src = "images/none.png";
            img.alt = "No Valve";
            img.style.width = valveImgWidth + "px";
            timerImagesDiv.appendChild(img);
        } else {
            openValveNos.forEach((openValveNo) => {
                let valveName = "";
                if (openValveNo && valveDetails[openValveNo]) {
                    valveName =
                        valveDetails[openValveNo].valve_name?.toLowerCase() ||
                        "";
                }
                let imgSrc = "images/timer-default.png";
                if (valveName.includes("coco")) {
                    imgSrc = "images/coconut.png";
                } else if (valveName.includes("mango")) {
                    imgSrc = "images/mango.png";
                } else if (valveName.includes("house")) {
                    imgSrc = "images/house.png";
                } else if (valveName.includes("jamun")) {
                    imgSrc = "images/jamun.png";
                } else if (valveName.includes("amla")) {
                    imgSrc = "images/amla.png";
                } else if (valveName.includes("backwash")) {
                    imgSrc = "images/backwash.png";
                } else if (valveName.includes("grass")) {
                    imgSrc = "images/grass.png";
                } else if (valveName.includes("guava")) {
                    imgSrc = "images/guava.png";
                } else if (valveName.includes("onion")) {
                    imgSrc = "images/onion.png";
                } else if (valveName.includes("pome")) {
                    imgSrc = "images/pomegranate.png";
                } else if (valveName.includes("veg")) {
                    imgSrc = "images/veg.png";
                } else if (valveName.includes("kulam")) {
                    imgSrc = "images/kulam.png";
                } else if (valveName.includes("mulberry")) {
                    imgSrc = "images/mulberry.png";
                } else if (!valveName) {
                    imgSrc = "images/none.png";
                }
                const img = document.createElement("img");
                img.src = imgSrc;
                img.alt = valveName || "Valve";
                img.style.width = valveImgWidth + "px";
                img.style.transition = "width 0.2s";
                timerImagesDiv.appendChild(img);
            });
        }

        // Add: Enhanced visuals for Next Timer
        const nextTimerImage = document.getElementById("next-timer-image");
        const dashboardNextTimer = document.getElementById(
            "dashboard-next-timer"
        );
        if (timers.next && timers.next.name) {
            dashboardNextTimer.textContent = `${timers.next.name} (On Time: ${timers.next.on_time ?? "N/A"
                })`;
            let nextTimerName = timers.next.name?.toLowerCase() || "";
            if (nextTimerName.includes("coco")) {
                nextTimerImage.src = "images/coconut.png";
            } else if (nextTimerName.includes("mango")) {
                nextTimerImage.src = "images/mango.png";
            } else if (nextTimerName.includes("house")) {
                nextTimerImage.src = "images/house.png";
            } else if (nextTimerName.includes("jamun")) {
                nextTimerImage.src = "images/jamun.png";
            } else if (nextTimerName.includes("amla")) {
                nextTimerImage.src = "images/amla.png";
            } else if (nextTimerName.includes("backwash")) {
                nextTimerImage.src = "images/backwash.png";
            } else if (nextTimerName.includes("grass")) {
                nextTimerImage.src = "images/grass.png";
            } else if (nextTimerName.includes("guava")) {
                nextTimerImage.src = "images/guava.png";
            } else if (nextTimerName.includes("onion")) {
                nextTimerImage.src = "images/onion.png";
            } else if (nextTimerName.includes("pome")) {
                nextTimerImage.src = "images/pomegranate.png";
            } else if (nextTimerName.includes("manual")) {
                nextTimerImage.src = "images/timer-default.png";
            } else if (nextTimerName.includes("veg")) {
                nextTimerImage.src = "images/veg.png";
            } else if (nextTimerName.includes("kulam")) {
                nextTimerImage.src = "images/kulam.png";
            } else if (nextTimerName.includes("mulberry")) {
                nextTimerImage.src = "images/mulberry.png";
            } else {
                nextTimerImage.src = "images/none.png";
            }
        } else {
            dashboardNextTimer.textContent = "N/A";
            nextTimerImage.src = "images/none.png";
        }

        // Apply faded effect to timer images if motor is off
        if (live.sump_status === "Off") {
            Array.from(timerImagesDiv.querySelectorAll("img")).forEach(
                (img) => {
                    img.style.filter = "grayscale(100%) brightness(0.7)";
                }
            );
            nextTimerImage.style.filter = "grayscale(100%) brightness(0.7)";
        } else {
            Array.from(timerImagesDiv.querySelectorAll("img")).forEach(
                (img) => {
                    img.style.filter = "";
                }
            );
            nextTimerImage.style.filter = "";
        }
    } else {
        console.error("No data found for today's date.");
    }
}

// --- Timer History ---
function getTodayDate() {
    return new Date().toLocaleDateString('sv-SE');
}

/**
 * Groups consecutive timer log entries that represent a single interrupted
 * irrigation session into arrays.
 *
 * Rules (only group when the FIRST entry of a potential group has completed=0):
 *  1. Backwash sandwich:
 *     TimerA (completed=0) → Backwash → [TimerA optional]
 *  2. Gap resume (same timer, short gap ≤30 min):
 *     TimerA (completed=0) → TimerA (any completed)
 *
 * Two runs of the same timer that are both completed=1 are NEVER grouped.
 */
function groupTimerSessions(logs) {
    const GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
    const groups = [];
    let i = 0;

    while (i < logs.length) {
        const root = logs[i];
        const group = [root];
        let j = i + 1;

        // Only attempt to extend if the current (root) entry is NOT completed
        if (root.completed === '0') {
            const rootName = root.timer_name;

            while (j < logs.length) {
                const prev = group[group.length - 1];
                const next = logs[j];
                const prevIncomplete = prev.completed === '0';
                const nextIsBackwash = next.timer_name.toLowerCase().includes('backwash');

                // Case 1 – backwash follows an incomplete entry
                if (prevIncomplete && nextIsBackwash) {
                    group.push(next);
                    j++;
                    // If the very next entry is the root timer again → absorb it too
                    if (j < logs.length && logs[j].timer_name === rootName) {
                        group.push(logs[j]);
                        j++;
                    }
                    break; // session ends after the backwash (+ optional resume)
                }

                // Case 2 – same timer AND same valves resume after a short gap
                // Require on_valves to match so e.g. "Manual Mode" with different
                // valve sets are NOT incorrectly merged.
                if (prevIncomplete && next.timer_name === rootName
                    && next.on_valves === root.on_valves) {
                    const gapMs = new Date(next.dt) - new Date(prev.last_sync);
                    if (gapMs >= 0 && gapMs <= GAP_THRESHOLD_MS) {
                        group.push(next);
                        j++;
                        break; // one gap-resume per session is enough
                    }
                }

                break; // nothing matched – end the session
            }
        }

        groups.push(group);
        i = j;
    }

    return groups;
}

async function populateTimerDropdown() {
    const historyDropdown = document.getElementById(
        "history-timer-name-dropdown"
    );
    const pressureDropdown = document.getElementById("pressure-timer-dropdown");
    historyDropdown.innerHTML = '<option value="">All Timers</option>';
    pressureDropdown.innerHTML = '<option value="">Select Timer</option>';

    try {
        const response = await fetch(
            "https://dcon.mobitechwireless.com/v1/http/",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    action: "logs",
                    method: "timer_log",
                    serial_no: "MCON874Q000568",
                    from: getTodayDate(),
                    to: getTodayDate(),
                }),
            }
        );

        if (!response.ok) throw new Error("Failed to fetch timer data");

        const data = await response.json();
        const logs = data.log || [];

        // Extract unique timer names
        const uniqueTimers = [...new Set(logs.map((log) => log.timer_name))];

        uniqueTimers.forEach((timerName) => {
            // Add to history dropdown
            const historyOption = document.createElement("option");
            historyOption.value = timerName;
            historyOption.textContent = timerName;
            historyDropdown.appendChild(historyOption);

            // Add to pressure analysis dropdown
            const pressureOption = document.createElement("option");
            pressureOption.value = timerName;
            pressureOption.textContent = timerName;
            pressureDropdown.appendChild(pressureOption);
        });
    } catch (error) {
        console.error("Failed to populate timer dropdown:", error);
    }
}

async function fetchTimerHistory() {
    const timerHistoryContent = document.getElementById(
        "timer-history-content"
    );
    const fromDateInput = document.getElementById("history-from-date");
    const toDateInput = document.getElementById("history-to-date");
    const timerDropdown = document.getElementById(
        "history-timer-name-dropdown"
    );

    const fromDate = fromDateInput.value || getTodayDate();
    const toDate = toDateInput.value || getTodayDate();
    const timerName = timerDropdown.value;

    timerHistoryContent.innerHTML =
        '<p class="text-muted">Loading timer history...</p>';

    try {
        // First get the latest data for valve details from daily collection
        const latestSnapshot = await db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection(getTodayDate()) // Changed back to date-based collection
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();

        const latestData = !latestSnapshot.empty
            ? latestSnapshot.docs[0].data()
            : {};
        const valveDetails = latestData.summary?.valve_details || {}; // Fixed path to valve details

        // Fetch timer logs and fertigation logs in parallel
        const [timerResponse, fertigationLogs] = await Promise.all([
            fetch("https://dcon.mobitechwireless.com/v1/http/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    action: "logs",
                    method: "timer_log",
                    serial_no: "MCON874Q000568",
                    from: fromDate,
                    to: toDate,
                    ...(timerName && { timer_name: timerName }),
                }),
            }),
            // Updated fertigation_logs fetch logic to match loadFertigationHistory
            db
                .collection("irrigation_devices")
                .doc("MCON874Q000568")
                .collection("fertigation_logs")
                .orderBy("startTime", "desc")
                .get()
                .then((snapshot) => {
                    const fertigationLogs = snapshot.docs
                        .map((doc) => doc.data())
                        .filter((log) => {
                            let start, end;
                            // Safely handle Firestore Timestamp or raw date strings
                            try {
                                start = log.startTime?.toDate
                                    ? log.startTime.toDate()
                                    : new Date(log.startTime);
                            } catch {
                                start = new Date(0); // fallback very old date
                            }

                            try {
                                end = log.endTime?.toDate
                                    ? log.endTime.toDate()
                                    : log.endTime
                                        ? new Date(log.endTime)
                                        : new Date(); // if still active
                            } catch {
                                end = new Date(); // fallback to now
                            }

                            // Use full-day date range for matching
                            const rangeStart = new Date(`${fromDate}T00:00:00`);
                            const rangeEnd = new Date(`${toDate}T23:59:59`);
                            return start <= rangeEnd && end >= rangeStart && log.duration !== 0;
                        });
                    return fertigationLogs;
                }),
        ]);

        if (!timerResponse.ok) throw new Error("Failed to fetch timer history");
        const data = await timerResponse.json();
        const logs = data.log || [];

        if (logs.length === 0) {
            timerHistoryContent.innerHTML =
                '<p class="text-center text-muted">No timer history available for the selected date range.</p>';
            return;
        }

        const filteredLogs = timerName
            ? logs.filter((log, index) => {
                if (log.timer_name === timerName) return true;
                if (
                    index > 0 &&
                    logs[index - 1].timer_name === timerName &&
                    logs[index - 1].completed === "0" &&
                    log.timer_name.toLowerCase().includes("backwash")
                ) {
                    return true;
                }
                return false;
            })
            : logs;

        if (filteredLogs.length === 0) {
            timerHistoryContent.innerHTML =
                '<p class="text-center text-muted">No timer history available for the selected timer.</p>';
            return;
        }

        // ── helper: parse HH:MM or HH:MM-HH:MM run_time into total minutes ──────
        function parseRunMinutes(rt) {
            if (!rt) return 0;
            const part = String(rt).split('-')[0].trim();
            const bits = part.split(':').map(Number);
            if (bits.length === 2) return bits[0] * 60 + bits[1];
            return parseInt(rt) || 0;
        }

        // ── helper: build one timer row ──────────────────────────────────────────
        // accentColor: null for solo rows, '#fbbf24'/'#34d399' for grouped rows.
        // position: 'first' | 'mid' | 'last' | 'solo'
        function buildTimerRow(log, accentColor, position, fertigPct) {
            const fertigationInfo = wasFertigationActive(
                fertigationLogs,
                new Date(log.dt),
                new Date(log.last_sync)
            );
            let fertigationCell = '';
            if (fertigationInfo) {
                fertigationCell = `
              <div class="d-flex flex-column align-items-center">
                <div class="progress w-100 mb-1" style="height:5px; background:rgba(255,255,255,0.1);">
                  <div class="progress-bar bg-success" style="width:${fertigationInfo.percentage}%"></div>
                </div>
                <small>${fertigationInfo.duration}</small>
              </div>`;
            }

            let valveImages = '';
            let openValveNos = [];
            if (log.on_valves) {
                const valveArr = log.on_valves.split('-');
                for (let k = 0; k < valveArr.length; k++) {
                    if (valveArr[k] !== '0') openValveNos.push(valveArr[k]);
                }
                openValveNos.forEach((valveNo) => {
                    let valveName = '';
                    if (valveNo && valveDetails[valveNo]) {
                        valveName = valveDetails[valveNo].valve_name?.toLowerCase() || '';
                    }
                    let imgSrc = 'images/timer-default.png';
                    if (valveName.includes('coco')) imgSrc = 'images/coconut.png';
                    else if (valveName.includes('mango')) imgSrc = 'images/mango.png';
                    else if (valveName.includes('house')) imgSrc = 'images/house.png';
                    else if (valveName.includes('jamun')) imgSrc = 'images/jamun.png';
                    else if (valveName.includes('amla')) imgSrc = 'images/amla.png';
                    else if (valveName.includes('backwash')) imgSrc = 'images/backwash.png';
                    else if (valveName.includes('grass')) imgSrc = 'images/grass.png';
                    else if (valveName.includes('guava') || valveName.includes('gova')) imgSrc = 'images/guava.png';
                    else if (valveName.includes('onion')) imgSrc = 'images/onion.png';
                    else if (valveName.includes('pome')) imgSrc = 'images/pomegranate.png';
                    else if (valveName.includes('veg')) imgSrc = 'images/veg.png';
                    else if (valveName.includes('kulam')) imgSrc = 'images/kulam.png';
                    else if (valveName.includes('mulberry')) imgSrc = 'images/mulberry.png';
                    else if (!valveName) imgSrc = 'images/none.png';
                    valveImages += `<div class="d-inline-block text-center" style="margin:2px;"><img src="${imgSrc}" alt="Valve ${valveNo}" style="width:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));"></div>`;
                });
            }
            if (!valveImages) {
                valveImages = `<div class="d-inline-block text-center" style="margin:2px;"><img src="images/none.png" alt="No Valve" style="width:32px;opacity:0.5;"></div>`;
            }

            const valveNamesCell = openValveNos.length
                ? openValveNos.map(v => valveDetails[v]?.valve_name || `Valve ${v}`).join(', ')
                : '-';

            // Visual accent for grouped rows.
            // box-shadow inset renders inside the td regardless of border-radius,
            // unlike border-left which is clipped by border-radius and invisible.
            const isGrouped = accentColor !== null;
            const accentAlpha = isGrouped
                ? (accentColor === '#fbbf24' ? 'rgba(251,191,36,0.06)' : 'rgba(52,211,153,0.06)')
                : 'transparent';
            const rowBg = isGrouped
                ? `linear-gradient(to right, ${accentAlpha}, rgba(255,255,255,0.04))`
                : 'rgba(255,255,255,0.03)';

            // Border radius for the first td changes based on position in group
            let tlr = '12px', blr = '12px'; // solo default
            if (position === 'first') { tlr = '12px'; blr = '0'; }
            else if (position === 'mid') { tlr = '0'; blr = '0'; }
            else if (position === 'last') { tlr = '0'; blr = '12px'; }

            // The vertical stripe: use inset box-shadow which is NOT clipped by border-radius
            const firstTdStyle = isGrouped
                ? `box-shadow: inset 4px 0 0 ${accentColor}; border-top-left-radius:${tlr}; border-bottom-left-radius:${blr};`
                : 'border-top-left-radius:12px; border-bottom-left-radius:12px;';

            const fertPct = fertigationInfo ? fertigationInfo.percentage : 0;

            return `
            <tr class="timer-history-row" style="background:${rowBg}; cursor:pointer; transition:background 0.15s;"
                onmouseover="this.style.background='rgba(255,255,255,0.09)';"
                onmouseout="this.style.background='${rowBg}';"
                data-start="${log.dt}"
                data-end="${log.last_sync}"
                data-name="${log.timer_name}"
                data-runtime="${parseRunMinutes(log.run_time)}"
                data-valves="${log.on_valves || ''}"
                data-completed="${log.completed}"
                data-fertpct="${fertPct}"
                data-timer="${log.timer_name}">
              <td class="border-0 px-3 py-3" style="${firstTdStyle}">
                <div class="fw-bold text-light"><i class="far fa-clock text-info me-2"></i>${log.dt.split(' ')[1] || log.dt}</div>
                <div class="small text-muted mt-1" style="margin-left:20px;">${log.dt.split(' ')[0] || ''}</div>
              </td>
              <td class="border-0 px-3 py-3">
                <div class="fw-bold text-light">${log.last_sync.split(' ')[1] || log.last_sync}</div>
                <div class="small text-muted mt-1">${log.last_sync.split(' ')[0] || ''}</div>
              </td>
              <td class="border-0 px-3 py-3">
                <span class="badge bg-secondary bg-opacity-25 text-light px-3 py-2 border border-secondary border-opacity-50 rounded-pill"><i class="fas fa-tag me-1 text-primary"></i> ${log.timer_name}</span>
              </td>
              <td class="border-0 px-3 py-3">
                <div class="fw-bold text-white"><i class="fas fa-hourglass-half text-muted me-1"></i>${log.run_time} <span class="small fw-normal text-muted">mins</span></div>
              </td>
              <td class="border-0 px-3 py-3">
                <span class="text-muted fw-bold">${log.on_valves}</span>
              </td>
              <td class="border-0 px-3 py-3 text-center">
                <div class="d-flex flex-wrap justify-content-center gap-1">${valveImages}</div>
              </td>
              <td class="border-0 px-3 py-3">
                <div class="small text-muted text-truncate" style="max-width:150px;" title="${valveNamesCell}">${valveNamesCell}</div>
              </td>
              <td class="border-0 px-3 py-3">
                ${log.completed === '1'
                    ? '<span class="badge bg-success bg-opacity-25 text-success px-3 py-2 rounded-pill border border-success border-opacity-25"><i class="fas fa-check-circle me-1"></i>Yes</span>'
                    : '<span class="badge bg-warning bg-opacity-25 text-warning px-3 py-2 rounded-pill border border-warning border-opacity-25"><i class="fas fa-bolt me-1"></i>Interrupted</span>'}
              </td>
              <td class="border-0 px-3 py-3" style="border-top-right-radius:12px; border-bottom-right-radius:12px;">
                <div style="min-width:100px;">${fertigationInfo ? fertigationCell : '<span class="text-muted small">None</span>'}</div>
              </td>
            </tr>`;
        }

        // ── render rows – thin session header before each group ────────────────────
        const sessionGroups = groupTimerSessions(filteredLogs);

        let tbodyHTML = '';
        sessionGroups.forEach((group) => {
            if (group.length === 1) {
                const solo = group[0];
                const isCompleted = solo.completed === '1';
                const soloColor = isCompleted ? 'rgba(160,160,160,0.8)' : 'rgba(251,191,36,0.85)';
                const soloBg = isCompleted ? 'rgba(160,160,160,0.08)' : 'rgba(251,191,36,0.08)';
                const soloBorder = isCompleted ? 'rgba(160,160,160,0.25)' : 'rgba(251,191,36,0.3)';
                const soloIcon = isCompleted ? '✓' : '⚠';
                const soloLabel = isCompleted ? 'Completed' : 'Interrupted';
                tbodyHTML += `
            <tr class="session-group-header" style="background:transparent;">
              <td colspan="9" class="border-0 pb-0 pt-2 px-3">
                <span style="
                  display:inline-flex; align-items:center; gap:5px;
                  font-size:10px; font-weight:700; letter-spacing:0.08em;
                  text-transform:uppercase; color:${soloColor};
                  background:${soloBg}; border:1px solid ${soloBorder};
                  border-radius:999px; padding:2px 10px;
                ">${soloIcon} ${soloLabel}</span>
              </td>
            </tr>`;
                tbodyHTML += buildTimerRow(solo, null, 'solo');
                return;
            }

            const hasBackwash = group.some(l => l.timer_name.toLowerCase().includes('backwash'));
            const accentColor = hasBackwash ? '#fbbf24' : '#34d399';
            const sessionLabel = hasBackwash ? 'Backwash Session' : 'Resumed Session';
            const sessionIcon = hasBackwash ? '↺' : '⚡';

            // Thin header row – not a timer-history-row so sort ignores it
            tbodyHTML += `
            <tr class="session-group-header" style="background:transparent;">
              <td colspan="9" class="border-0 pb-0 pt-2 px-3">
                <span style="
                  display:inline-flex; align-items:center; gap:5px;
                  font-size:10px; font-weight:700; letter-spacing:0.08em;
                  text-transform:uppercase; color:${accentColor};
                  background:${accentColor}20; border:1px solid ${accentColor}40;
                  border-radius:999px; padding:2px 10px;
                ">${sessionIcon} ${sessionLabel}</span>
              </td>
            </tr>`;

            group.forEach((log, idx) => {
                const position = idx === 0 ? 'first' : idx === group.length - 1 ? 'last' : 'mid';
                tbodyHTML += buildTimerRow(log, accentColor, position);
            });
        });

        const table = document.createElement('table');
        table.className = 'table mb-0 align-middle text-white';
        table.style.borderCollapse = 'separate';
        table.style.borderSpacing = '0 5px';
        table.innerHTML = `
      <thead style="background:rgba(255,255,255,0.02);">
        <tr>
          <th class="sortable border-0 text-muted fw-normal" style="border-top-left-radius:8px;border-bottom-left-radius:8px;padding:12px 16px;" data-sort="date">Start Time <span class="sort-icon">⇅</span></th>
          <th class="sortable border-0 text-muted fw-normal" style="padding:12px 16px;" data-sort="endTime">End Time <span class="sort-icon">⇅</span></th>
          <th class="sortable border-0 text-muted fw-normal" style="padding:12px 16px;" data-sort="name">Timer Name <span class="sort-icon">⇅</span></th>
          <th class="sortable border-0 text-muted fw-normal" style="padding:12px 16px;" data-sort="runTime">Run Time <span class="sort-icon">⇅</span></th>
          <th class="sortable border-0 text-muted fw-normal" style="padding:12px 16px;" data-sort="valves">Valves <span class="sort-icon">⇅</span></th>
          <th class="border-0 text-muted fw-normal text-center" style="padding:12px 16px;">Active Valves</th>
          <th class="border-0 text-muted fw-normal" style="padding:12px 16px;">Valve Names</th>
          <th class="sortable border-0 text-muted fw-normal" style="padding:12px 16px;" data-sort="completed">Status <span class="sort-icon">⇅</span></th>
          <th class="sortable border-0 text-muted fw-normal" style="border-top-right-radius:8px;border-bottom-right-radius:8px;padding:12px 16px;" data-sort="fertigation">Fertigation <span class="sort-icon">⇅</span></th>
        </tr>
      </thead>
      <tbody>${tbodyHTML}</tbody>
    `;
        timerHistoryContent.innerHTML = '';
        const responsiveWrapper = document.createElement('div');
        responsiveWrapper.className = 'table-responsive';
        responsiveWrapper.appendChild(table);
        timerHistoryContent.appendChild(responsiveWrapper);

        // ── sort (reads from tr.dataset – index-independent) ─────────────────────
        let currentSort = { column: null, direction: 'asc' };

        function sortTable(column) {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr.timer-history-row'));

            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }

            table.querySelectorAll('.sort-icon').forEach(ic => (ic.textContent = '⇅'));
            const ic = table.querySelector(`[data-sort="${column}"] .sort-icon`);
            if (ic) ic.textContent = currentSort.direction === 'asc' ? '↑' : '↓';

            rows.sort((a, b) => {
                let av, bv;
                switch (column) {
                    case 'date': av = new Date(a.dataset.start || 0); bv = new Date(b.dataset.start || 0); break;
                    case 'endTime': av = new Date(a.dataset.end || 0); bv = new Date(b.dataset.end || 0); break;
                    case 'runTime': av = parseInt(a.dataset.runtime) || 0; bv = parseInt(b.dataset.runtime) || 0; break;
                    case 'valves': av = (a.dataset.valves || '').toLowerCase(); bv = (b.dataset.valves || '').toLowerCase(); break;
                    case 'name': av = (a.dataset.name || '').toLowerCase(); bv = (b.dataset.name || '').toLowerCase(); break;
                    case 'completed': av = parseInt(a.dataset.completed) || 0; bv = parseInt(b.dataset.completed) || 0; break;
                    case 'fertigation': av = parseFloat(a.dataset.fertpct) || 0; bv = parseFloat(b.dataset.fertpct) || 0; break;
                    default: av = ''; bv = '';
                }
                if (av < bv) return currentSort.direction === 'asc' ? -1 : 1;
                if (av > bv) return currentSort.direction === 'asc' ? 1 : -1;
                return 0;
            });

            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));
        }

        table.querySelectorAll('.sortable').forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => sortTable(header.dataset.sort));
        });

        // Switch to pressure analysis tab if a specific timer is selected
        if (timerName) {
            const pressureNavBtn = document.querySelector('[data-target="#pressure-analysis"]');
            if (pressureNavBtn) pressureNavBtn.click();
            const pressureDropdown = document.getElementById('pressure-timer-dropdown');
            if (pressureDropdown) pressureDropdown.value = timerName;
            setTimeout(() => {
                const analyzeBtn = document.getElementById('analyze-pressure-btn');
                if (analyzeBtn) analyzeBtn.click();
            }, 300);
        }

        attachTimerClickHandlers();
    } catch (error) {
        console.error(error);
        timerHistoryContent.innerHTML =
            '<p class="text-center text-danger">Failed to load timer history.</p>';
    }
}

// --- Helper function to fetch fertigation logs for a date range ---
async function fetchFertigationLogsForDateRange(fromDate, toDate) {
    const allLogs = [];
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);

    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = d.toISOString().split("T")[0];
        const doc = await db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection(currentDate)
            .doc("FERTIGATION_LOGS")
            .get();

        if (doc.exists) {
            const data = doc.data();
            allLogs.push(...(data.logs || []));
        }
    }

    return allLogs;
}

// --- Helper function to format time duration ---
function formatTimeDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins} m` : `${mins} m`;
}

// --- Helper function to get overlapping time between timer and fertigation ---
function getFertigationOverlap(
    timerStart,
    timerEnd,
    fertigationStart,
    fertigationEnd
) {
    const start = Math.max(timerStart.getTime(), fertigationStart.getTime());
    const end = Math.min(timerEnd.getTime(), fertigationEnd.getTime());
    if (start < end) {
        const overlapMinutes = Math.round((end - start) / (1000 * 60));
        const totalTimerMinutes = Math.round(
            (timerEnd - timerStart) / (1000 * 60)
        );
        return {
            duration: formatTimeDuration(overlapMinutes),
            percentage: Math.round((overlapMinutes / totalTimerMinutes) * 100),
        };
    }
    return null;
}

function wasFertigationActive(fertigationLogs, timerStart, timerEnd) {
    const overlaps = fertigationLogs
        .map((log) => {
            const fertigationStart = log.startTime.toDate();
            const fertigationEnd = log.endTime
                ? log.endTime.toDate()
                : new Date();
            return getFertigationOverlap(
                timerStart,
                timerEnd,
                fertigationStart,
                fertigationEnd
            );
        })
        .filter((overlap) => overlap !== null);

    if (overlaps.length === 0) return null;

    // Return the total duration and maximum overlap percentage
    const totalDuration = overlaps.reduce((sum, curr) => {
        const minutes = parseInt(curr.duration);
        return sum + minutes;
    }, 0);

    return {
        duration: formatTimeDuration(totalDuration),
        percentage: Math.max(...overlaps.map((o) => o.percentage)),
    };
}


// --- Pressure Graphs ---
async function graphAllPressures(logs) {
    const chartContainer = document.getElementById("pressure-chart-container");
    chartContainer.innerHTML =
        '<p class="text-muted">Loading pressure data...</p>';

    try {
        // Fetch pressure data for each timer segment
        const pressureDataPromises = logs.map(async (log) => {
            const linktext = `https://dcon.mobitechwireless.com/v1/http/?action=reports&type=pressure_timer&serial_no=MCON874Q000568&from=${encodeURIComponent(
                log.dt
            )
                }& to=${encodeURIComponent(log.last_sync)}& product=DCON`;
            const response = await fetch(linktext);
            if (!response.ok) throw new Error("Failed to fetch pressure data");
            const data = await response.json();
            return {
                timestamp: log.dt,
                data: data.data || [],
            };
        });

        const allPressureData = await Promise.all(pressureDataPromises);

        // Prepare datasets for each timer segment
        const datasets = [];
        let allPressureValues = [];

        // Define backwash color
        const backwashColor = "rgba(251, 191, 36, 0.25)";
        let shownBackwash = false;

        allPressureData.forEach((segment, index) => {
            if (segment.data.length > 0) {
                const isBackwash = logs[index].timer_name
                    .toLowerCase()
                    .includes("backwash");
                const hue = index * (360 / allPressureData.length);
                const segmentColor = isBackwash
                    ? backwashColor
                    : `hsla(${hue}, 70 %, 50 %, 0.2)`;
                const inputColor = "#34d399";
                const outputColor = "#fbbf24";

                // Extract pressure values
                const inputValues = segment.data.map((entry) =>
                    parseFloat(entry.pressure.split("-")[0])
                );
                const outputValues = segment.data.map((entry) =>
                    parseFloat(entry.pressure.split("-")[1])
                );
                allPressureValues = [
                    ...allPressureValues,
                    ...inputValues,
                    ...outputValues,
                ];

                // Calculate average pressure and duration for tooltip
                const avgInput = inputValues.length ? (inputValues.reduce((a, b) => a + b, 0) / inputValues.length).toFixed(2) : 0;
                const avgOutput = outputValues.length ? (outputValues.reduce((a, b) => a + b, 0) / outputValues.length).toFixed(2) : 0;

                const timeStart = new Date(segment.data[0].dt).getTime();
                const timeEnd = new Date(segment.data[segment.data.length - 1].dt).getTime();
                const startTimeStr = new Date(timeStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const endTimeStr = new Date(timeEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const durationMins = Math.round((timeEnd - timeStart) / 60000);

                const segmentInputColor = `hsla(${hue}, 80 %, 55 %, 1)`;
                const segmentOutputColor = `hsla(${hue}, 80 %, 75 %, 1)`;

                const timerName = logs[index].timer_name;
                let labelName = timerName;

                // Skip duplicate backwash entries in legend
                if (isBackwash && shownBackwash) {
                    labelName = ""; // Empty label to hide from legend
                }
                if (isBackwash) {
                    shownBackwash = true;
                }

                datasets.push(
                    {
                        label: "Input Pressure",
                        data: segment.data.map((entry) => ({
                            x: entry.dt,
                            y: parseFloat(entry.pressure.split("-")[0]),
                        })),
                        borderColor: isBackwash ? inputColor : segmentInputColor,
                        backgroundColor: segmentColor,
                        fill: true,
                        segment: segment.timestamp,
                        pointRadius: 2,
                        customInfo: { timerName: timerName, start: startTimeStr, end: endTimeStr, duration: durationMins, avg: avgInput }
                    },
                    {
                        label: "Output Pressure",
                        data: segment.data.map((entry) => ({
                            x: entry.dt,
                            y: parseFloat(entry.pressure.split("-")[1]),
                        })),
                        borderColor: isBackwash ? outputColor : segmentOutputColor,
                        backgroundColor: "transparent",
                        fill: false,
                        segment: segment.timestamp,
                        borderDash: [5, 5],
                        pointRadius: 2,
                        customInfo: { timerName: timerName, start: startTimeStr, end: endTimeStr, duration: durationMins, avg: avgOutput }
                    }
                );
            }
        });

        // Calculate min/max pressure values
        const minPressure = Math.max(
            0,
            Math.floor(
                Math.min(...allPressureValues.filter((p) => p > 0)) - 0.5
            )
        );
        const maxPressure = Math.ceil(Math.max(...allPressureValues) + 0.5);

        chartContainer.innerHTML = `
        <div class="text-center mb-4">
            <small class="text-muted"><i class="fas fa-info-circle me-1"></i>Solid lines: Input Pressure | Dashed lines: Output Pressure</small>
      </div >
        <div style="height: 480px;">
            <canvas id="pressure-chart"></canvas>
        </div>
    `;
        const ctx = document.getElementById("pressure-chart").getContext("2d");
        const instanceInfoPlugin = {
            id: 'instanceInfoPlugin',
            afterDraw: (chart) => {
                const { ctx, chartArea, scales } = chart;
                ctx.save();
                chart.data.datasets.forEach((dataset) => {
                    if (dataset.label === "Input Pressure" && dataset.customInfo) {
                        const info = dataset.customInfo;
                        const startX = scales.x.getPixelForValue(dataset.data[0].x);
                        const endX = scales.x.getPixelForValue(dataset.data[dataset.data.length - 1].x);
                        const midX = (startX + endX) / 2;

                        ctx.beginPath();
                        ctx.setLineDash([5, 5]);
                        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                        ctx.moveTo(startX, chartArea.top);
                        ctx.lineTo(startX, chartArea.bottom + 10);
                        ctx.stroke();

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'top';
                        ctx.setLineDash([]);
                        ctx.fillStyle = dataset.borderColor;
                        ctx.font = '600 11px Inter, sans-serif';
                        ctx.fillText(`${info.start} - ${info.end} `, midX, chartArea.bottom + 15);
                        ctx.fillStyle = '#8899aa';
                        ctx.font = '500 10px Inter, sans-serif';
                        ctx.fillText(`${info.avg} bar avg`, midX, chartArea.bottom + 30);
                    }
                });
                ctx.restore();
            }
        };

        new Chart(ctx, {
            type: "line",
            plugins: [instanceInfoPlugin],
            data: {
                datasets: datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        bottom: 45
                    }
                },
                plugins: {
                    legend: {
                        position: "top",
                        labels: {
                            color: "#f0f4f8",
                            usePointStyle: true,
                            boxWidth: 8,
                            filter: function (item, chart) {
                                return item.datasetIndex === 0 || item.datasetIndex === 1;
                            }
                        }
                    },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                        backgroundColor: 'rgba(10, 18, 32, 0.92)',
                        titleColor: '#f0f4f8',
                        bodyColor: '#f0f4f8',
                        borderColor: 'rgba(52, 211, 153, 0.15)',
                        borderWidth: 1,
                        callbacks: {
                            afterBody: function (context) {
                                if (context && context.length > 0) {
                                    const ds = context[0].dataset;
                                    if (ds.customInfo) {
                                        return [
                                            '',
                                            `Time Range: ${ds.customInfo.start} - ${ds.customInfo.end} (${ds.customInfo.duration}m)`,
                                            `Avg Pressure: ${ds.customInfo.avg} bar`
                                        ];
                                    }
                                }
                                return [];
                            }
                        }
                    },
                },
                interaction: {
                    mode: "nearest",
                    axis: "x",
                    intersect: false,
                },
                scales: {
                    x: {
                        grid: {
                            color: "rgba(255,255,255,0.04)",
                        },
                        ticks: {
                            display: false // Hide cluttered timestamps
                        }
                    },
                    y: {
                        title: { display: true, text: "Pressure (bar)", color: "#8899aa" },
                        min: minPressure,
                        max: maxPressure,
                        ticks: {
                            stepSize: 0.5,
                            color: "#8899aa"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.04)",
                        },
                    },
                },
            },
        });
    } catch (error) {
        console.error("Failed to graph pressures:", error);
        chartContainer.innerHTML =
            '<p class="text-danger">Failed to load pressure data.</p>';
    }
}

async function fetchPressureData(from, to) {
    const chartContainer = document.getElementById("pressure-chart-container");
    chartContainer.innerHTML =
        '<p class="text-muted">Loading pressure data...</p>';

    try {
        const response = await fetch(
            `https://dcon.mobitechwireless.com/v1/http/?action=reports&type=pressure_timer&serial_no=MCON874Q000568&from=${encodeURIComponent(
                from
            )
            }& to=${encodeURIComponent(to)}& product=DCON`
        );
        if (!response.ok) throw new Error("Failed to fetch pressure data");

        const data = await response.json();
        const pressureData = data.data || [];

        if (pressureData.length === 0) {
            chartContainer.innerHTML =
                '<p class="text-muted">No pressure data available for the selected time period.</p>';
            return;
        }

        // Prepare data for Chart.js
        const labels = pressureData.map((entry) => entry.dt);
        const inputPressure = pressureData.map((entry) =>
            parseFloat(entry.pressure.split("-")[0])
        );
        const outputPressure = pressureData.map((entry) =>
            parseFloat(entry.pressure.split("-")[1])
        );

        // Create chart
        chartContainer.innerHTML = `
    < div style = "height: 500px;" >
        <canvas id="pressure-chart"></canvas>
      </div >
    `;
        const ctx = document.getElementById("pressure-chart").getContext("2d");
        new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Input Pressure (bar)",
                        data: inputPressure,
                        borderColor: "#34d399",
                        fill: false,
                    },
                    {
                        label: "Output Pressure (bar)",
                        data: outputPressure,
                        borderColor: "#fbbf24",
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allow chart to expand
                plugins: {
                    legend: { position: "top" },
                },
                scales: {
                    x: { title: { display: true, text: "Timestamp" } },
                    y: { title: { display: true, text: "Pressure (bar)" } },
                },
            },
        });
    } catch (error) {
        console.error(error);
        chartContainer.innerHTML =
            '<p class="text-danger">Failed to load pressure data.</p>';
    }
}

function attachTimerClickHandlers() {
    const timerRows = document.querySelectorAll(".timer-history-row");
    timerRows.forEach((row) => {
        row.addEventListener("click", () => {
            const from = row.dataset.start;
            const to = row.dataset.end;
            const timerName = row.dataset.timer;

            // Navigate to pressure tab
            const pressureNavBtn = document.querySelector('[data-target="#pressure-analysis"]');
            if (pressureNavBtn) pressureNavBtn.click();

            // Set filters match the dropdown values if possible
            const pressureDropdown = document.getElementById("pressure-timer-dropdown");
            if (pressureDropdown) pressureDropdown.value = timerName;

            const fromDateInput = document.getElementById("pressure-from-date");
            const toDateInput = document.getElementById("pressure-to-date");

            // Extract YYYY-MM-DD from 'YYYY-MM-DD HH:MM:SS'
            if (from && fromDateInput) fromDateInput.value = from.split(' ')[0];
            if (to && toDateInput) toDateInput.value = to.split(' ')[0];

            // Small delay to allow tab opening UI to settle
            setTimeout(() => {
                const analyzeBtn = document.getElementById("analyze-pressure-btn");
                if (analyzeBtn) analyzeBtn.click();
            }, 300);
        });
    });
}

// --- AI Insights with local anomaly detection and improved display ---
async function updateAiInsights() {
    const insightsDiv = document.getElementById("ai-insights");
    insightsDiv.innerHTML =
        '<p class="text-muted">Analyzing system data...</p>';

    // Helper: Detect anomalies in the latest data vs recent history
    async function detectAnomalies(live, history) {
        const anomalies = [];

        // Pressure difference anomaly
        const pressureDiff = Math.abs(live.pressure_in - live.pressure_out);
        const avgPressureDiff =
            history.reduce(
                (sum, d) =>
                    sum +
                    Math.abs((d.pressure_in || 0) - (d.pressure_out || 0)),
                0
            ) / history.length || 0;
        if (pressureDiff > avgPressureDiff * 1.5 && pressureDiff > 0.5) {
            anomalies.push(
                `Pressure difference(${pressureDiff.toFixed(
                    2
                )
                } bar) is higher than normal(${avgPressureDiff.toFixed(
                    2
                )
                } bar avg).`
            );
        }

        // Voltage anomalies
        ["voltage_phase_1", "voltage_phase_2", "voltage_phase_3"].forEach(
            (phase) => {
                const avg =
                    history.reduce(
                        (sum, d) => sum + parseFloat(d[phase] || 0),
                        0
                    ) / history.length || 0;
                if (avg > 0 && live[phase] < avg * 0.8) {
                    anomalies.push(
                        `${phase.replace(/_/g, " ")} is low(${live[phase]
                        }V, avg ${avg.toFixed(1)}V).`
                    );
                }
            }
        );

        // Current imbalance
        const currents = [
            "current_phase_1",
            "current_phase_2",
            "current_phase_3",
        ].map((k) => parseFloat(live[k]) || 0);
        const maxCurr = Math.max(...currents);
        const minCurr = Math.min(...currents);
        if (maxCurr - minCurr > 2) {
            anomalies.push(
                `Current imbalance detected(Range: ${minCurr}A - ${maxCurr}A).`
            );
        }

        // Motor on but no output pressure
        if (live.sump_status === "On" && live.pressure_out < 0.5) {
            anomalies.push("Motor is ON but output pressure is too low.");
        }

        // Motor off but high current draw
        if (live.sump_status === "Off" && currents.some((c) => c > 0.5)) {
            anomalies.push(
                "Motor appears OFF but current detected — possible relay issue."
            );
        }

        return anomalies;
    }

    try {
        const snapshot = await db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection(new Date().toISOString().split("T")[0])
            .orderBy("timestamp", "desc")
            .limit(10)
            .get();

        if (!snapshot.empty) {
            const docs = snapshot.docs.map((d) => d.data().summary.live_data);
            const live = docs[0];
            const history = docs.slice(1);

            const anomalies = await detectAnomalies(live, history);

            if (anomalies.length === 0) {
                insightsDiv.innerHTML = `
    <div class="alert alert-success">
            ✅ No anomalies detected.All systems operating normally.
          </div > `;
            } else {
                const listItems = anomalies
                    .map((a) => `<li>${a}</li>`)
                    .join("");
                insightsDiv.innerHTML = `
    <div class="alert alert-warning text-start">
            <strong>⚠️ Anomalies Detected:</strong>
            <ul>${listItems}</ul>
          </div > `;
            }
        } else {
            insightsDiv.innerHTML =
                '<p class="text-muted">No recent data available for analysis.</p>';
        }
    } catch (error) {
        console.error("AI anomaly analysis failed:", error);
        insightsDiv.innerHTML =
            '<p class="text-danger">Failed to analyze system anomalies.</p>';
    }
}

// --- Manual AI anomaly test function ---
async function runAiAnomalyTest() {
    const insightsDiv = document.getElementById("ai-insights");
    insightsDiv.innerHTML = '<p class="text-muted">Running AI analysis...</p>';

    try {
        // Run updateAiInsights and add visual feedback
        await updateAiInsights();

        // Add animation to show test was completed
        const alertElement = insightsDiv.querySelector(".alert");
        if (alertElement) {
            alertElement.classList.add("animate__animated", "animate__pulse");
            setTimeout(() => {
                alertElement.classList.remove(
                    "animate__animated",
                    "animate__pulse"
                );
            }, 1000);
        }
    } catch (error) {
        console.error("AI test failed:", error);
        insightsDiv.innerHTML =
            '<p class="text-danger">AI analysis test failed. Please try again.</p>';
    }
}

function getBaseUrl() {
    return "/api";
}

// --- Dashboard Data Fetch: Triggers Cloud Function before loading ---
async function fetchAllDashboardData() {
    const cloudFunctionUrl = `${getBaseUrl()}/fetchIrrigationDataOnDemand`;
    try {
        await fetch(cloudFunctionUrl);
    } catch (err) {
        console.error("Failed to trigger on-demand data fetch:", err);
    }
    // Continue with Firestore-based fetches regardless of function call result
    await Promise.all([
        fetchLiveData(),
        populateDashboardOverview(),
        fetchTimerHistory(),
        fetchSupplyMotorStatus(),
        fetchSecondarySupplyMotorStatus(),
        updateAiInsights(),
        generateSmartRecommendation(),
    ]);
}

// Fetch every 5 minutes
setInterval(fetchAllDashboardData, 5 * 60 * 1000);

document.addEventListener("DOMContentLoaded", () => {
    populateTimerDropdown();
    document
        .getElementById("fetch-history-btn")
        .addEventListener("click", fetchTimerHistory);
    document
        .getElementById("analyze-pressure-btn")
        .addEventListener("click", () => {
            const timerName = document.getElementById("pressure-timer-dropdown").value;
            const fromDate = document.getElementById("pressure-from-date").value || getTodayDate();
            const toDate = document.getElementById("pressure-to-date").value || getTodayDate();

            const includeBackwash = document.getElementById("include-backwash-toggle").checked;

            if (timerName) {
                fetch("https://dcon.mobitechwireless.com/v1/http/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        action: "logs",
                        method: "timer_log",
                        serial_no: "MCON874Q000568",
                        from: fromDate,
                        to: toDate,
                        // timer_name: timerName, // Omit to fetch all logs for the range
                    }),
                })
                    .then((response) => response.json())
                    .then((data) => {
                        if (data.log && data.log.length > 0) {
                            const mainLogs = data.log.filter(log => log.timer_name === timerName)
                                .sort((a, b) => new Date(a.dt) - new Date(b.dt));

                            let filteredLogs = [...mainLogs];

                            if (includeBackwash && mainLogs.length >= 2) {
                                const backwashLogs = data.log.filter(log =>
                                    log.timer_name.toLowerCase().includes("backwash")
                                );

                                const firstMainStart = new Date(mainLogs[0].dt);
                                const lastMainEnd = new Date(mainLogs[mainLogs.length - 1].last_sync || mainLogs[mainLogs.length - 1].dt);

                                const sandwichedBackwash = backwashLogs.filter(bw => {
                                    const bwStart = new Date(bw.dt);
                                    const bwEnd = new Date(bw.last_sync || bw.dt);

                                    // Must be after the first main log started and before the last one ended
                                    // AND must specifically be between two instances (not just inside the total range)
                                    // But the user's logic "in between two of our main instances" is usually covered by
                                    // checking if it's within the [firstStart, lastEnd] range of the main timer session.
                                    return bwStart > firstMainStart && bwEnd < lastMainEnd;
                                });

                                filteredLogs = [...filteredLogs, ...sandwichedBackwash];
                            }

                            if (filteredLogs.length > 0) {
                                // Sort by dt to ensure chronological graph segments
                                filteredLogs.sort((a, b) => new Date(a.dt) - new Date(b.dt));
                                graphAllPressures(filteredLogs);
                            } else {
                                document.getElementById("pressure-chart-container").innerHTML = '<p class="text-muted text-center mt-5 pt-5"><i class="fas fa-exclamation-circle fs-1 mb-3 opacity-50"></i><br>No pressure data available for the selected parameters.</p>';
                            }
                        } else {
                            document.getElementById("pressure-chart-container").innerHTML = '<p class="text-muted text-center mt-5 pt-5"><i class="fas fa-exclamation-circle fs-1 mb-3 opacity-50"></i><br>No runtime data found for the selected period.</p>';
                        }
                    })
                    .catch((error) =>
                        console.error("Failed to fetch timer data:", error)
                    );
            }
        });
});

// --- Fertigation Management ---
async function getActiveFertigationLog() {
    const logsRef = db
        .collection("irrigation_devices")
        .doc("MCON874Q000568")
        .collection("fertigation_logs");

    const activeQuery = await logsRef
        .where("endTime", "==", null)
        .limit(1)
        .get();

    return activeQuery.empty ? null : activeQuery.docs[0];
}

function updateFertigationStatus(isActive, startTime, notes) {
    const statusDot = document.getElementById("fertigation-status-dot");
    const statusText = document.getElementById("fertigation-status-text");
    const timerDisplay = document.getElementById("fertigation-timer");
    const notesDisplay = document.getElementById("fertigation-notes-display");
    const statusCard = document.getElementById("fertigation-status-card");

    if (isActive) {
        statusDot.style.backgroundColor = "#34d399";
        statusText.textContent = "Active";
        statusCard.classList.add("border-success");

        // Update timer display
        function updateTimer() {
            const now = new Date();
            const duration = Math.floor((now - startTime) / 1000 / 60); // minutes
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;
            timerDisplay.textContent = `Duration: ${hours}h ${minutes} m`;
        }

        updateTimer();
        // Update timer every minute
        const timerId = setInterval(updateTimer, 60000);
        // Store timer ID as a data attribute to clear it later
        timerDisplay.dataset.timerId = timerId;
    } else {
        statusDot.style.backgroundColor = "#f87171";
        statusText.textContent = "Inactive";
        statusCard.classList.remove("border-success");
        timerDisplay.textContent = "";

        // Clear any existing timer
        if (timerDisplay.dataset.timerId) {
            clearInterval(parseInt(timerDisplay.dataset.timerId));
            delete timerDisplay.dataset.timerId;
        }
    }

    // Update notes display
    notesDisplay.textContent = notes || "";
}

function listenFertigationStatus() {
    const logsRef = db
        .collection("irrigation_devices")
        .doc("MCON874Q000568")
        .collection("fertigation_logs");

    logsRef.where("endTime", "==", null).onSnapshot((snapshot) => {
        let isActive = false;
        let startTime = null;
        let notes = "";

        if (!snapshot.empty) {
            const activeLog = snapshot.docs[0].data();
            isActive = true;
            startTime = activeLog.startTime.toDate();
            notes = activeLog.notes || "";
        }

        updateFertigationStatus(isActive, startTime, notes);
        // Button enable/disable logic
        if (isActive) {
            document.getElementById("start-fertigation").disabled = true;
            document.getElementById("stop-fertigation").disabled = false;
            document.getElementById("fertigation-notes").disabled = true;
        } else {
            document.getElementById("start-fertigation").disabled = false;
            document.getElementById("stop-fertigation").disabled = true;
            document.getElementById("fertigation-notes").disabled = false;
            document.getElementById("fertigation-form").reset();
        }
    });
}

// Global variable for the Fertigation Duration Chart
let fertigationChart = null;

function updateFertigationChart(logs) {
    const canvas = document.getElementById("fertigation-duration-chart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Only process logs that have a duration > 0 (completed cycles)
    const completedLogs = logs.filter(log => log.duration !== undefined && log.duration !== null && log.duration > 0).reverse();

    // Group logs by day
    const groupedByDay = {};
    completedLogs.forEach(log => {
        const dateStr = log.startTime.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (!groupedByDay[dateStr]) {
            groupedByDay[dateStr] = [];
        }
        groupedByDay[dateStr].push(log);
    });

    const labels = Object.keys(groupedByDay);

    // Find the maximum number of fertigation events in a single day
    let maxEvents = 0;
    labels.forEach(date => {
        if (groupedByDay[date].length > maxEvents) {
            maxEvents = groupedByDay[date].length;
        }
    });

    const datasets = [];
    const colorPalette = [
        'rgba(52, 211, 153, 0.7)', // Emerald
        'rgba(45, 212, 191, 0.7)', // Teal
        'rgba(6, 182, 212, 0.7)',  // Cyan
        'rgba(59, 130, 246, 0.7)', // Blue
        'rgba(139, 92, 246, 0.7)', // Purple
        'rgba(245, 158, 11, 0.7)'  // Amber
    ];

    for (let i = 0; i < maxEvents; i++) {
        const data = labels.map(date => {
            const logsForDay = groupedByDay[date];
            return logsForDay[i] ? logsForDay[i].duration : 0;
        });

        // Collect specific start times for tooltips
        const times = labels.map(date => {
            const logsForDay = groupedByDay[date];
            return logsForDay[i] ? logsForDay[i].startTime.toDate().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : "";
        });

        datasets.push({
            label: `Tank ${i + 1} `,
            data: data,
            customTimes: times, // Store times for tooltip
            backgroundColor: colorPalette[i % colorPalette.length],
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            borderRadius: 4
        });
    }

    if (fertigationChart) {
        fertigationChart.destroy();
    }

    fertigationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: "#8899aa", usePointStyle: true, boxWidth: 8 }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 18, 32, 0.92)',
                    titleColor: '#f0f4f8',
                    bodyColor: '#f0f4f8',
                    borderColor: 'rgba(52, 211, 153, 0.15)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            const duration = context.parsed.y;
                            if (duration === 0) return null; // Don't show empty segments
                            const time = context.dataset.customTimes[context.dataIndex];
                            return ` ${context.dataset.label} (${time}): ${duration} mins`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total Minutes',
                        color: '#8899aa'
                    },
                    grid: { color: "rgba(255,255,255,0.04)" },
                    ticks: { color: "#8899aa" }
                },
                x: {
                    stacked: true,
                    ticks: {
                        color: '#8899aa'
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

async function loadFertigationHistory(isLoadMore = false) {
    const historyTableBody = document.getElementById("fertigation-history");
    const loadMoreBtn = document.getElementById("load-more-fert-btn");

    if (!isLoadMore) {
        historyTableBody.innerHTML =
            '<tr><td colspan="4" class="text-center">Loading...</td></tr>';
        lastFertDoc = null;
    } else {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Loading...";
    }

    try {
        // Fetch valve details for mapping indices to names
        const latestSnapshot = await db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection(getTodayDate())
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();

        const latestData = !latestSnapshot.empty ? latestSnapshot.docs[0].data() : {};
        const valveDetails = latestData.summary?.valve_details || {};

        // Fetch fertigation logs from Firestore
        let query = db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection("fertigation_logs")
            .orderBy("startTime", "desc");

        const fromVal = document.getElementById("fert-history-from-date").value;
        const toVal = document.getElementById("fert-history-to-date").value;

        if (fromVal) {
            query = query.where("startTime", ">=", new Date(fromVal));
        }
        if (toVal) {
            // Set end of day for "To" date
            const toDate = new Date(toVal);
            toDate.setHours(23, 59, 59, 999);
            query = query.where("startTime", "<=", toDate);
        }

        if (isLoadMore && lastFertDoc) {
            query = query.startAfter(lastFertDoc);
        }

        const snapshot = await query.limit(10).get();

        if (snapshot.empty) {
            if (!isLoadMore) {
                historyTableBody.innerHTML =
                    '<tr><td colspan="4" class="text-center">No fertigation history found</td></tr>';
            }
            loadMoreBtn.style.display = "none";
            return;
        }

        lastFertDoc = snapshot.docs[snapshot.docs.length - 1];
        loadMoreBtn.style.display = snapshot.docs.length === 10 ? "inline-block" : "none";
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = "Load More";

        // For all fertigation logs, fetch timer logs from Mobitech API in one go (for the combined time range)
        const fertigationLogs = snapshot.docs.map((doc) => doc.data()).filter(log => log.duration !== 0);
        // Find overall min start and max end
        let minStart = null;
        let maxEnd = null;
        fertigationLogs.forEach((log) => {
            const s = log.startTime.toDate();
            const e = log.endTime?.toDate() || new Date();
            if (!minStart || s < minStart) minStart = s;
            if (!maxEnd || e > maxEnd) maxEnd = e;
        });
        const fromDate = moment(minStart).subtract(1, 'day').format("YYYY-MM-DD");
        const toDate = moment(maxEnd).format("YYYY-MM-DD");

        const timerResponse = await fetch(
            "https://dcon.mobitechwireless.com/v1/http/",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    action: "logs",
                    method: "timer_log",
                    serial_no: "MCON874Q000568",
                    from: fromDate,
                    to: toDate,
                }),
            }
        );

        if (!timerResponse.ok) {
            throw new Error("Failed to fetch timer logs");
        }

        const data = await timerResponse.json();
        const timerLogs = data.log || [];


        // For each fertigation log, find overlapping timers from timerLogs (by overlap of start/end)
        const processedLogs = fertigationLogs.map((log) => {
            const startTime = log.startTime.toDate();
            const endTime = log.endTime?.toDate();
            const parseIST = (dateStr) => {
                if (!dateStr) return new Date();
                return new Date(dateStr.replace(" ", "T") + "+05:30");
            };

            // Filter timer logs that overlap
            const overlappingTimers = timerLogs.filter((timer) => {
                const timerStart = parseIST(timer.dt);
                const timerEnd = parseIST(timer.last_sync);
                // Overlap logic: timer starts before fertigation ends, and timer ends after fertigation starts
                const fertEnd = endTime || new Date();
                const isOverlap = startTime <= timerEnd && fertEnd >= timerStart;
                const hasValves = timer.on_valves && timer.on_valves !== "0";
                return isOverlap && hasValves;
            });
            return {
                ...log,
                overlappingTimers,
            };
        });

        // Render the history table
        if (!isLoadMore) historyTableBody.innerHTML = "";
        processedLogs.forEach((log) => {
            const row = document.createElement("tr");
            const startTime = log.startTime.toDate();
            let duration = "In Progress";
            if (log.endTime) {
                duration = `${log.duration} min`;
            }
            // Map on_valves indices to names
            const timerInfo = log.overlappingTimers
                .map((timer) => {
                    if (timer.on_valves) {
                        const valveIndices = timer.on_valves.split("-").filter(v => v !== "0");
                        if (valveIndices.length > 0) {
                            return valveIndices
                                .map(v => (valveDetails[v] ? valveDetails[v].valve_name : `Valve ${v} `))
                                .join(", ");
                        }
                    }
                    return null;
                })
                .filter(Boolean)
                .join(", ");
            row.innerHTML = `
        <td>${startTime.toLocaleString()}</td>
        <td>${duration}</td>
        <td>${timerInfo || "-"}</td>
        <td>${log.notes || "-"}</td>
        `;
            historyTableBody.appendChild(row);
        });

        if (!isLoadMore) {
            // Note: Chart updating is now decoupled and handled by loadFertigationChartData()
        } else {
            // Note: Chart updating is now decoupled and handled by loadFertigationChartData()
        }

    } catch (error) {
        console.error("Error loading fertigation history:", error);
        historyTableBody.innerHTML = `
            <tr>
            <td colspan="4" class="text-center text-danger">
                Error loading history. Please try again later.
            </td>
      </tr>`;
    }
}

// --- Fertigation: Event listeners and real-time updates ---
document.addEventListener("DOMContentLoaded", () => {
    // Default chart dates to 1 week initially
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - 7);

    const fromDateInput = document.getElementById("fert-chart-from-date");
    const toDateInput = document.getElementById("fert-chart-to-date");

    if (fromDateInput && toDateInput) {
        fromDateInput.value = fromDate.toISOString().split("T")[0];
        toDateInput.value = toDate.toISOString().split("T")[0];
        // Fetch chart data specifically
        loadFertigationChartData();
    }

    // Attach listener for update button
    const updateBtn = document.getElementById("update-fert-charts-btn");
    if (updateBtn) {
        updateBtn.addEventListener("click", () => {
            loadFertigationChartData();
        });
    }

    loadFertigationHistory();
    listenFertigationStatus();
});

// --- Real-time Firestore listeners for fertigation history and valve queue ---
db.collection("irrigation_devices")
    .doc("MCON874Q000568")
    .collection("fertigation_logs")
    .onSnapshot(() => {
        loadFertigationHistory();
        loadFertigationChartData(); // Added chart refresh on snapshot
    });

db.collection("irrigation_devices")
    .doc("MCON874Q000568")
    .collection("fertigation_queue")
    .doc("current_queue")
    .onSnapshot(() => {
        loadValveQueueFromFirestore();
    });


// --- New Chart Data Loading Logic ---
async function loadFertigationChartData() {
    const fromVal = document.getElementById("fert-chart-from-date").value;
    const toVal = document.getElementById("fert-chart-to-date").value;

    if (!fromVal || !toVal) return;

    try {
        let query = db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection("fertigation_logs")
            .orderBy("startTime", "desc");

        query = query.where("startTime", ">=", new Date(fromVal));
        const toDate = new Date(toVal);
        toDate.setHours(23, 59, 59, 999);
        query = query.where("startTime", "<=", toDate);

        const snapshot = await query.get();
        const fertigationLogs = snapshot.docs.map(doc => doc.data()).filter(log => log.duration !== 0);

        if (fertigationLogs.length === 0) {
            updateFertigationChart([]);
            updateFertigationValveStatsChart([], {});
            return;
        }

        // Fetch Valve Details
        const latestSnapshot = await db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection(getTodayDate())
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();

        const valveDetails = !latestSnapshot.empty ? latestSnapshot.docs[0].data().summary?.valve_details || {} : {};

        // Fetch timer logs
        let minStart = null;
        let maxEnd = null;
        fertigationLogs.forEach((log) => {
            const s = log.startTime.toDate();
            const e = log.endTime?.toDate() || new Date();
            if (!minStart || s < minStart) minStart = s;
            if (!maxEnd || e > maxEnd) maxEnd = e;
        });

        const timerFromDate = moment(minStart).subtract(1, 'day').format("YYYY-MM-DD");
        const timerToDate = moment(maxEnd).format("YYYY-MM-DD");

        const timerResponse = await fetch(
            "https://dcon.mobitechwireless.com/v1/http/",
            {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    action: "logs",
                    method: "timer_log",
                    serial_no: "MCON874Q000568",
                    from: timerFromDate,
                    to: timerToDate,
                }),
            }
        );

        if (!timerResponse.ok) throw new Error("Failed to fetch timer logs for charts");

        const timerData = await timerResponse.json();
        const timerLogs = timerData.log || [];

        // Correlate
        const processedLogs = fertigationLogs.map((log) => {
            const startTime = log.startTime.toDate();
            const endTime = log.endTime?.toDate();
            const overlappingTimers = timerLogs.filter((timer) => {
                const timerStart = new Date(timer.dt);
                const timerEnd = new Date(timer.last_sync);
                const fertEnd = endTime || new Date();
                const isOverlap = startTime <= timerEnd && fertEnd >= timerStart;
                const hasValves = timer.on_valves && timer.on_valves !== "0";
                return isOverlap && hasValves;
            });
            return { ...log, overlappingTimers };
        });

        updateFertigationChart(processedLogs);
        updateFertigationValveStatsChart(processedLogs, valveDetails);

    } catch (error) {
        console.error("Error loading fertigation chart data:", error);
    }
}

// --- Fertigation Valve Queue Management ---
const valveGroupQueue = [];

// Render the fertigation valve group queue UI.
function renderValveGroupQueue() {
    const list = document.getElementById("valve-group-queue-list");
    if (!list) return;
    list.innerHTML = "";

    valveGroupQueue.forEach((group, index) => {
        const valveNames = Array.isArray(group.valves)
            ? group.valves.map((v) => v.name).join(", ")
            : "";
        const li = document.createElement("li");
        li.className =
            "list-group-item d-flex justify-content-between align-items-center";
        li.innerHTML = `
            <span>${valveNames}</span>
                <div>
                    <button class="btn btn-sm btn-outline-secondary me-1 queue-control-btn" onclick="moveUpInValveGroupQueue(${index})"><i class="fa-solid fa-arrow-up"></i></button>
                    <button class="btn btn-sm btn-outline-secondary me-1 queue-control-btn" onclick="moveDownInValveGroupQueue(${index})"><i class="fa-solid fa-arrow-down"></i></button>
                    <button class="btn btn-sm btn-outline-danger queue-control-btn" onclick="removeFromValveGroupQueue(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
        `;
        list.appendChild(li);
        // Disable queue controls if add button is disabled
        const addBtn = document.getElementById("add-valve-group-btn");
        if (addBtn && addBtn.disabled) {
            li.querySelectorAll(".queue-control-btn").forEach(b => {
                b.classList.add("disabled");
                b.style.opacity = "0.5";
                b.style.pointerEvents = "auto";
                b.addEventListener("click", (e) => {
                    e.preventDefault();
                    alert("🚫 You are not authorized to modify the fertigation queue.");
                });
            });
        }
    });

    // Faded Recommendation Display (always shown)
    const recSection = document.createElement("div");
    recSection.className = "mt-3";

    // Header row with label and reload button
    const recHeader = document.createElement("div");
    recHeader.className = "d-flex justify-content-between align-items-center mb-1 px-1";
    recHeader.innerHTML = `
            <span class="extra-small text-muted" style="letter-spacing:0.05em; text-transform:uppercase;">AI Suggestions</span>
                <button id="reload-rec-btn" class="btn btn-sm btn-link p-0" style="color: var(--accent-teal); font-size:0.75rem;" title="Refresh recommendations">
                    <i class="fas fa-rotate-right"></i>
                </button>
        `;
    recSection.appendChild(recHeader);

    if (currentSmartRecommendation && Array.isArray(currentSmartRecommendation) && currentSmartRecommendation.length > 0) {
        // Filter out any recommendations already in the queue
        const availableRecs = currentSmartRecommendation.filter(rec => {
            const inQueue = valveGroupQueue.some(q =>
                q.valves.length === rec.valves.length &&
                q.valves.every(qv => rec.valves.some(gv => gv.id === qv.id))
            );
            return !inQueue;
        });

        if (availableRecs.length > 0) {
            // Render up to 5 available recommendations
            availableRecs.slice(0, 5).forEach(rec => {
                const recItem = document.createElement("li");
                recItem.className = "list-group-item d-flex justify-content-between align-items-center animate__animated animate__fadeIn mb-1";
                recItem.style.border = "1px dashed rgba(52, 211, 153, 0.3)";
                recItem.style.background = "rgba(52, 211, 153, 0.05)";
                recItem.style.opacity = "0.7";
                recItem.style.cursor = "pointer";
                recItem.title = "Click to add this recommendation to the queue";

                const valveNames = rec.valves.map(v => v.name).join(", ");
                recItem.innerHTML = `
            <div class="d-flex align-items-center">
                        <i class="fas fa-magic me-3" style="color: var(--accent-teal);"></i>
                        <div>
                            <div class="small fw-bold text-white">Suggested: ${rec.name}</div>
                            <div class="extra-small text-muted">${valveNames}</div>
                            <div class="extra-small text-muted italic" style="font-size: 0.65rem; opacity: 0.8;">${rec.reason}</div>
                        </div>
                    </div>
            <button class="btn btn-sm btn-link p-0" style="color: var(--accent-teal);" title="Add to queue">
                <i class="fas fa-plus-circle"></i>
            </button>`;

                recItem.onclick = (e) => {
                    if (e.target.closest("#reload-rec-btn")) return;
                    addToValveQueue(rec.valves);
                    // Remove this specific recommendation from the list
                    currentSmartRecommendation = currentSmartRecommendation.filter(r => r.id !== rec.id);
                    renderValveGroupQueue();
                };

                recSection.appendChild(recItem);
            });
        } else {
            // If all 5 recommendations are already queued, try to get more
            const loadingItem = document.createElement("li");
            loadingItem.className = "list-group-item d-flex justify-content-between align-items-center animate__animated animate__fadeIn mt-1";
            loadingItem.style.border = "1px dashed rgba(52, 211, 153, 0.3)";
            loadingItem.style.background = "rgba(52, 211, 153, 0.05)";
            loadingItem.style.opacity = "0.35";
            loadingItem.innerHTML = `
                <div class="d-flex align-items-center">
                     <i class="fas fa-magic me-3" style="color: var(--accent-teal);"></i>
                     <div class="small text-muted">Loading more suggestions…</div>
                 </div>`;
            recSection.appendChild(loadingItem);
            // Use setTimeout to avoid infinite loops if generate is slow or fails
            setTimeout(generateSmartRecommendation, 1000);
        }
    } else {
        // No recommendations yet or error — show a loading/empty state
        const emptyItem = document.createElement("li");
        emptyItem.className = "list-group-item d-flex justify-content-between align-items-center animate__animated animate__fadeIn mt-1";
        emptyItem.style.border = "1px dashed rgba(52, 211, 153, 0.3)";
        emptyItem.style.background = "rgba(52, 211, 153, 0.05)";
        emptyItem.style.opacity = "0.35";
        emptyItem.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-magic me-3" style="color: var(--accent-teal);"></i>
                <div class="small text-muted">Loading suggestions…</div>
            </div>`;
        recSection.appendChild(emptyItem);
    }

    list.appendChild(recSection);

    // Wire up the reload button
    const reloadBtn = document.getElementById("reload-rec-btn");
    if (reloadBtn) {
        reloadBtn.onclick = async (e) => {
            e.stopPropagation();
            reloadBtn.innerHTML = `<i class="fas fa-rotate-right fa-spin"></i>`;
            reloadBtn.disabled = true;
            await generateSmartRecommendation();
            reloadBtn.innerHTML = `<i class="fas fa-rotate-right"></i>`;
            reloadBtn.disabled = false;
        };
    }
}

// Load the fertigation valve queue from Firestore and render.
async function loadValveQueueFromFirestore() {
    valveGroupQueue.length = 0;
    try {
        const queueDoc = await db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection("fertigation_queue")
            .doc("current_queue")
            .get();
        if (queueDoc.exists) {
            const data = queueDoc.data();
            if (Array.isArray(data.queue)) {
                valveGroupQueue.push(...data.queue);
            }
        }
        renderValveGroupQueue();
    } catch (error) {
        console.error("Error loading valve queue:", error);
    }
}

/**
 * Save the fertigation valve queue to Firestore.
 */
async function saveValveQueueToFirestore() {
    try {
        const userQueueRef = db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection("fertigation_queue")
            .doc("current_queue");
        await userQueueRef.set({ queue: valveGroupQueue }, { merge: true });
    } catch (error) {
        console.error("❌ Error storing valve queue:", error);
    }
}

/**
 * Add valves to the fertigation valve queue and save.
 * @param {Array} valves - Array of valve objects {id, name}
 */
async function addToValveQueue(valves, isAuto = false) {
    valveGroupQueue.push({ valves });
    renderValveGroupQueue();
    await saveValveQueueToFirestore();

    if (isAuto) {
        const valveNames = valves.map(v => v.name).join(", ");
        const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, timeStyle: "short" });
        notifyZohoCliq([
            `📥 * Queue Updated(Auto - Scheduler) * `,
            `🪴 Added: ${valveNames} `,
            `📋 Queue length: ${valveGroupQueue.length} `,
            `⏰ Time: ${now} `,
        ].join("\n"));
    }
}

/**
 * Remove a queue item and save.
 * @param {number} index - Index of the queue item to remove.
 */
async function removeFromValveGroupQueue(index) {
    valveGroupQueue.splice(index, 1);
    renderValveGroupQueue();
    await saveValveQueueToFirestore();
}

/**
 * Move a queue item up and save.
 * @param {number} index - Index of the queue item to move.
 */
function moveUpInValveGroupQueue(index) {
    if (index > 0) {
        [valveGroupQueue[index - 1], valveGroupQueue[index]] = [
            valveGroupQueue[index],
            valveGroupQueue[index - 1],
        ];
        renderValveGroupQueue();
        saveValveQueueToFirestore();
    }
}

/**
 * Move a queue item down and save.
 * @param {number} index - Index of the queue item to move.
 */
function moveDownInValveGroupQueue(index) {
    if (index < valveGroupQueue.length - 1) {
        [valveGroupQueue[index], valveGroupQueue[index + 1]] = [
            valveGroupQueue[index + 1],
            valveGroupQueue[index],
        ];
        renderValveGroupQueue();
        saveValveQueueToFirestore();
    }
}

/**
 * Modal-based predefined valve group selection for fertigation queue.
 * On confirm, adds selected group to the queue and saves.
 */
async function openValveSelectionModal() {
    if (predefinedValveGroups.length === 0) {
        alert("No predefined Valve Groups exist! Please go to the Admin Panel and create a Valve Group first.");
        return;
    }

    const modalId = "valveGroupSelectionModal";
    let modalHtml = `
            <div class="modal fade glass-modal" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="${modalId}Label">Select Predefined Valve Group</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted small">Only predefined valve groups can be queued to regulate pressure. Create more groups in the Admin Panel.</p>
                            <form id="valve-group-selection-form">
                                <div class="list-group">
                                    `;

    predefinedValveGroups.forEach((group, index) => {
        const valveNames = group.valves.map(v => v.name).join(", ");
        modalHtml += `
                                    <label class="list-group-item d-flex gap-3 bg-transparent text-white" style="border-color: rgba(255,255,255,0.1);">
                                        <input class="form-check-input flex-shrink-0" type="radio" name="valveGroupSelector" id="group-radio-${index}" value="${index}">
                                            <span>
                                                <strong>${group.name}</strong>
                                                <small class="d-block text-muted mt-1"><i class="fas fa-water me-1"></i> ${valveNames}</small>
                                            </span>
                                    </label>
                                    `;
    });

    modalHtml += `
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirm-valve-selection-btn">Add to Queue</button>
                        </div>
                    </div>
                </div>
    </div >
            `;

    const oldModal = document.getElementById(modalId);
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modalEl = document.getElementById(modalId);
    const bsModal = new bootstrap.Modal(modalEl, {});
    bsModal.show();

    document.getElementById("confirm-valve-selection-btn").onclick = async function () {
        const form = document.getElementById("valve-group-selection-form");
        const checkedRadio = form.querySelector('input[name="valveGroupSelector"]:checked');

        if (!checkedRadio) {
            alert("Select a valve group.");
            return;
        }

        const selectedGroupIndex = checkedRadio.value;
        const selectedGroup = predefinedValveGroups[selectedGroupIndex];

        if (!selectedGroup) return;

        await addToValveQueue(selectedGroup.valves);
        bsModal.hide();
        setTimeout(() => {
            if (modalEl) modalEl.remove();
        }, 500);
    };
}

// Add to queue button (open modal for selection)
document
    .getElementById("add-valve-group-btn")
    .addEventListener("click", async () => {
        openValveSelectionModal();
    });

// Pagination and filters for Fertigation History
let lastFertDoc = null;

document.getElementById("fetch-fert-history-btn")?.addEventListener("click", () => {
    loadFertigationHistory(false);
});

document.getElementById("load-more-fert-btn")?.addEventListener("click", () => {
    loadFertigationHistory(true);
});

document.addEventListener("DOMContentLoaded", () => {
    // Initial load will be triggered by tab click

    // Default energy date to today
    const energyDateInput = document.getElementById("energy-history-date");
    if (energyDateInput) {
        energyDateInput.value = getTodayDate();
    }

    // Attach listener for energy fetch
    document.getElementById("fetch-energy-btn")?.addEventListener("click", fetchEnergyAnalytics);

    // Initialize Admin Panel Data
    initValveGroupsListener();

    // Hiding splash screen after loading
    setTimeout(() => {
        const splash = document.getElementById("splash-screen");
        if (splash) {
            splash.classList.add("fade-out");
            setTimeout(() => splash.remove(), 1000);
        }
    }, 2000);
});

// --- Energy & Power Analytics ---
let powerAnalyticsChart = null;

// --- Admin Panel: Predefined Valve Groups Management ---
let predefinedValveGroups = [];

/**
 * Initialize Valve Groups listener to keep the Admin Panel and Queue Modal updated.
 */
function initValveGroupsListener() {
    db.collection("irrigation_devices")
        .doc("MCON874Q000568")
        .collection("valve_groups")
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {
            predefinedValveGroups = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderAdminValveGroups();
        }, (error) => {
            console.error("Error listening to valve groups:", error);
        });
}

// Render grid in the Admin Panel
function renderAdminValveGroups() {
    const grid = document.getElementById("admin-valve-groups-grid");
    if (!grid) return;

    if (predefinedValveGroups.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="fas fa-layer-group fs-1 mb-3 opacity-50"></i><br>
                No groups defined. Create your first valve group.
            </div>`;
        return;
    }

    grid.innerHTML = "";
    predefinedValveGroups.forEach((group) => {
        const valveNames = group.valves.map(v => v.name).join(", ");
        const cardNode = document.createElement("div");
        cardNode.className = "col-md-6 col-lg-4";
        cardNode.innerHTML = `
            <div class="card h-100" style="border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title text-white fw-bold m-0">${group.name}</h6>
                        <button class="btn btn-sm btn-outline-danger border-0 p-1" onclick="deleteValveGroup('${group.id}')" title="Delete Group">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <p class="text-muted small mb-0 flex-grow-1"><i class="fas fa-water me-1"></i> ${valveNames}</p>
                    <div class="mt-3 pt-2 text-end border-top" style="border-color: rgba(255,255,255,0.05) !important;">
                        <span class="badge" style="background: rgba(6, 182, 212, 0.2); color: var(--accent-cyan); font-weight: normal;">${group.valves.length} Valve(s)</span>
                    </div>
                </div>
            </div>
            `;
        grid.appendChild(cardNode);
    });
}

/**
 * Open modal to create a new predefined valve group (Admin facing)
 */
async function openCreateValveGroupModal() {
    // Fetch latest valve details from snapshot
    let valveDetails = {};
    try {
        const snapshot = await db.collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection(getTodayDate())
            .orderBy("timestamp", "desc").limit(1).get();

        if (!snapshot.empty) valveDetails = snapshot.docs[0].data().summary?.valve_details || {};
    } catch (error) {
        alert("Failed to fetch valve details.");
        return;
    }

    const modalId = "adminCreateGroupModal";
    let modalHtml = `
            <div class="modal fade glass-modal" id="${modalId}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Create Valve Group</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="admin-valve-group-form">
                                <div class="mb-4">
                                    <label for="group-name-input" class="form-label text-muted small">Group Name</label>
                                    <input type="text" class="form-control" id="group-name-input" placeholder="e.g. Mango Farm Sector 1" required>
                                </div>
                                <label class="form-label text-muted small">Select Valves for this Group</label>
                                <div class="row g-2 max-h-300 overflow-auto border p-2 rounded" style="border-color: rgba(255,255,255,0.05) !important;">
                                    `;
    Object.keys(valveDetails).forEach((valveNo) => {
        const vName = valveDetails[valveNo].valve_name || `Valve ${valveNo}`;
        modalHtml += `
                                    <div class="col-6">
                                        <div class="form-check p-2 rounded" style="background: rgba(255,255,255,0.03);">
                                            <input class="form-check-input ms-1" type="checkbox" value="${valveNo}" id="admin-val-${valveNo}">
                                                <label class="form-check-label ms-2 small" for="admin-val-${valveNo}">${vName}</label>
                                        </div>
                                    </div>
                                    `;
    });
    modalHtml += `
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="save-new-group-btn">Save Group</button>
                        </div>
                    </div>
                </div>
    </div >
            `;

    const oldModal = document.getElementById(modalId);
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const bsModal = new bootstrap.Modal(document.getElementById(modalId), {});
    bsModal.show();

    document.getElementById("save-new-group-btn").onclick = async () => {
        const form = document.getElementById("admin-valve-group-form");
        const nameInput = document.getElementById("group-name-input").value.trim();
        const checked = Array.from(form.querySelectorAll('.form-check-input:checked'));

        if (!nameInput) {
            alert("Please provide a name for the group.");
            return;
        }
        if (checked.length === 0) {
            alert("Please select at least one valve.");
            return;
        }

        const selectedValves = checked.map((cb) => ({
            id: cb.value,
            name: valveDetails[cb.value]?.valve_name || `Valve ${cb.value} `,
        }));

        try {
            await db.collection("irrigation_devices")
                .doc("MCON874Q000568")
                .collection("valve_groups")
                .add({
                    name: nameInput,
                    valves: selectedValves,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            bsModal.hide();
        } catch (err) {
            console.error("Error saving valve group:", err);
            alert("Failed to save group.");
        }
    };
}

async function deleteValveGroup(groupId) {
    if (!confirm("Are you sure you want to delete this Valve Group? This will not affect active fertigation but prevents future queueing of this group.")) return;
    try {
        await db.collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection("valve_groups")
            .doc(groupId)
            .delete();
    } catch (e) {
        console.error("Error deleting valve group:", e);
        alert("Failed to delete group.");
    }
}


async function fetchEnergyAnalytics() {
    const dateInput = document.getElementById("energy-history-date").value;
    if (!dateInput) {
        alert("Please select a date first.");
        return;
    }

    const fetchBtn = document.getElementById("fetch-energy-btn");
    if (fetchBtn) {
        fetchBtn.disabled = true;
        fetchBtn.textContent = "Loading...";
    }

    try {
        const snapshot = await db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection(dateInput)
            .orderBy("timestamp", "asc")
            .get();

        if (snapshot.empty) {
            alert("No data found for this date.");
            if (fetchBtn) {
                fetchBtn.disabled = false;
                fetchBtn.textContent = "Load";
            }
            return;
        }

        const labels = [];
        const vr = [], vy = [], vb = [];
        const cr = [], cy = [], cb = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.timestamp && data.summary && data.summary.live_data) {
                let timeStr;
                try {
                    // Try to format Firestore Timestamp
                    timeStr = moment(data.timestamp.toDate()).format("HH:mm");
                } catch (e) {
                    timeStr = moment(new Date(data.timestamp)).format("HH:mm");
                }

                labels.push(timeStr);

                const live = data.summary.live_data;
                vr.push(parseFloat(live.voltage_phase_1 || 0));
                vy.push(parseFloat(live.voltage_phase_2 || 0));
                vb.push(parseFloat(live.voltage_phase_3 || 0));

                cr.push(parseFloat(live.current_phase_1 || 0));
                cy.push(parseFloat(live.current_phase_2 || 0));
                cb.push(parseFloat(live.current_phase_3 || 0));
            }
        });

        const ctx = document.getElementById("power-analytics-chart");
        if (!ctx) return;

        if (powerAnalyticsChart) {
            powerAnalyticsChart.destroy();
        }

        powerAnalyticsChart = new Chart(ctx.getContext("2d"), {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    { label: "Voltage R", data: vr, borderColor: "#ef4444", yAxisID: 'y', tension: 0.1, pointRadius: 0 },
                    { label: "Voltage Y", data: vy, borderColor: "#facc15", yAxisID: 'y', tension: 0.1, pointRadius: 0 },
                    { label: "Voltage B", data: vb, borderColor: "#3b82f6", yAxisID: 'y', tension: 0.1, pointRadius: 0 },
                    { label: "Current R", data: cr, borderColor: "rgba(239, 68, 68, 0.4)", borderDash: [5, 5], yAxisID: 'y1', tension: 0.1, pointRadius: 0 },
                    { label: "Current Y", data: cy, borderColor: "rgba(250, 204, 21, 0.4)", borderDash: [5, 5], yAxisID: 'y1', tension: 0.1, pointRadius: 0 },
                    { label: "Current B", data: cb, borderColor: "rgba(59, 130, 246, 0.4)", borderDash: [5, 5], yAxisID: 'y1', tension: 0.1, pointRadius: 0 },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255,255,255,0.04)" },
                        ticks: { color: "#8899aa", maxTicksLimit: 12 }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Voltage (V)', color: '#8899aa' },
                        grid: { color: "rgba(255,255,255,0.04)" },
                        ticks: { color: "#8899aa" }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Current (A)', color: '#8899aa' },
                        grid: { drawOnChartArea: false },
                        ticks: { color: "#8899aa" }
                    }
                },
                plugins: {
                    legend: { labels: { color: "#f0f4f8", usePointStyle: true, boxWidth: 8 } },
                    tooltip: {
                        backgroundColor: 'rgba(10, 18, 32, 0.92)',
                        titleColor: '#f0f4f8',
                        bodyColor: '#f0f4f8',
                        borderColor: 'rgba(52, 211, 153, 0.15)',
                        borderWidth: 1
                    }
                }
            }
        });

    } catch (e) {
        console.error("Error fetching energy analytics:", e);
        alert("An error occurred while fetching energy data.");
    } finally {
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.textContent = "Load";
        }
    }
}

// --- Fertigation Valve Usage Statistics ---
let fertigationValveStatsChart = null;

function updateFertigationValveStatsChart(processedLogs, valveDetails) {
    const valveStats = {};

    processedLogs.forEach(log => {
        const activeValvesInThisTank = new Set();

        if (log.overlappingTimers) {
            log.overlappingTimers.forEach(timer => {
                if (timer.on_valves) {
                    const valveIndices = timer.on_valves.split("-").filter(v => v !== "0");
                    valveIndices.forEach(v => {
                        const valveName = valveDetails[v] ? valveDetails[v].valve_name : `Valve ${v} `;

                        if (!valveStats[valveName]) {
                            valveStats[valveName] = { duration: 0, tanks: 0 };
                        }

                        const tStart = new Date(timer.dt);
                        const tEnd = new Date(timer.last_sync);
                        const fStart = log.startTime.toDate();
                        const fEnd = log.endTime ? log.endTime.toDate() : new Date();

                        const overlapStart = new Date(Math.max(tStart, fStart));
                        const overlapEnd = new Date(Math.min(tEnd, fEnd));
                        if (overlapStart < overlapEnd) {
                            const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);
                            valveStats[valveName].duration += overlapMinutes;
                        }

                        activeValvesInThisTank.add(valveName);
                    });
                }
            });
        }

        activeValvesInThisTank.forEach(valveName => {
            valveStats[valveName].tanks += 1;
        });
    });

    const sortedValves = Object.entries(valveStats)
        .sort((a, b) => b[1].duration - a[1].duration);

    const labels = sortedValves.map(item => item[0]);
    const durData = sortedValves.map(item => item[1].duration);
    const tanksData = sortedValves.map(item => item[1].tanks);

    const ctx = document.getElementById("fertigation-valve-stats-chart");
    if (!ctx) return;

    if (fertigationValveStatsChart) {
        fertigationValveStatsChart.destroy();
    }

    fertigationValveStatsChart = new Chart(ctx.getContext("2d"), {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Active Duration (mins)",
                    data: durData,
                    backgroundColor: "rgba(45, 212, 191, 0.6)",
                    borderColor: "rgba(45, 212, 191, 1)",
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    label: "Tanks Active In",
                    data: tanksData,
                    type: "line",
                    backgroundColor: "rgba(139, 92, 246, 1)",
                    borderColor: "rgba(139, 92, 246, 1)",
                    borderWidth: 2,
                    pointBackgroundColor: "rgba(139, 92, 246, 1)",
                    pointRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#8899aa" }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Minutes', color: '#8899aa' },
                    grid: { color: "rgba(255,255,255,0.04)" },
                    ticks: { color: "#8899aa" },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Tank Count', color: '#8899aa' },
                    grid: { drawOnChartArea: false },
                    ticks: { color: "#8899aa", stepSize: 1 },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: "#f0f4f8", usePointStyle: true, boxWidth: 8 }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 18, 32, 0.92)',
                    titleColor: '#f0f4f8',
                    bodyColor: '#f0f4f8',
                    borderColor: 'rgba(52, 211, 153, 0.15)',
                    borderWidth: 1
                }
            }
        }
    });
}

let currentSmartRecommendation = null;

/**
 * Smart Scheduler: Fetches Deterministic Logic from Cloud Functions.
 * Now integrated directly into the queue display as a "faded" suggestion.
 */
async function generateSmartRecommendation() {
    try {
        const cloudFunctionUrl = `${getBaseUrl()}/getSmartRecommendation`;

        const response = await fetch(cloudFunctionUrl);
        const data = await response.json();

        if (data.success && data.recommendation) {
            currentSmartRecommendation = data.recommendation;
            renderValveGroupQueue();
        } else if (data.debug) {
            console.log("[Smart Rec Debug]:", data.debug);
        }
    } catch (e) {
        console.error("Smart Recommendation Sync Error:", e);
    }
}

/**
 * Send notification to Zoho CLIQ
 */
async function notifyZohoCliq(message) {
    const webhook = "https://cliq.zoho.in/api/v2/bots/fertigationlogs/incoming?zapikey=1001.0c97cb7893d99ec941afeb3bc24bce00.4cfd4b9283927796a146b5f7e8ad8f97";
    try {
        await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message })
        });
    } catch (err) {
        console.error("Failed to send CLIQ notification:", err);
    }
}

// --- Supply Motor Status Fetching ---
async function fetchSupplyMotorStatus() {
    const dot = document.getElementById("supply-motor-dot");
    const text = document.getElementById("supply-motor-status-text");
    const banner = document.getElementById("supply-motor-status-banner");
    const image = document.getElementById("supply-motor-image");
    const desc = document.getElementById("supply-motor-desc");

    try {
        const response = await fetch("http://3.1.62.165:8080/api/v1/user/5339/cluster/6039/controller");
        const json = await response.json();

        if (json.code === 200 && json.data && json.data.length > 0) {
            const data = json.data[0];
            const isRunning = data.Power === "1";

            // Update Header Banner
            if (isRunning) {
                dot.className = "status-dot active m-0";
                text.textContent = "Running";
                banner.style.background = "rgba(16, 133, 66, 0.15)";
                banner.style.borderBottom = "2px solid var(--accent-emerald)";
                image.src = "images/motor-on.png";
                image.style.filter = "drop-shadow(0 0 20px var(--accent-emerald))";
                desc.textContent = "Transferring water from the supply well to the main farm well.";
                desc.className = "text-white opacity-75";
            } else {
                dot.className = "status-dot inactive m-0";
                text.textContent = "OFF / STOPPED";
                banner.style.background = "rgba(248, 113, 113, 0.25)";
                banner.style.borderBottom = "2px solid var(--danger)";
                image.src = "images/motor-off.png";
                image.style.filter = "drop-shadow(0 0 20px var(--danger))";
                desc.textContent = "Transfer pump is OFF. Main well is not receiving water.";
                desc.className = "text-danger fw-bold";
            }

            // Update Details
            document.getElementById("sm-device-name").textContent = data.deviceName || "--";
            document.getElementById("sm-msg-desc").textContent = data.msgDesc || "--";
            document.getElementById("sm-motor-status").textContent = data.motorStatus || "--";
            document.getElementById("sm-latest-msg").textContent = data.ctrlLatestMsg || "--";
            document.getElementById("sm-op-mode").textContent = data.operationMode === "10" ? "Auto" : "Manual";
            document.getElementById("sm-sim-number").textContent = data.simNumber || "--";
        }
    } catch (err) {
        console.error("Failed to fetch supply motor status:", err);
        if (text) text.textContent = "Error fetching status";
        if (dot) dot.className = "status-dot warning m-0";
    }
}

// --- Secondary Supply Motor Status Fetching (Well) ---
async function fetchSecondarySupplyMotorStatus() {
    const dot = document.getElementById("supply-motor2-dot");
    const text = document.getElementById("supply-motor2-status-text");
    const banner = document.getElementById("supply-motor2-status-banner");
    const image = document.getElementById("supply-motor2-image");
    const desc = document.getElementById("supply-motor2-desc");

    if (!dot || !text || !banner || !image || !desc) return;

    try {
        const response = await fetch("https://gsm.liveskytech.com:3001/getMotors?imei=860537060208758", {
            method: 'GET',
            headers: {
                'Host': 'gsm.liveskytech.com:3001',
                'Accept': 'application/json, text/plain, */*',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybWFpbCI6InNpYmhpLmd2QGdtYWlsLmNvbSIsInNlc3Npb24iOjE3NzE5MTkyNzMwMzYsIm1vYmlsZV9ubyI6Ijg4MjU2MjIzNjAiLCJpYXQiOjE3NzE5MTkyNzMsImV4cCI6MTc3MjAwNTY3M30.DR40j_VPZ3QxwNFCO4VhWV64iOo8EwfTKZXTOXqK6KM',
                'User-Agent': 'SSC/1 CFNetwork/3860.300.31 Darwin/25.2.0',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        const json = await response.json();

        if (json && json.length > 0) {
            const data = json[0];
            const isRunning = data.motor_status === "MOTORON";

            // Update Header Banner
            if (isRunning) {
                dot.className = "status-dot active m-0";
                text.textContent = "Running";
                banner.style.background = "rgba(16, 133, 66, 0.15)";
                banner.style.borderBottom = "2px solid var(--accent-emerald)";
                image.src = "images/motor-on.png";
                image.style.filter = "drop-shadow(0 0 20px var(--accent-emerald))";
                desc.textContent = "Pumping water from the river to the supply well.";
                desc.className = "text-white opacity-75";
            } else {
                dot.className = "status-dot inactive m-0";
                text.textContent = "OFF / STOPPED";
                banner.style.background = "rgba(248, 113, 113, 0.25)";
                banner.style.borderBottom = "2px solid var(--danger)";
                image.src = "images/motor-off.png";
                image.style.filter = "drop-shadow(0 0 20px var(--danger))";
                desc.textContent = "River pump is OFF. Supply well is not receiving water.";
                desc.className = "text-danger fw-bold";
            }

            // Update Details
            document.getElementById("sm2-phase").textContent = data.phase ? `${data.phase} Phase` : "--";
            document.getElementById("sm2-runtime").textContent = data.runtime || "--";
            document.getElementById("sm2-motor-status").textContent = data.motor_status || "--";
            document.getElementById("sm2-last-connect").textContent = data.time || "--";
            document.getElementById("sm2-op-mode").textContent = data.mode || "--";
            document.getElementById("sm2-network").textContent = (data.modem_model || "") + " " + (data.mobile_operator_name || "");
        }
    } catch (err) {
        console.error("Failed to fetch secondary supply motor status:", err);
        if (text) text.textContent = "Error fetching status";
        if (dot) dot.className = "status-dot warning m-0";
    }
}

// --- Quick Date Presets Utility ---
function setupDatePresets() {
    const datePairs = [
        { label: 'Energy', single: 'energy-history-date', action: 'fetch-energy-btn' },
        { label: 'Pressure', from: 'pressure-from-date', to: 'pressure-to-date', action: 'analyze-pressure-btn' },
        { label: 'Fert Chart', from: 'fert-chart-from-date', to: 'fert-chart-to-date', action: 'update-fert-charts-btn' },
        { label: 'Fert History', from: 'fert-history-from-date', to: 'fert-history-to-date', action: 'fetch-fert-history-btn' },
        { label: 'Timer History', from: 'history-from-date', to: 'history-to-date', action: 'fetch-history-btn' }
    ];

    datePairs.forEach(pair => {
        const fromEl = document.getElementById(pair.from || pair.single);
        if (!fromEl) return;

        // Find a parent container to inject into (flex-wrap containers in your HTML)
        const container = fromEl.closest('.d-flex.align-items-center.gap-2, .d-flex.align-items-center.gap-3');
        if (!container) return;

        // Check if presets already exist
        if (container.parentElement.querySelector('.date-presets')) return;

        const presetDiv = document.createElement('div');
        presetDiv.className = 'date-presets w-100 mt-2 mb-3';

        const presets = [
            { name: 'Today', days: 0 },
            { name: 'Yesterday', days: 1 },
            { name: 'Past Week', days: 7 },
            { name: 'Past Month', days: 30 }
        ];

        presets.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'btn preset-btn';
            btn.textContent = p.name;
            btn.onclick = (e) => {
                e.preventDefault();

                // Remove active from others
                presetDiv.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const end = new Date();
                const start = new Date();

                if (p.name === 'Today') {
                    // Today only
                    start.setHours(0, 0, 0, 0);
                } else if (p.name === 'Yesterday') {
                    start.setDate(start.getDate() - 1);
                    end.setDate(end.getDate() - 1);
                } else {
                    start.setDate(start.getDate() - p.days);
                }

                const startStr = start.toLocaleDateString('sv-SE');
                const endStr = end.toLocaleDateString('sv-SE');

                if (pair.single) {
                    fromEl.value = startStr;
                } else {
                    fromEl.value = startStr;
                    const toEl = document.getElementById(pair.to);
                    if (toEl) toEl.value = endStr;
                }

                // Trigger action button if it exists
                const actionBtn = document.getElementById(pair.action);
                if (actionBtn) {
                    setTimeout(() => actionBtn.click(), 100);
                }
            };
            presetDiv.appendChild(btn);
        });

        // Inject near the input container
        container.parentElement.appendChild(presetDiv);
    });
}