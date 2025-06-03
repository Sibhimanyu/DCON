// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCzS6245V48Mb-q91qpjqK2l8o87MJ9Hho",
  authDomain: "mobitech-c93c0.firebaseapp.com",
  projectId: "mobitech-c93c0",
  storageBucket: "mobitech-c93c0.appspot.com",
  messagingSenderId: "284819435696",
  appId: "1:284819435696:web:933fae6a22a0b05ecdcb75",
  measurementId: "G-M1KEW3J26N"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Fetch live data
async function fetchLiveData() {
  const liveContainer = document.getElementById('live-data');
  const currentTimer = document.getElementById('current-timer');
  const nextTimer = document.getElementById('next-timer');
  liveContainer.innerHTML = '';
  currentTimer.textContent = '';
  nextTimer.textContent = '';

  const snapshot = await db.collection('irrigation_devices').doc('MCON874Q000568').collection(new Date().toISOString().split('T')[0]).orderBy('timestamp', 'desc').limit(1).get();
  if (!snapshot.empty) {
    const data = snapshot.docs[0].data();
    const live = data.summary.live_data;

    Object.entries(live).forEach(([key, val]) => {
      const col = document.createElement('div');
      col.className = 'col-md-4';
      col.innerHTML = `
        <div class="card h-100">
          <div class="card-body d-flex flex-column justify-content-center text-center">
            <h5 class="card-title text-uppercase text-muted" style="font-size: 0.9rem;">${key.replace(/_/g, ' ')}</h5>
            <p class="display-6 fw-semibold text-primary mb-0">${val}</p>
          </div>
        </div>`;
      liveContainer.appendChild(col);
    });

    const timers = data.summary.timers;
    // Progress bar for current timer
    const currentTimerDuration = parseInt(timers.current.run_time) || 0;
    const currentTimerRemaining = parseInt(timers.current.remaining_time) || 0;
    const currentTimerProgress = currentTimerDuration > 0 ? Math.round(((currentTimerDuration - currentTimerRemaining) / currentTimerDuration) * 100) : 0;
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
    liveContainer.classList.add('animate__animated', 'animate__fadeIn');
  }
}

// Fetch history data
async function fetchHistory() {
  const snapshot = await db.collection('irrigation_devices').doc('MCON874Q000568').collection(new Date().toISOString().split('T')[0]).orderBy('timestamp', 'desc').limit(20).get();
  const labels = [];
  const volt1 = [], volt2 = [], volt3 = [], curr1 = [], curr2 = [], curr3 = [];

  snapshot.forEach(doc => {
    const data = doc.data().summary.live_data;
    labels.push(doc.data().timestamp);
    volt1.push(data.voltage_phase_1 || 0);
    volt2.push(data.voltage_phase_2 || 0);
    volt3.push(data.voltage_phase_3 || 0);
    curr1.push(data.current_phase_1 || 0);
    curr2.push(data.current_phase_2 || 0);
    curr3.push(data.current_phase_3 || 0);
  });

  const voltageCtx = document.getElementById('voltage-chart').getContext('2d');
  new Chart(voltageCtx, {
    type: 'line',
    data: {
      labels: labels.reverse(),
      datasets: [
        { label: 'Phase 1', data: volt1.reverse(), borderColor: 'red' },
        { label: 'Phase 2', data: volt2.reverse(), borderColor: 'blue' },
        { label: 'Phase 3', data: volt3.reverse(), borderColor: 'green' }
      ]
    }
  });

  const currentCtx = document.getElementById('current-chart').getContext('2d');
  new Chart(currentCtx, {
    type: 'line',
    data: {
      labels: labels.reverse(),
      datasets: [
        { label: 'Phase 1', data: curr1.reverse(), borderColor: 'orange' },
        { label: 'Phase 2', data: curr2.reverse(), borderColor: 'purple' },
        { label: 'Phase 3', data: curr3.reverse(), borderColor: 'teal' }
      ]
    }
  });
}

function drawGauge(canvasId, value, maxValue, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`Canvas with ID '${canvasId}' not found.`);
    return;
  }
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 10;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background arc
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.25 * Math.PI, false);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#e0e0e0';
  ctx.stroke();

  // Draw value arc
  const endAngle = 0.75 * Math.PI + (value / maxValue) * (1.5 * Math.PI);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, endAngle, false);
  ctx.lineWidth = 10;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Draw text
  ctx.font = '16px Arial';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${value} bar`, centerX, centerY); // Display value in bar
}

// Update pressure difference bar and value
function updatePressureDifference(inputPressure, outputPressure) {
  const difference = Math.abs(inputPressure - outputPressure);
  const maxDifference = 3; // Assuming max difference is 6 bar
  const percentage = Math.min((difference / maxDifference) * 100, 100);
  const bar = document.getElementById('pressure-difference-bar');
  const valueDisplay = document.getElementById('pressure-difference-value');

  bar.style.width = `${percentage}%`;
  bar.ariaValueNow = percentage;
  valueDisplay.textContent = `${difference.toFixed(2)} difference (bar)`;

  // Set color based on intensity
  if (difference <= 0.2) {
    bar.className = 'progress-bar bg-success'; // Low intensity
  } else if (difference > 0.2 && difference <= 0.9) {
    bar.className = 'progress-bar bg-warning'; // Good intensity
  } else if (difference > 0.9 && difference <= 2) {
    bar.className = 'progress-bar bg-danger'; // Bad intensity
  } else {
    bar.className = 'progress-bar bg-dark'; // Extreme cases
  }
}

// Dashboard Overview
async function populateDashboardOverview() {
  const snapshot = await db.collection('irrigation_devices').doc('MCON874Q000568').collection(new Date().toISOString().split('T')[0]).orderBy('timestamp', 'desc').limit(1).get();
  if (!snapshot.empty) {
    const data = snapshot.docs[0].data();
    const live = data.summary.live_data || {};

    // Update last updated time
    const serverTime = data.summary.device_info.server_time || 'N/A';
    document.getElementById('last-updated-time').textContent = `Last updated: ${serverTime}`;

    // Update voltage and current boxes
    const volt1 = live.voltage_phase_1 ?? 'N/A';
    const volt2 = live.voltage_phase_2 ?? 'N/A';
    const volt3 = live.voltage_phase_3 ?? 'N/A';
    const curr1 = live.current_phase_1 ?? 'N/A';
    const curr2 = live.current_phase_2 ?? 'N/A';
    const curr3 = live.current_phase_3 ?? 'N/A';

    document.getElementById('voltage-phase-1-box').textContent = `${volt1} V`;
    document.getElementById('current-phase-1-box').textContent = `${curr1} A`;
    document.getElementById('voltage-phase-2-box').textContent = `${volt2} V`;
    document.getElementById('current-phase-2-box').textContent = `${curr2} A`;
    document.getElementById('voltage-phase-3-box').textContent = `${volt3} V`;
    document.getElementById('current-phase-3-box').textContent = `${curr3} A`;

    // Set phase card background color based on voltage
    function setPhaseCardColor(phase, voltage) {
      const phaseCard = document.querySelector(`#voltage-phase-${phase}-box`).closest('.text-center');
      if (phaseCard) {
        if (parseFloat(voltage) === 0) {
          phaseCard.style.backgroundColor = '#b0b0b0'; // greyish
          phaseCard.style.color = '#fff';
        } else {
          if (phase === '1') {
            phaseCard.style.backgroundColor = '#ff4d4f';
          } else if (phase === '2') {
            phaseCard.style.backgroundColor = '#f7c600';
          } else if (phase === '3') {
            phaseCard.style.backgroundColor = '#007bff';
          }
          phaseCard.style.color = '#fff';
        }
      }
    }
    setPhaseCardColor('1', volt1);
    setPhaseCardColor('2', volt2);
    setPhaseCardColor('3', volt3);

    // Update pressure gauges
    const inputPressure = parseFloat(live.pressure_in) || 0;
    const outputPressure = parseFloat(live.pressure_out) || 0;
    drawGauge('input-pressure-gauge', inputPressure, 6, '#007bff'); // Max value set to 6 bar
    drawGauge('output-pressure-gauge', outputPressure, 6, '#28a745'); // Max value set to 6 bar

    // Update pressure difference
    updatePressureDifference(inputPressure, outputPressure);

    // Update pressure flow bar visuals
    const inputFlow = document.getElementById('input-flow');
    const outputFlow = document.getElementById('output-flow');
    if (inputFlow && outputFlow) {
      inputFlow.style.width = `${Math.min((inputPressure / 100) * 100, 100)}%`;
      outputFlow.style.width = `${Math.min((outputPressure / 100) * 100, 100)}%`;
    }

    const timers = data.summary.timers;

    // Update timer text
    let currentTimerText = `${timers.current.name} (${timers.current.remaining_time} min)`;
    // Show open valve name if in Manual Mode and valve name is present
    if (
      timers.current.name &&
      timers.current.name.toLowerCase().includes('manual mode') &&
      timers.current.valve_name
    ) {
      currentTimerText += ` - ${timers.current.valve_name}`;
    }
    document.getElementById('dashboard-current-timer').textContent = currentTimerText;

    // Add: Show valves list if present
    const valvesDiv = document.getElementById('dashboard-current-valves');
    valvesDiv.innerHTML = `<strong>Valves:</strong>  ${timers.current.valves}</ul>`;

    // Enhanced visuals for Sump Status
    const motorImage = document.getElementById('motor-image');
    const motorStatusText = document.getElementById('motor-status-text');
    if (live.sump_status === 'On') {
      motorImage.src = 'images/motor-on.png';
      if (motorStatusText) motorStatusText.textContent = 'On';
    } else {
      motorImage.src = 'images/motor-off.png';
      if (motorStatusText) motorStatusText.textContent = 'Off';
    }

    // --- Begin: Timer image selection based on open valve(s) ---
    const timerImagesDiv = document.getElementById('timer-images');
    // Make the container flex and wrap for side-by-side images
    timerImagesDiv.style.display = 'flex';
    timerImagesDiv.style.flexWrap = 'wrap';
    timerImagesDiv.style.justifyContent = 'center';
    timerImagesDiv.innerHTML = '';
    const valveDetails = data.summary.valve_details || {};
    let openValveNos = [];
    if (timers.current.valves) {
      const valveArr = timers.current.valves.split('-');
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
      const img = document.createElement('img');
      img.src = 'images/none.png';
      img.alt = 'No Valve';
      img.style.width = valveImgWidth + 'px';
      timerImagesDiv.appendChild(img);
    } else {
      openValveNos.forEach(openValveNo => {
        let valveName = '';
        if (openValveNo && valveDetails[openValveNo]) {
          valveName = valveDetails[openValveNo].valve_name?.toLowerCase() || '';
        }
        let imgSrc = 'images/timer-default.png';
        if (valveName.includes('coco')) {
          imgSrc = 'images/coconut.png';
        } else if (valveName.includes('mango')) {
          imgSrc = 'images/mango.png';
        } else if (valveName.includes('house')) {
          imgSrc = 'images/house.png';
        } else if (valveName.includes('jamun')) {
          imgSrc = 'images/jamun.png';
        } else if (valveName.includes('amla')) {
          imgSrc = 'images/amla.png';
        } else if (valveName.includes('backwash')) {
          imgSrc = 'images/backwash.png';
        } else if (valveName.includes('grass')) {
          imgSrc = 'images/grass.png';
        } else if (valveName.includes('guava') || valveName.includes('gova')) {
          imgSrc = 'images/guava.png';
        } else if (valveName.includes('onion')) {
          imgSrc = 'images/onion.png';
        } else if (valveName.includes('pome')) {
          imgSrc = 'images/pomegranate.png';
        } else if (valveName.includes('veg')) {
          imgSrc = 'images/veg.png';
        } else if (valveName.includes('kulam')) {
          imgSrc = 'images/kulam.png';
        } else if (valveName.includes('mulberry')) {
          imgSrc = 'images/mulberry.png';
        } else if (!valveName) {
          imgSrc = 'images/none.png';
        }
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = valveName || 'Valve';
        img.style.width = valveImgWidth + 'px';
        img.style.transition = 'width 0.2s';
        timerImagesDiv.appendChild(img);
      });
    }
    // --- End: Timer image selection based on open valve(s) ---

    // Add: Enhanced visuals for Next Timer
    const nextTimerImage = document.getElementById('next-timer-image');
    const dashboardNextTimer = document.getElementById('dashboard-next-timer');
    if (timers.next && timers.next.name) {
      dashboardNextTimer.textContent = `${timers.next.name} (On Time: ${timers.next.on_time ?? 'N/A'})`;
      let nextTimerName = timers.next.name?.toLowerCase() || '';
      if (nextTimerName.includes('coco')) {
        nextTimerImage.src = 'images/coconut.png';
      } else if (nextTimerName.includes('mango')) {
        nextTimerImage.src = 'images/mango.png';
      } else if (nextTimerName.includes('house')) {
        nextTimerImage.src = 'images/house.png';
      } else if (nextTimerName.includes('jamun')) {
        nextTimerImage.src = 'images/jamun.png';
      } else if (nextTimerName.includes('amla')) {
        nextTimerImage.src = 'images/amla.png';
      } else if (nextTimerName.includes('backwash')) {
        nextTimerImage.src = 'images/backwash.png';
      } else if (nextTimerName.includes('grass')) {
        nextTimerImage.src = 'images/grass.png';
      } else if (nextTimerName.includes('guava')) {
        nextTimerImage.src = 'images/guava.png';
      } else if (nextTimerName.includes('onion')) {
        nextTimerImage.src = 'images/onion.png';
      } else if (nextTimerName.includes('pome')) {
        nextTimerImage.src = 'images/pomegranate.png';
      } else if (nextTimerName.includes('manual')) {
        nextTimerImage.src = 'images/timer-default.png';
      } else if (nextTimerName.includes('veg')) {
        nextTimerImage.src = 'images/veg.png';
      } else if (nextTimerName.includes('kulam')) {
        nextTimerImage.src = 'images/kulam.png';
      } else if (nextTimerName.includes('mulberry')) {
        nextTimerImage.src = 'images/mulberry.png';
      } else {
        nextTimerImage.src = 'images/none.png';
      }
    } else {
      dashboardNextTimer.textContent = 'N/A';
      nextTimerImage.src = 'images/none.png';
    }

    // Apply faded effect to timer images if motor is off
    if (live.sump_status === 'Off') {
      Array.from(timerImagesDiv.querySelectorAll('img')).forEach(img => {
        img.style.filter = 'grayscale(100%) brightness(0.7)';
      });
      nextTimerImage.style.filter = 'grayscale(100%) brightness(0.7)';
    } else {
      Array.from(timerImagesDiv.querySelectorAll('img')).forEach(img => {
        img.style.filter = '';
      });
      nextTimerImage.style.filter = '';
    }
  } else {
    console.error("No data found for today's date.");
  }
}

async function fetchPressureHistory() {
  const snapshot = await db.collection('irrigation_devices')
    .doc('MCON874Q000568')
    .collection(new Date().toISOString().split('T')[0])
    .orderBy('timestamp', 'desc')
    .limit(100) // Fetch more data points
    .get();

  const labels = [], inputPressures = [], outputPressures = [], pressureDifferences = [];

  snapshot.forEach(doc => {
    const data = doc.data().summary.live_data;
    const inputPressure = parseFloat(data.pressure_in) || 0;
    const outputPressure = parseFloat(data.pressure_out) || 0;
    labels.push(new Date(doc.data().timestamp).toLocaleTimeString());
    inputPressures.push(inputPressure);
    outputPressures.push(outputPressure);
    pressureDifferences.push(Math.abs(inputPressure - outputPressure)); // Calculate difference
  });

  const pressureCtx = document.getElementById('pressure-chart').getContext('2d');
  new Chart(pressureCtx, {
    type: 'line',
    data: {
      labels: labels.reverse(),
      datasets: [
        {
          label: 'Input Pressure',
          data: inputPressures.reverse(),
          borderColor: 'navy',
          fill: false,
          tension: 0.4
        },
        {
          label: 'Output Pressure',
          data: outputPressures.reverse(),
          borderColor: 'darkred',
          fill: false,
          tension: 0.4
        },
        {
          label: 'Pressure Difference',
          data: pressureDifferences.reverse(),
          borderColor: 'green',
          fill: false,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Pressure (bar)'
          },
          beginAtZero: true
        }
      }
    }
  });
}

// Timer History (Timeline)
async function fetchTimerHistory(startDate, endDate) {
  const container = document.getElementById('timer-history-data');
  container.innerHTML = ''; // Clear previous content
  const timeline = document.createElement('div');
  timeline.className = 'timeline';
  container.appendChild(timeline);

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // Include the entire end date

  const seenTimers = new Set();

  while (start <= end) {
    const dateString = start.toISOString().split('T')[0];
    const snapshot = await db.collection('irrigation_devices')
      .doc('MCON874Q000568')
      .collection(dateString)
      .orderBy('timestamp', 'desc')
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const timers = data.summary.timers;

      if (timers && timers.current && timers.current.name) {
        const key = `${timers.current.name}-${timers.current.number}`;
        if (!seenTimers.has(key)) {
          seenTimers.add(key);

          const item = document.createElement('div');
          item.className = 'timeline-item';
          item.innerHTML = `
            <div class="card">
              <div class="card-body">
                <h5 class="card-title">${timers.current.name}</h5>
                <p><strong>Run Time:</strong> ${timers.current.run_time} minutes</p>
                <p><strong>Remaining Time:</strong> ${timers.current.remaining_time} minutes</p>
                <p><strong>Completed:</strong> ${timers.current.completed ? 'Yes' : 'No'}</p>
                <p><strong>Start Time:</strong> ${timers.current.start_time}</p>
                <p><strong>Timestamp:</strong> ${new Date(doc.data().timestamp).toLocaleString()}</p>
              </div>
            </div>
          `;
          timeline.appendChild(item);
        }
      }
    });

    start.setDate(start.getDate() + 1); // Move to the next day
  }
}

document.getElementById('fetch-timer-history').addEventListener('click', () => {
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;

  if (startDate && endDate) {
    fetchTimerHistory(startDate, endDate);
  } else {
    alert('Please select both start and end dates.');
  }
});

async function fetchTimerPressureHistory(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // Include the entire end date

  const timerData = {};

  while (start <= end) {
    const dateString = start.toISOString().split('T')[0];
    const snapshot = await db.collection('irrigation_devices')
      .doc('MCON874Q000568')
      .collection(dateString)
      .orderBy('timestamp', 'asc')
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const timers = data.summary.timers;
      const live = data.summary.live_data;

      if (timers && timers.current && live) {
        const timerName = timers.current.name;
        if (!timerData[timerName]) {
          timerData[timerName] = {
            totalRunTime: 0,
            totalInputPressure: 0,
            totalOutputPressure: 0,
            totalPressureDifference: 0,
            count: 0,
            startTime: null,
            endTime: null
          };
        }

        const inputPressure = parseFloat(live.pressure_in) || 0;
        const outputPressure = parseFloat(live.pressure_out) || 0;
        const pressureDifference = Math.abs(inputPressure - outputPressure);

        timerData[timerName].totalRunTime += parseInt(timers.current.run_time) || 0;
        timerData[timerName].totalInputPressure += inputPressure;
        timerData[timerName].totalOutputPressure += outputPressure;
        timerData[timerName].totalPressureDifference += pressureDifference;
        timerData[timerName].count += 1;

        const timestamp = new Date(doc.data().timestamp);
        if (!timerData[timerName].startTime || timestamp < timerData[timerName].startTime) {
          timerData[timerName].startTime = timestamp;
        }
        if (!timerData[timerName].endTime || timestamp > timerData[timerName].endTime) {
          timerData[timerName].endTime = timestamp;
        }
      }
    });

    start.setDate(start.getDate() + 1); // Move to the next day
  }

  const tableBody = document.getElementById('timer-pressure-history-table-body');
  tableBody.innerHTML = ''; // Clear previous content

  Object.entries(timerData).forEach(([timerName, data]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${timerName}</td>
      <td>${(data.totalInputPressure / data.count).toFixed(2)}</td>
      <td>${(data.totalOutputPressure / data.count).toFixed(2)}</td>
      <td>${(data.totalPressureDifference / data.count).toFixed(2)}</td>
      <td>${data.startTime.toLocaleString()}</td>
      <td>${data.endTime.toLocaleString()}</td>
    `;
    tableBody.appendChild(row);
  });
}

document.getElementById('fetch-timer-pressure-history').addEventListener('click', () => {
  const startDate = document.getElementById('start-date-pressure').value;
  const endDate = document.getElementById('end-date-pressure').value;

  if (startDate && endDate) {
    fetchTimerPressureHistory(startDate, endDate);
  } else {
    alert('Please select both start and end dates.');
  }
});

// Run on load
populateDashboardOverview();
fetchPressureHistory();
fetchTimerHistory(); // Fetch once on load
fetchTimerPressureHistory(); // Fetch once on load

// Refresh data every minute (excluding timer history and timer pressure history)
setInterval(() => {
  fetchLiveData();
  fetchHistory();
  populateDashboardOverview();
  fetchPressureHistory();
}, 60000); // Refresh every 1 minute