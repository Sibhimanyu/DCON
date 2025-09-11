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
      if (motorStatusText) motorStatusText.innerHTML = '<span style="font-size:2rem;font-weight:bold;">On</span>';
    } else {
      motorImage.src = 'images/motor-off.png';
      if (motorStatusText) motorStatusText.innerHTML = '<span style="font-size:2rem;font-weight:bold;">Off</span>';
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

// Timer History
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

async function populateTimerDropdown() {
  const timerDropdown = document.getElementById('history-timer-name-dropdown');
  timerDropdown.innerHTML = '<option value="">All Timers</option>'; // Default option

  try {
    const response = await fetch('https://dcon.mobitechwireless.com/v1/http/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        action: 'logs',
        method: 'timer_log',
        serial_no: 'MCON874Q000568',
        from: getTodayDate(),
        to: getTodayDate()
      })
    });

    if (!response.ok) throw new Error('Failed to fetch timer data');

    const data = await response.json();
    const logs = data.log || [];

    // Extract unique timer names
    const uniqueTimers = [...new Set(logs.map(log => log.timer_name))];

    uniqueTimers.forEach(timerName => {
      const option = document.createElement('option');
      option.value = timerName;
      option.textContent = timerName;
      timerDropdown.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to populate timer dropdown:', error);
  }
}

async function fetchTimerHistory() {
  const timerHistoryContent = document.getElementById('timer-history-content');
  const fromDateInput = document.getElementById('history-from-date');
  const toDateInput = document.getElementById('history-to-date');
  const timerDropdown = document.getElementById('history-timer-name-dropdown'); // Dropdown for timer name

  const fromDate = fromDateInput.value || getTodayDate();
  const toDate = toDateInput.value || getTodayDate();
  const timerName = timerDropdown.value; // Get selected timer name

  timerHistoryContent.innerHTML = '<p class="text-center text-muted">Loading timer history...</p>';

  try {
    const response = await fetch('https://dcon.mobitechwireless.com/v1/http/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        action: 'logs',
        method: 'timer_log',
        serial_no: 'MCON874Q000568',
        from: fromDate,
        to: toDate,
        ...(timerName && { timer_name: timerName }) // Include timer name filter if selected
      })
    });

    if (!response.ok) throw new Error('Failed to fetch timer history');

    const data = await response.json();
    const logs = data.log || [];

    if (logs.length === 0) {
      timerHistoryContent.innerHTML = '<p class="text-center text-muted">No timer history available for the selected date range.</p>';
      return;
    }

    const filteredLogs = timerName
      ? logs.filter(log => log.timer_name === timerName) // Filter logs by selected timer name
      : logs;

    if (filteredLogs.length === 0) {
      timerHistoryContent.innerHTML = '<p class="text-center text-muted">No timer history available for the selected timer.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'table table-striped table-bordered';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date/Time</th>
          <th>Timer Name</th>
          <th>Run Time</th>
          <th>Valves</th>
          <th>Completed</th>
        </tr>
      </thead>
      <tbody>
        ${filteredLogs.map(log => `
          <tr style="cursor: pointer;">
            <td>${log.dt}</td>
            <td>${log.timer_name}</td>
            <td>${log.run_time}</td>
            <td>${log.on_valves}</td>
            <td>${log.completed === '1' ? 'Yes' : 'No'}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    timerHistoryContent.innerHTML = '';
    timerHistoryContent.appendChild(table);

    // Add a button to graph all pressures for the filtered timer
    if (timerName) {
      const graphButton = document.createElement('button');
      graphButton.className = 'btn btn-primary mt-3';
      graphButton.textContent = `Graph Pressures for "${timerName}"`;
      graphButton.addEventListener('click', () => graphAllPressures(filteredLogs));
      timerHistoryContent.appendChild(graphButton);
    }

    attachTimerClickHandlers();
  } catch (error) {
    console.error(error);
    timerHistoryContent.innerHTML = '<p class="text-center text-danger">Failed to load timer history.</p>';
  }
}

function graphAllPressures(logs) {
  const chartContainer = document.getElementById('pressure-chart-container');
  chartContainer.innerHTML = '<p class="text-muted">Loading pressure data...</p>';

  try {
    // Prepare data for Chart.js
    const labels = logs.map(log => log.dt);
    const inputPressures = logs.map(log => parseFloat(log.pressure_in) || 0);
    const outputPressures = logs.map(log => parseFloat(log.pressure_out) || 0);

    // Create chart
    chartContainer.innerHTML = '<canvas id="pressure-chart" style="max-width: 100%; height: 500px;"></canvas>';
    const ctx = document.getElementById('pressure-chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Input Pressure (bar)',
            data: inputPressures,
            borderColor: '#007bff',
            fill: false,
          },
          {
            label: 'Output Pressure (bar)',
            data: outputPressures,
            borderColor: '#28a745',
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
        },
        scales: {
          x: { title: { display: true, text: 'Timestamp' } },
          y: { title: { display: true, text: 'Pressure (bar)' } }
        }
      }
    });
  } catch (error) {
    console.error('Failed to graph pressures:', error);
    chartContainer.innerHTML = '<p class="text-danger">Failed to load pressure data.</p>';
  }
}

async function fetchPressureData(from, to) {
  const chartContainer = document.getElementById('pressure-chart-container');
  chartContainer.innerHTML = '<p class="text-muted">Loading pressure data...</p>';

  try {
    const response = await fetch(`https://dcon.mobitechwireless.com/v1/http/?action=reports&type=pressure_timer&serial_no=MCON874Q000568&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&product=DCON`);
    if (!response.ok) throw new Error('Failed to fetch pressure data');

    const data = await response.json();
    const pressureData = data.data || [];

    if (pressureData.length === 0) {
      chartContainer.innerHTML = '<p class="text-muted">No pressure data available for the selected time period.</p>';
      return;
    }

    // Prepare data for Chart.js
    const labels = pressureData.map(entry => entry.dt);
    const inputPressure = pressureData.map(entry => parseFloat(entry.pressure.split('-')[0]));
    const outputPressure = pressureData.map(entry => parseFloat(entry.pressure.split('-')[1]));

    // Create chart
    chartContainer.innerHTML = '<canvas id="pressure-chart" style="max-width: 100%; height: 500px;"></canvas>'; // Increased height
    const ctx = document.getElementById('pressure-chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Input Pressure (bar)',
            data: inputPressure,
            borderColor: '#007bff',
            fill: false,
          },
          {
            label: 'Output Pressure (bar)',
            data: outputPressure,
            borderColor: '#28a745',
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Allow chart to expand
        plugins: {
          legend: { position: 'top' },
        },
        scales: {
          x: { title: { display: true, text: 'Timestamp' } },
          y: { title: { display: true, text: 'Pressure (bar)' } }
        }
      }
    });
  } catch (error) {
    console.error(error);
    chartContainer.innerHTML = '<p class="text-danger">Failed to load pressure data.</p>';
  }
}

function attachTimerClickHandlers() {
  const timerRows = document.querySelectorAll('#timer-history-content table tbody tr');
  timerRows.forEach(row => {
    row.addEventListener('click', () => {
      const from = row.cells[0].textContent.trim();
      const to = row.nextElementSibling?.cells[0]?.textContent.trim() || from; // Use next row's timestamp or same row
      fetchPressureData(from, to);
      const pressureModal = new bootstrap.Modal(document.getElementById('pressureModal'));
      pressureModal.show();
    });
  });
}

// Dashboard Overview and Timer History fetch
function fetchAllDashboardData() {
  fetchLiveData();
  populateDashboardOverview();
  fetchTimerHistory();
}

// Initial fetch
fetchAllDashboardData();

// Fetch every 5 minutes
setInterval(fetchAllDashboardData, 5 * 60 * 1000);

// Populate the timer dropdown on page load
document.addEventListener('DOMContentLoaded', () => {
  populateTimerDropdown();
  document.getElementById('fetch-history-btn').addEventListener('click', fetchTimerHistory); // Attach fetch button event
});