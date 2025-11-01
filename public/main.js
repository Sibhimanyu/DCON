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
          console.log(`✅ ${user.email} authorized to add fertigation queue.`);
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
      console.log("✅ Logged in as:", user.email);

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
      console.log("🚪 Logged out");

      userName.textContent = "Sign in with Google";
      userAvatar.src = "images/user-default.png";

      modalUserName.textContent = "Not signed in";
      modalUserEmail.textContent = "";
      modalUserPhoto.src = "images/user-default.png";

      loginBtn.style.display = "block";
      logoutBtn.style.display = "none";

      console.log("ℹ️ Dashboard remains visible even when logged out.");

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
    ctx.strokeStyle = "#e0e0e0";
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
    ctx.fillStyle = "#333";
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
    valueDisplay.textContent = `${difference.toFixed(2)} difference (bar)`;

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
                    phaseCard.style.backgroundColor = "#b0b0b0"; // greyish
                    phaseCard.style.color = "#fff";
                } else {
                    if (phase === "1") {
                        phaseCard.style.backgroundColor = "#ff4d4f";
                    } else if (phase === "2") {
                        phaseCard.style.backgroundColor = "#f7c600";
                    } else if (phase === "3") {
                        phaseCard.style.backgroundColor = "#007bff";
                    }
                    phaseCard.style.color = "#fff";
                }
            }
        }
        setPhaseCardColor("1", volt1);
        setPhaseCardColor("2", volt2);
        setPhaseCardColor("3", volt3);

        // Update pressure gauges
        const inputPressure = parseFloat(live.pressure_in) || 0;
        const outputPressure = parseFloat(live.pressure_out) || 0;
        drawGauge("input-pressure-gauge", inputPressure, 6, "#007bff"); // Max value set to 6 bar
        drawGauge("output-pressure-gauge", outputPressure, 6, "#28a745"); // Max value set to 6 bar

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
        valvesDiv.innerHTML = `<strong>Valves:</strong>  ${timers.current.valves}</ul>`;

        // Enhanced visuals for Sump Status
        const motorImage = document.getElementById("motor-image");
        const motorStatusText = document.getElementById("motor-status-text");
        if (live.sump_status === "On") {
            motorImage.src = "images/motor-on.png";
            if (motorStatusText)
                motorStatusText.innerHTML =
                    '<span style="font-size:2rem;font-weight:bold;">On</span>';
        } else {
            motorImage.src = "images/motor-off.png";
            if (motorStatusText)
                motorStatusText.innerHTML =
                    '<span style="font-size:2rem;font-weight:bold;">Off</span>';
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
            dashboardNextTimer.textContent = `${timers.next.name} (On Time: ${
                timers.next.on_time ?? "N/A"
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
    const today = new Date();
    return today.toISOString().split("T")[0];
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
                            return start <= rangeEnd && end >= rangeStart;
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

        const table = document.createElement("table");
        table.className = "table table-striped table-bordered";
        table.innerHTML = `
      <thead>
        <tr>
          <th class="sortable" data-sort="date">Start Time <span class="sort-icon">⇅</span></th>
          <th class="sortable" data-sort="endTime">End Time <span class="sort-icon">⇅</span></th>
          <th class="sortable" data-sort="name">Timer Name <span class="sort-icon">⇅</span></th>
          <th class="sortable" data-sort="runTime">Run Time <span class="sort-icon">⇅</span></th>
          <th class="sortable" data-sort="valves">Valves <span class="sort-icon">⇅</span></th>
          <th>Active Valves</th>
          <th>Valve Names</th>
          <th class="sortable" data-sort="completed">Completed <span class="sort-icon">⇅</span></th>
          <th class="sortable" data-sort="fertigation">Fertigation <span class="sort-icon">⇅</span></th>
        </tr>
      </thead>
      <tbody>
        ${filteredLogs
            .map((log) => {
                const fertigationInfo = wasFertigationActive(
                    fertigationLogs,
                    new Date(log.dt),
                    new Date(log.last_sync)
                );
                let fertigationCell = "-";
                if (fertigationInfo) {
                    fertigationCell = `
              <div class="d-flex flex-column align-items-center">
                <div class="progress w-100 mb-1" style="height: 5px;">
                  <div class="progress-bar bg-success" style="width: ${fertigationInfo.percentage}%"></div>
                </div>
                <small>${fertigationInfo.duration}</small>
              </div>`;
                }

                // Generate valve images using the same logic as dashboard
                let valveImages = "";
                let openValveNos = [];
                if (log.on_valves) {
                    const valveArr = log.on_valves.split("-");
                    // Get list of open valves
                    for (let i = 0; i < valveArr.length; i++) {
                        if (valveArr[i] !== "0") {
                            openValveNos.push(valveArr[i]);
                        }
                    }

                    // Generate images for each open valve
                    openValveNos.forEach((valveNo) => {
                        let valveName = "";
                        if (valveNo && valveDetails[valveNo]) {
                            valveName =
                                valveDetails[
                                    valveNo
                                ].valve_name?.toLowerCase() || "";
                        }

                        let imgSrc = "images/timer-default.png";
                        if (valveName.includes("coco"))
                            imgSrc = "images/coconut.png";
                        else if (valveName.includes("mango"))
                            imgSrc = "images/mango.png";
                        else if (valveName.includes("house"))
                            imgSrc = "images/house.png";
                        else if (valveName.includes("jamun"))
                            imgSrc = "images/jamun.png";
                        else if (valveName.includes("amla"))
                            imgSrc = "images/amla.png";
                        else if (valveName.includes("backwash"))
                            imgSrc = "images/backwash.png";
                        else if (valveName.includes("grass"))
                            imgSrc = "images/grass.png";
                        else if (
                            valveName.includes("guava") ||
                            valveName.includes("gova")
                        )
                            imgSrc = "images/guava.png";
                        else if (valveName.includes("onion"))
                            imgSrc = "images/onion.png";
                        else if (valveName.includes("pome"))
                            imgSrc = "images/pomegranate.png";
                        else if (valveName.includes("veg"))
                            imgSrc = "images/veg.png";
                        else if (valveName.includes("kulam"))
                            imgSrc = "images/kulam.png";
                        else if (valveName.includes("mulberry"))
                            imgSrc = "images/mulberry.png";
                        else if (!valveName) imgSrc = "images/none.png";

                        valveImages += `
                <div class="d-inline-block text-center" style="margin: 2px;">
                  <img src="${imgSrc}" alt="Valve ${valveNo}" style="width: 30px;">
                </div>`;
                    });
                }

                if (!valveImages) {
                    valveImages = `
              <div class="d-inline-block text-center" style="margin: 2px;">
                <img src="images/none.png" alt="No Valve" style="width: 30px;">
              </div>`;
                }

                // New: Valve Names Cell
                const valveNamesCell = openValveNos.length
                    ? openValveNos
                          .map(
                              (v) =>
                                  valveDetails[v]?.valve_name ||
                                  `Valve ${v}`
                          )
                          .join(", ")
                    : "-";

                return `
            <tr style="cursor: pointer;">
              <td>${log.dt}</td>
              <td>${log.last_sync}</td>
              <td>${log.timer_name}</td>
              <td>${log.run_time}</td>
              <td>${log.on_valves}</td>
              <td class="text-center">${valveImages}</td>
              <td>${valveNamesCell}</td>
              <td>${log.completed === "1" ? "Yes" : "No"}</td>
              <td class="text-center" style="min-width: 100px;">${fertigationCell}</td>
            </tr>
          `;
            })
            .join("")}
      </tbody>
    `;
        timerHistoryContent.innerHTML = "";
        timerHistoryContent.appendChild(table);

        // Add sorting functionality
        let currentSort = { column: null, direction: "asc" };

        function sortTable(column) {
            const tbody = table.querySelector("tbody");
            const rows = Array.from(tbody.querySelectorAll("tr"));

            // Update sort direction
            if (currentSort.column === column) {
                currentSort.direction =
                    currentSort.direction === "asc" ? "desc" : "asc";
            } else {
                currentSort.column = column;
                currentSort.direction = "asc";
            }

            // Update sort icons
            table
                .querySelectorAll(".sort-icon")
                .forEach((icon) => (icon.textContent = "⇅"));
            const currentIcon = table.querySelector(
                `[data-sort="${column}"] .sort-icon`
            );
            if (currentIcon) {
                currentIcon.textContent =
                    currentSort.direction === "asc" ? "↑" : "↓";
            }

            // Sort rows
            rows.sort((a, b) => {
                let aValue, bValue;

                switch (column) {
                    case "date":
                    case "endTime":
                        aValue = new Date(
                            a.cells[column === "date" ? 0 : 1].textContent
                        );
                        bValue = new Date(
                            b.cells[column === "date" ? 0 : 1].textContent
                        );
                        break;
                    case "runTime":
                        aValue = parseInt(a.cells[3].textContent) || 0;
                        bValue = parseInt(b.cells[3].textContent) || 0;
                        break;
                    case "completed":
                        // "Completed" is in column index 7
                        aValue = a.cells[7].textContent.trim() === "Yes" ? 1 : 0;
                        bValue = b.cells[7].textContent.trim() === "Yes" ? 1 : 0;
                        break;
                    case "fertigation":
                        // "Fertigation" is in column index 8 and contains HTML progress bar
                        const aBar = a.cells[8].querySelector(".progress-bar");
                        const bBar = b.cells[8].querySelector(".progress-bar");

                        const aPercent = aBar
                            ? parseFloat(aBar.style.width) || 0
                            : (a.cells[8].textContent.trim() === "-" ? 0 : 1);
                        const bPercent = bBar
                            ? parseFloat(bBar.style.width) || 0
                            : (b.cells[8].textContent.trim() === "-" ? 0 : 1);

                        aValue = aPercent;
                        bValue = bPercent;
                        break;
                    default:
                        aValue =
                            a.cells[
                                column === "name" ? 2 : 4
                            ].textContent.toLowerCase();
                        bValue =
                            b.cells[
                                column === "name" ? 2 : 4
                            ].textContent.toLowerCase();
                }

                if (aValue < bValue)
                    return currentSort.direction === "asc" ? -1 : 1;
                if (aValue > bValue)
                    return currentSort.direction === "asc" ? 1 : -1;
                return 0;
            });

            // Reorder rows
            tbody.innerHTML = "";
            rows.forEach((row) => tbody.appendChild(row));
        }

        // Add click handlers to sortable columns
        table.querySelectorAll(".sortable").forEach((header) => {
            header.style.cursor = "pointer";
            header.addEventListener("click", () => {
                sortTable(header.dataset.sort);
            });
        });

        // Switch to pressure analysis tab if a timer is selected
        if (timerName) {
            const pressureTab = document.getElementById(
                "pressure-analysis-tab"
            );
            const pressureDropdown = document.getElementById(
                "pressure-timer-dropdown"
            );
            pressureDropdown.value = timerName;
            pressureTab.click();
            graphAllPressures(filteredLogs);
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
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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
            )}&to=${encodeURIComponent(log.last_sync)}&product=DCON`;
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
        const backwashColor = "rgba(255, 230, 0, 0.29)";
        let shownBackwash = false;

        allPressureData.forEach((segment, index) => {
            if (segment.data.length > 0) {
                const isBackwash = logs[index].timer_name
                    .toLowerCase()
                    .includes("backwash");
                const hue = index * (360 / allPressureData.length);
                const segmentColor = isBackwash
                    ? backwashColor
                    : `hsla(${hue}, 70%, 50%, 0.2)`;
                const inputColor = "#007bff";
                const outputColor = "#28a745";

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

                // Add background area for this segment's time range
                const timeStart = new Date(segment.data[0].dt).getTime();
                const timeEnd = new Date(
                    segment.data[segment.data.length - 1].dt
                ).getTime();

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
                        label:
                            isBackwash && !shownBackwash
                                ? "Backwash (Input)"
                                : labelName
                                ? `${labelName} (Input)`
                                : "",
                        data: segment.data.map((entry) => ({
                            x: entry.dt,
                            y: parseFloat(entry.pressure.split("-")[0]),
                        })),
                        borderColor: inputColor,
                        backgroundColor: segmentColor,
                        fill: true,
                        segment: segment.timestamp,
                        pointRadius: 2,
                    },
                    {
                        label:
                            isBackwash && !shownBackwash
                                ? "Backwash (Output)"
                                : labelName
                                ? `${labelName} (Output)`
                                : "",
                        data: segment.data.map((entry) => ({
                            x: entry.dt,
                            y: parseFloat(entry.pressure.split("-")[1]),
                        })),
                        borderColor: outputColor,
                        backgroundColor: "transparent",
                        fill: false,
                        segment: segment.timestamp,
                        borderDash: [5, 5],
                        pointRadius: 2,
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

        // Create chart
        chartContainer.innerHTML = `
      <div class="text-center mb-3">
        <small class="text-muted">Note: Solid lines represent input pressure, dashed lines represent output pressure</small>
      </div>
      <div style="height: 500px;">
        <canvas id="pressure-chart"></canvas>
      </div>
    `;
        const ctx = document.getElementById("pressure-chart").getContext("2d");
        new Chart(ctx, {
            type: "line",
            data: {
                datasets: datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                    },
                },
                interaction: {
                    mode: "nearest",
                    axis: "x",
                    intersect: false,
                },
                scales: {
                    x: {
                        title: { display: true, text: "Timestamp" },
                        grid: {
                            color: "rgba(0,0,0,0.1)",
                        },
                    },
                    y: {
                        title: { display: true, text: "Pressure (bar)" },
                        min: minPressure,
                        max: maxPressure,
                        ticks: {
                            stepSize: 0.5,
                        },
                        grid: {
                            color: "rgba(0,0,0,0.1)",
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
            )}&to=${encodeURIComponent(to)}&product=DCON`
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
      <div style="height: 500px;">
        <canvas id="pressure-chart"></canvas>
      </div>
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
                        borderColor: "#007bff",
                        fill: false,
                    },
                    {
                        label: "Output Pressure (bar)",
                        data: outputPressure,
                        borderColor: "#28a745",
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
    const timerRows = document.querySelectorAll(
        "#timer-history-content table tbody tr"
    );
    timerRows.forEach((row) => {
        row.addEventListener("click", () => {
            const from = row.cells[0].textContent.trim();
            const to = row.cells[1].textContent.trim();
            const timerName = row.cells[2].textContent.trim();
            const pressureTab = document.getElementById(
                "pressure-analysis-tab"
            );
            const pressureDropdown = document.getElementById(
                "pressure-timer-dropdown"
            );
            pressureDropdown.value = timerName;
            pressureTab.click();
            fetchPressureData(from, to);
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
                `Pressure difference (${pressureDiff.toFixed(
                    2
                )} bar) is higher than normal (${avgPressureDiff.toFixed(
                    2
                )} bar avg).`
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
                        `${phase.replace(/_/g, " ")} is low (${
                            live[phase]
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
                `Current imbalance detected (Range: ${minCurr}A - ${maxCurr}A).`
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
            ✅ No anomalies detected. All systems operating normally.
          </div>`;
            } else {
                const listItems = anomalies
                    .map((a) => `<li>${a}</li>`)
                    .join("");
                insightsDiv.innerHTML = `
          <div class="alert alert-warning text-start">
            <strong>⚠️ Anomalies Detected:</strong>
            <ul>${listItems}</ul>
          </div>`;
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

// --- Dashboard Data Fetch: Triggers Cloud Function before loading ---
async function fetchAllDashboardData() {
    // Replace <REGION> and <PROJECT_ID> with your actual values
    const cloudFunctionUrl = "https://fetchirrigationdataondemand-m2hab33w6q-uc.a.run.app";
    try {
        await fetch(cloudFunctionUrl);
        console.log("Triggered on-demand data fetch.");
    } catch (err) {
        console.error("Failed to trigger on-demand data fetch:", err);
    }
    // Continue with Firestore-based fetches regardless of function call result
    await Promise.all([
        fetchLiveData(),
        populateDashboardOverview(),
        fetchTimerHistory(),
        updateAiInsights(),
    ]);
}

// Fetch every 5 minutes
setInterval(fetchAllDashboardData, 5 * 60 * 1000);

// --- Populate the timer dropdown and set up history/pressure analysis ---
document.addEventListener("DOMContentLoaded", () => {
  populateTimerDropdown();
  document
    .getElementById("fetch-history-btn")
    .addEventListener("click", fetchTimerHistory);
  document
    .getElementById("analyze-pressure-btn")
    .addEventListener("click", () => {
      const timerName = document.getElementById("pressure-timer-dropdown").value;
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
            from: getTodayDate(),
            to: getTodayDate(),
            timer_name: timerName,
          }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.log && data.log.length > 0) {
              graphAllPressures(data.log);
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
        statusDot.style.backgroundColor = "#28a745";
        statusText.textContent = "Active";
        statusCard.classList.add("border-success");

        // Update timer display
        function updateTimer() {
            const now = new Date();
            const duration = Math.floor((now - startTime) / 1000 / 60); // minutes
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;
            timerDisplay.textContent = `Duration: ${hours}h ${minutes}m`;
        }

        updateTimer();
        // Update timer every minute
        const timerId = setInterval(updateTimer, 60000);
        // Store timer ID as a data attribute to clear it later
        timerDisplay.dataset.timerId = timerId;
    } else {
        statusDot.style.backgroundColor = "#dc3545";
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

async function loadFertigationHistory() {
    const historyTableBody = document.getElementById("fertigation-history");
    historyTableBody.innerHTML =
        '<tr><td colspan="4" class="text-center">Loading...</td></tr>';

    try {
        // Fetch last 10 fertigation logs from Firestore
        const logsRef = db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection("fertigation_logs");

        // Get last 7 days of logs
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const snapshot = await logsRef
            .where("startTime", ">=", sevenDaysAgo)
            .orderBy("startTime", "desc")
            .limit(10)
            .get();

        if (snapshot.empty) {
            historyTableBody.innerHTML =
                '<tr><td colspan="4" class="text-center">No fertigation history found</td></tr>';
            return;
        }

        // For all fertigation logs, fetch timer logs from Mobitech API in one go (for the combined time range)
        const fertigationLogs = snapshot.docs.map((doc) => doc.data());
        // Find overall min start and max end
        let minStart = null;
        let maxEnd = null;
        fertigationLogs.forEach((log) => {
            const s = log.startTime.toDate();
            const e = log.endTime?.toDate() || new Date();
            if (!minStart || s < minStart) minStart = s;
            if (!maxEnd || e > maxEnd) maxEnd = e;
        });
        // Fetch all timer logs from Mobitech API for this range
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
                    from: minStart.toISOString(),
                    to: maxEnd.toISOString(),
                }),
            }
        ).then((res) => res.json());
        const timerLogs = timerResponse.log || [];

        // For each fertigation log, find overlapping timers from timerLogs (by overlap of start/end)
        const processedLogs = fertigationLogs.map((log) => {
            const startTime = log.startTime.toDate();
            const endTime = log.endTime?.toDate();
            // Filter timer logs that overlap
            const overlappingTimers = timerLogs.filter((timer) => {
                const timerStart = new Date(timer.dt);
                const timerEnd = new Date(timer.last_sync);
                // Overlap logic: timer starts before fertigation ends, and timer ends after fertigation starts
                const fertEnd = endTime || new Date();
                return (
                    startTime <= timerEnd &&
                    fertEnd >= timerStart &&
                    timer.on_valves &&
                    timer.on_valves !== "0"
                );
            });
            return {
                ...log,
                overlappingTimers,
            };
        });

        // Render the history table
        historyTableBody.innerHTML = "";
        processedLogs.forEach((log) => {
            const row = document.createElement("tr");
            const startTime = log.startTime.toDate();
            let duration = "In Progress";
            if (log.endTime) {
                duration = `${log.duration} min`;
            }
            // Use timer_name and valves directly from API response
            const timerInfo = log.overlappingTimers
                .map(
                    (timer) =>
                        `${timer.timer_name} (Valves: ${timer.on_valves})`
                )
                .join("<br>");
            row.innerHTML = `
        <td>${startTime.toLocaleString()}</td>
        <td>${duration}</td>
        <td>${timerInfo || "-"}</td>
        <td>${log.notes || "-"}</td>
      `;
            historyTableBody.appendChild(row);
        });
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
  loadFertigationHistory();
  listenFertigationStatus();
});

// --- Real-time Firestore listeners for fertigation history and valve queue ---
db.collection("irrigation_devices")
    .doc("MCON874Q000568")
    .collection("fertigation_logs")
    .onSnapshot(() => {
        loadFertigationHistory();
    });

db.collection("irrigation_devices")
    .doc("MCON874Q000568")
    .collection("fertigation_queue")
    .doc("current_queue")
    .onSnapshot(() => {
        loadValveQueueFromFirestore();
    });

// --- Valve Groups Tab Support ---
async function populateValveGroupCards() {
    const valveCardsContainer = document.getElementById("valve-group-cards");
    valveCardsContainer.innerHTML =
        "<p class='text-muted text-center'>Loading merged timer pressure history...</p>";

    try {
        const timerHistoryTable = document.querySelector(
            "#timer-history-content table tbody"
        );
        if (!timerHistoryTable) {
            valveCardsContainer.innerHTML =
                "<p class='text-center text-muted'>No timer history available.</p>";
            return;
        }

        valveCardsContainer.innerHTML = "";

        const rows = Array.from(timerHistoryTable.querySelectorAll("tr"));
        if (rows.length === 0) {
            valveCardsContainer.innerHTML =
                "<p class='text-center text-muted'>No timer history available.</p>";
            return;
        }

        // Group rows by timer name
        const groupedLogs = {};
        rows.forEach((row) => {
            const timerName = row.cells[2]?.textContent.trim();
            const startTime = row.cells[0]?.textContent.trim();
            const endTime = row.cells[1]?.textContent.trim();
            if (!groupedLogs[timerName]) groupedLogs[timerName] = [];
            groupedLogs[timerName].push({ startTime, endTime });
        });

        let groupIndex = 0;
        for (const [timerName, logs] of Object.entries(groupedLogs)) {
            const canvasId = `timer-pressure-${groupIndex}`;
            const card = document.createElement("div");
            card.className = "col-12 mb-4";
            card.innerHTML = `
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">${timerName}</h5>
            <canvas id="${canvasId}" width="800" height="300"></canvas>
          </div>
        </div>
      `;
            valveCardsContainer.appendChild(card);

            await renderMergedPressureChart(logs, canvasId, timerName);
            groupIndex++;
        }
    } catch (error) {
        console.error("Failed to load merged timer pressure history:", error);
        valveCardsContainer.innerHTML =
            "<p class='text-danger text-center'>Error loading merged timer pressure history.</p>";
    }
}

// --- Render merged pressure chart for valve groups ---
async function renderMergedPressureChart(logs, canvasId, timerName) {
    try {
        const datasets = [];
        let allPressureValues = [];

        let globalFirstTime = null;
        let globalLastTime = null;
        const processedLogs = [];

        for (let i = 0; i < logs.length; i++) {
            const { startTime, endTime } = logs[i];
            const response = await fetch(
                `https://dcon.mobitechwireless.com/v1/http/?action=reports&type=pressure_timer&serial_no=MCON874Q000568&from=${encodeURIComponent(
                    startTime
                )}&to=${encodeURIComponent(endTime)}&product=DCON`
            );
            if (!response.ok) throw new Error("Failed to fetch pressure data");

            const data = await response.json();
            let pressureData = data.data || [];
            if (pressureData.length === 0) continue;

            // Truncate leading and trailing empty data points
            const firstValidIndex = pressureData.findIndex(
                (entry) => entry.pressure && entry.pressure.includes("-")
            );
            const lastValidIndex =
                pressureData.length -
                1 -
                [...pressureData]
                    .reverse()
                    .findIndex(
                        (entry) =>
                            entry.pressure && entry.pressure.includes("-")
                    );
            pressureData = pressureData.slice(
                firstValidIndex,
                lastValidIndex + 1
            );

            if (pressureData.length === 0) continue;

            const firstTime = new Date(pressureData[0].dt).getTime();
            const lastTime = new Date(
                pressureData[pressureData.length - 1].dt
            ).getTime();
            if (globalFirstTime === null || firstTime < globalFirstTime)
                globalFirstTime = firstTime;
            if (globalLastTime === null || lastTime > globalLastTime)
                globalLastTime = lastTime;

            processedLogs.push({ pressureData, index: i });
        }

        if (processedLogs.length === 0) return;

        for (const log of processedLogs) {
            const pressureData = log.pressureData;
            const i = log.index;

            const hue = ((i * 360) / processedLogs.length) % 360;
            const inputColor = `hsla(${hue}, 70%, 50%, 1)`;
            const outputColor = `hsla(${(hue + 180) % 360}, 70%, 50%, 1)`;

            const inputValues = pressureData.map((entry) =>
                parseFloat(entry.pressure.split("-")[0])
            );
            const outputValues = pressureData.map((entry) =>
                parseFloat(entry.pressure.split("-")[1])
            );
            allPressureValues = [
                ...allPressureValues,
                ...inputValues,
                ...outputValues,
            ];

            datasets.push(
                {
                    label: `${timerName} (Input segment ${i + 1})`,
                    data: pressureData.map((entry) => ({
                        x: entry.dt,
                        y: parseFloat(entry.pressure.split("-")[0]),
                    })),
                    borderColor: inputColor,
                    fill: false,
                    pointRadius: 2,
                },
                {
                    label: `${timerName} (Output segment ${i + 1})`,
                    data: pressureData.map((entry) => ({
                        x: entry.dt,
                        y: parseFloat(entry.pressure.split("-")[1]),
                    })),
                    borderColor: outputColor,
                    fill: false,
                    borderDash: [5, 5],
                    pointRadius: 2,
                }
            );
        }

        const minPressure = Math.max(
            0,
            Math.floor(
                Math.min(...allPressureValues.filter((p) => p > 0)) - 0.5
            )
        );
        const maxPressure = Math.ceil(Math.max(...allPressureValues) + 0.5);

        const canvas = document.getElementById(canvasId);
        canvas.style.height = "300px";
        canvas.style.maxHeight = "300px";
        const ctx = canvas.getContext("2d");

        new Chart(ctx, {
            type: "line",
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "top" } },
                interaction: { mode: "nearest", axis: "x", intersect: false },
                scales: {
                    x: {
                        type: "time",
                        time: {
                            parser: true,
                            tooltipFormat: "ll HH:mm",
                        },
                        min: globalFirstTime,
                        max: globalLastTime,
                        title: { display: true, text: "Timestamp" },
                    },
                    y: {
                        title: { display: true, text: "Pressure (bar)" },
                        min: minPressure,
                        max: maxPressure,
                        ticks: { stepSize: 0.5 },
                    },
                },
            },
        });
    } catch (error) {
        console.error(
            `Error rendering merged pressure chart for ${timerName}:`,
            error
        );
    }
}

document
  .getElementById("valve-groups-tab")
  .addEventListener("shown.bs.tab", populateValveGroupCards);

// --- Fertigation Valve Queue Management ---
const valveGroupQueue = [];

// Render the fertigation valve group queue UI.
function renderValveGroupQueue() {
    const list = document.getElementById("valve-group-queue-list");
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
        <button class="btn btn-sm btn-outline-secondary me-1 queue-control-btn" onclick="moveUpInValveGroupQueue(${index})">⬆️</button>
        <button class="btn btn-sm btn-outline-secondary me-1 queue-control-btn" onclick="moveDownInValveGroupQueue(${index})">⬇️</button>
        <button class="btn btn-sm btn-outline-danger queue-control-btn" onclick="removeFromValveGroupQueue(${index})">❌</button>
        </div>
    `;
        list.appendChild(li);
        // Disable queue controls if add button is disabled
        const addBtn = document.getElementById("add-valve-group-btn");
        if (addBtn && addBtn.disabled) {
          li.querySelectorAll(".queue-control-btn").forEach(b => {
            // Don't use actual disabled state — simulate it
            b.classList.add("disabled");
            b.style.opacity = "0.5";
            b.style.pointerEvents = "auto"; // keep clickable
            b.addEventListener("click", (e) => {
              e.preventDefault();
              alert("🚫 You are not authorized to modify the fertigation queue.");
            });
          });
        }
    });
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
        console.log("✅ Valve queue saved to Firestore");
    } catch (error) {
        console.error("❌ Error storing valve queue:", error);
    }
}

/**
 * Add valves to the fertigation valve queue and save.
 * @param {Array} valves - Array of valve objects {id, name}
 */
async function addToValveQueue(valves) {
    valveGroupQueue.push({ valves });
    renderValveGroupQueue();
    await saveValveQueueToFirestore();
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
 * Modal-based valve selection for fertigation valve queue.
 * On confirm, adds selected valves to the queue and saves.
 */
async function openValveSelectionModal() {
    // Fetch latest valve details from Firestore
    let valveDetails = {};
    try {
        const snapshot = await db
            .collection("irrigation_devices")
            .doc("MCON874Q000568")
            .collection(new Date().toISOString().split("T")[0])
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            valveDetails = data.summary?.valve_details || {};
        }
    } catch (error) {
        alert("Failed to fetch valve details.");
        return;
    }

    // Build modal HTML
    const modalId = "valveSelectionModal";
    let modalHtml = `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="${modalId}Label">Select Valves</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="valve-selection-form">
              <div class="mb-3">
                <div class="row">
  `;
    // Display all valves as checkboxes
    Object.keys(valveDetails).forEach((valveNo) => {
        const valveName =
            valveDetails[valveNo].valve_name || `Valve ${valveNo}`;
        modalHtml += `
      <div class="col-12 mb-2">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="${valveNo}" id="valve-checkbox-${valveNo}">
          <label class="form-check-label" for="valve-checkbox-${valveNo}">
            ${valveName}
          </label>
        </div>
      </div>
    `;
    });
    modalHtml += `
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirm-valve-selection-btn">Add Selected Valves</button>
          </div>
        </div>
      </div>
    </div>
  `;
    // Remove any existing modal
    const oldModal = document.getElementById(modalId);
    if (oldModal) oldModal.remove();
    // Append modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    // Show modal using Bootstrap
    const modalEl = document.getElementById(modalId);
    const bsModal = new bootstrap.Modal(modalEl, {});
    bsModal.show();

    // Confirm button logic
    document.getElementById("confirm-valve-selection-btn").onclick =
        async function () {
            const form = document.getElementById("valve-selection-form");
            const checked = Array.from(
                form.querySelectorAll(".form-check-input:checked")
            );
            if (checked.length === 0) {
                alert("Select at least one valve.");
                return;
            }
            const selectedValves = checked.map((cb) => ({
                id: cb.value,
                name: valveDetails[cb.value]?.valve_name || `Valve ${cb.value}`,
            }));
            await addToValveQueue(selectedValves);
            bsModal.hide();
            setTimeout(() => {
                // Remove modal from DOM after hidden
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

// On DOMContentLoaded, only initialize the queue by loading from Firestore.
document.addEventListener("DOMContentLoaded", () => {});
document.addEventListener("DOMContentLoaded", () => {});