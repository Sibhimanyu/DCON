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
    const valveDetails = data.summary.valve_details || {};
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
        } else if (valveName.includes('guava')) {
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
  const historyDropdown = document.getElementById('history-timer-name-dropdown');
  const pressureDropdown = document.getElementById('pressure-timer-dropdown');
  historyDropdown.innerHTML = '<option value="">All Timers</option>';
  pressureDropdown.innerHTML = '<option value="">Select Timer</option>';

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
      // Add to history dropdown
      const historyOption = document.createElement('option');
      historyOption.value = timerName;
      historyOption.textContent = timerName;
      historyDropdown.appendChild(historyOption);
      
      // Add to pressure analysis dropdown
      const pressureOption = document.createElement('option');
      pressureOption.value = timerName;
      pressureOption.textContent = timerName;
      pressureDropdown.appendChild(pressureOption);
    });
  } catch (error) {
    console.error('Failed to populate timer dropdown:', error);
  }
}

async function fetchTimerHistory() {
  const timerHistoryContent = document.getElementById('timer-history-content');
  const fromDateInput = document.getElementById('history-from-date');
  const toDateInput = document.getElementById('history-to-date');
  const timerDropdown = document.getElementById('history-timer-name-dropdown');

  const fromDate = fromDateInput.value || getTodayDate();
  const toDate = toDateInput.value || getTodayDate();
  const timerName = timerDropdown.value;

  timerHistoryContent.innerHTML = '<p class="text-center text-muted">Loading timer history...</p>';

  try {
    // First get the latest data for valve details
    const latestSnapshot = await db.collection('irrigation_devices')
      .doc('MCON874Q000568')
      .collection(getTodayDate())
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    const latestData = !latestSnapshot.empty ? latestSnapshot.docs[0].data() : {};
    const valveDetails = latestData.summary?.valve_details || {};

    // Fetch timer logs and fertigation logs in parallel
    const [timerResponse, fertigationLogs] = await Promise.all([
      fetch('https://dcon.mobitechwireless.com/v1/http/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'logs',
          method: 'timer_log',
          serial_no: 'MCON874Q000568',
          from: fromDate,
          to: toDate,
          ...(timerName && { timer_name: timerName })
        })
      }),
      fetchFertigationLogsForDateRange(fromDate, toDate)
    ]);

    if (!timerResponse.ok) throw new Error('Failed to fetch timer history');
    const data = await timerResponse.json();
    const logs = data.log || [];

    if (logs.length === 0) {
      timerHistoryContent.innerHTML = '<p class="text-center text-muted">No timer history available for the selected date range.</p>';
      return;
    }

    const filteredLogs = timerName ? logs.filter((log, index) => {
      if (log.timer_name === timerName) return true;
      if (index > 0 && 
          logs[index - 1].timer_name === timerName && 
          logs[index - 1].completed === '0' &&
          log.timer_name.toLowerCase().includes('backwash')) {
        return true;
      }
      return false;
    }) : logs;

    if (filteredLogs.length === 0) {
      timerHistoryContent.innerHTML = '<p class="text-center text-muted">No timer history available for the selected timer.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'table table-striped table-bordered';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Start Time</th>
          <th>End Time</th>
          <th>Timer Name</th>
          <th>Run Time</th>
          <th>Valves</th>
          <th>Active Valves</th>
          <th>Completed</th>
          <th>Fertigation</th>
        </tr>
      </thead>
      <tbody>
        ${filteredLogs.map(log => {
          const fertigationInfo = wasFertigationActive(fertigationLogs, new Date(log.dt), new Date(log.last_sync));
          let fertigationCell = '-';
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
          let valveImages = '';
          if (log.on_valves) {
            const valveArr = log.on_valves.split('-');
            let openValveNos = [];
            
            // Get list of open valves
            for (let i = 0; i < valveArr.length; i++) {
              if (valveArr[i] !== "0") {
                openValveNos.push(valveArr[i]);
              }
            }

            // Generate images for each open valve
            openValveNos.forEach(valveNo => {
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

          return `
            <tr style="cursor: pointer;">
              <td>${log.dt}</td>
              <td>${log.last_sync}</td>
              <td>${log.timer_name}</td>
              <td>${log.run_time}</td>
              <td>${log.on_valves}</td>
              <td class="text-center">${valveImages}</td>
              <td>${log.completed === '1' ? 'Yes' : 'No'}</td>
              <td class="text-center" style="min-width: 100px;">${fertigationCell}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;

    timerHistoryContent.innerHTML = '';
    timerHistoryContent.appendChild(table);

    // Switch to pressure analysis tab if a timer is selected
    if (timerName) {
      const pressureTab = document.getElementById('pressure-analysis-tab');
      const pressureDropdown = document.getElementById('pressure-timer-dropdown');
      pressureDropdown.value = timerName;
      pressureTab.click();
      graphAllPressures(filteredLogs);
    }

    attachTimerClickHandlers();
  } catch (error) {
    console.error(error);
    timerHistoryContent.innerHTML = '<p class="text-center text-danger">Failed to load timer history.</p>';
  }
}

// Helper function to fetch fertigation logs for a date range
async function fetchFertigationLogsForDateRange(fromDate, toDate) {
  const allLogs = [];
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);
  
  for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
    const currentDate = d.toISOString().split('T')[0];
    const doc = await db.collection('irrigation_devices')
      .doc('MCON874Q000568')
      .collection(currentDate)
      .doc('FERTIGATION_LOGS')
      .get();

    if (doc.exists) {
      const data = doc.data();
      allLogs.push(...(data.logs || []));
    }
  }
  
  return allLogs;
}

// Helper function to format time duration
function formatTimeDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

// Helper function to get overlapping time between timer and fertigation
function getFertigationOverlap(timerStart, timerEnd, fertigationStart, fertigationEnd) {
  const start = Math.max(timerStart.getTime(), fertigationStart.getTime());
  const end = Math.min(timerEnd.getTime(), fertigationEnd.getTime());
  if (start < end) {
    const overlapMinutes = Math.round((end - start) / (1000 * 60));
    const totalTimerMinutes = Math.round((timerEnd - timerStart) / (1000 * 60));
    return {
      duration: formatTimeDuration(overlapMinutes),
      percentage: Math.round((overlapMinutes / totalTimerMinutes) * 100)
    };
  }
  return null;
}

function wasFertigationActive(fertigationLogs, timerStart, timerEnd) {
  const overlaps = fertigationLogs
    .map(log => {
      const fertigationStart = log.startTime.toDate();
      const fertigationEnd = log.endTime ? log.endTime.toDate() : new Date();
      return getFertigationOverlap(timerStart, timerEnd, fertigationStart, fertigationEnd);
    })
    .filter(overlap => overlap !== null);

  if (overlaps.length === 0) return null;

  // Return the total duration and maximum overlap percentage
  const totalDuration = overlaps.reduce((sum, curr) => {
    const minutes = parseInt(curr.duration);
    return sum + minutes;
  }, 0);
  
  return {
    duration: formatTimeDuration(totalDuration),
    percentage: Math.max(...overlaps.map(o => o.percentage))
  };
}

// --- Existing code continues unchanged ---

async function graphAllPressures(logs) {
  const chartContainer = document.getElementById('pressure-chart-container');
  chartContainer.innerHTML = '<p class="text-muted">Loading pressure data...</p>';

  try {
    // Fetch pressure data for each timer segment
    const pressureDataPromises = logs.map(async log => {

      const linktext = `https://dcon.mobitechwireless.com/v1/http/?action=reports&type=pressure_timer&serial_no=MCON874Q000568&from=${encodeURIComponent(log.dt)}&to=${encodeURIComponent(log.last_sync)}&product=DCON`;
      const response = await fetch(linktext);
      if (!response.ok) throw new Error('Failed to fetch pressure data');
      const data = await response.json();
      return {
        timestamp: log.dt,
        data: data.data || []
      };
    });

    const allPressureData = await Promise.all(pressureDataPromises);
    
    // Prepare datasets for each timer segment
    const datasets = [];
    let allPressureValues = [];
    
    // Define backwash color
    const backwashColor = 'rgba(255, 230, 0, 0.29)';
    let shownBackwash = false;

    allPressureData.forEach((segment, index) => {
      if (segment.data.length > 0) {
        const isBackwash = logs[index].timer_name.toLowerCase().includes('backwash');
        const hue = index * (360 / allPressureData.length);
        const segmentColor = isBackwash ? backwashColor : `hsla(${hue}, 70%, 50%, 0.2)`;
        const inputColor = '#007bff';
        const outputColor = '#28a745';
        
        // Extract pressure values
        const inputValues = segment.data.map(entry => parseFloat(entry.pressure.split('-')[0]));
        const outputValues = segment.data.map(entry => parseFloat(entry.pressure.split('-')[1]));
        allPressureValues = [...allPressureValues, ...inputValues, ...outputValues];

        // Add background area for this segment's time range
        const timeStart = new Date(segment.data[0].dt).getTime();
        const timeEnd = new Date(segment.data[segment.data.length - 1].dt).getTime();
        
        const timerName = logs[index].timer_name;
        let labelName = timerName;
        
        // Skip duplicate backwash entries in legend
        if (isBackwash && shownBackwash) {
          labelName = '';  // Empty label to hide from legend
        }
        if (isBackwash) {
          shownBackwash = true;
        }

        datasets.push(
          {
            label: isBackwash && !shownBackwash ? 'Backwash (Input)' : labelName ? `${labelName} (Input)` : '',
            data: segment.data.map(entry => ({
              x: entry.dt,
              y: parseFloat(entry.pressure.split('-')[0])
            })),
            borderColor: inputColor,
            backgroundColor: segmentColor,
            fill: true,
            segment: segment.timestamp,
            pointRadius: 2
          },
          {
            label: isBackwash && !shownBackwash ? 'Backwash (Output)' : labelName ? `${labelName} (Output)` : '',
            data: segment.data.map(entry => ({
              x: entry.dt,
              y: parseFloat(entry.pressure.split('-')[1])
            })),
            borderColor: outputColor,
            backgroundColor: 'transparent',
            fill: false,
            segment: segment.timestamp,
            borderDash: [5, 5],
            pointRadius: 2
          }
        );
      }
    });
    
    // Calculate min/max pressure values
    const minPressure = Math.max(0, Math.floor(Math.min(...allPressureValues.filter(p => p > 0)) - 0.5));
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
    const ctx = document.getElementById('pressure-chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        scales: {
          x: { 
            title: { display: true, text: 'Timestamp' },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            }
          },
          y: { 
            title: { display: true, text: 'Pressure (bar)' },
            min: minPressure,
            max: maxPressure,
            ticks: {
              stepSize: 0.5
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            }
          }
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
    chartContainer.innerHTML = `
      <div style="height: 500px;">
        <canvas id="pressure-chart"></canvas>
      </div>
    `;
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
      const to = row.cells[1].textContent.trim();
      const timerName = row.cells[2].textContent.trim();
      const pressureTab = document.getElementById('pressure-analysis-tab');
      const pressureDropdown = document.getElementById('pressure-timer-dropdown');
      pressureDropdown.value = timerName;
      pressureTab.click();
      fetchPressureData(from, to);
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
  document.getElementById('fetch-history-btn').addEventListener('click', fetchTimerHistory);
  document.getElementById('analyze-pressure-btn').addEventListener('click', () => {
    const timerName = document.getElementById('pressure-timer-dropdown').value;
    if (timerName) {
      // Fetch the logs for this timer and graph pressures
      fetch('https://dcon.mobitechwireless.com/v1/http/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'logs',
          method: 'timer_log',
          serial_no: 'MCON874Q000568',
          from: getTodayDate(),
          to: getTodayDate(),
          timer_name: timerName
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.log && data.log.length > 0) {
          graphAllPressures(data.log);
        }
      })
      .catch(error => console.error('Failed to fetch timer data:', error));
    }
  });
});

// Fertigation Management
let fertigationUpdateInterval = null;

function updateFertigationStatus(isActive = false, startTime = null, notes = '') {
  const statusDot = document.getElementById('fertigation-status-dot');
  const statusText = document.getElementById('fertigation-status-text');
  const timerDisplay = document.getElementById('fertigation-timer');
  const notesDisplay = document.getElementById('fertigation-notes-display');
  const statusCard = document.getElementById('fertigation-status-card');

  if (isActive && startTime) {
    statusDot.style.backgroundColor = '#28a745';
    statusText.textContent = 'Active';
    notesDisplay.textContent = notes || 'No notes';
    statusCard.style.border = '2px solid #28a745';
    // Update timer
    const updateTimer = () => {
      const now = new Date();
      const duration = Math.round((now - startTime) / 1000 / 60); // minutes
      timerDisplay.textContent = `Running for ${duration} minutes`;
    };
    updateTimer();
    if (fertigationUpdateInterval) clearInterval(fertigationUpdateInterval);
    fertigationUpdateInterval = setInterval(updateTimer, 60000); // Update every minute
  } else {
    statusDot.style.backgroundColor = '#6c757d';
    statusText.textContent = 'Inactive';
    timerDisplay.textContent = '';
    notesDisplay.textContent = '';
    statusCard.style.border = '1px solid rgba(0,0,0,.125)';
    if (fertigationUpdateInterval) {
      clearInterval(fertigationUpdateInterval);
      fertigationUpdateInterval = null;
    }
  }
}

// Helper to get today's fertigation log doc ref
function getTodayDocRef() {
  const currentDate = new Date().toISOString().split('T')[0];
  return db.collection('irrigation_devices')
    .doc('MCON874Q000568')
    .collection(currentDate)
    .doc('FERTIGATION_LOGS');
}


// Real-time listener for fertigation status
function listenFertigationStatus() {
  const dateRef = getTodayDocRef();
  dateRef.onSnapshot((doc) => {
    let isActive = false;
    let startTime = null;
    let notes = '';
    let logs = [];
    if (doc.exists) {
      logs = doc.data().logs || [];
      // If any log does not have an endTime, fertigation is considered active
      const activeLog = logs.find(log => !log.endTime);
      if (activeLog) {
        isActive = true;
        startTime = activeLog.startTime.toDate();
        notes = activeLog.notes || '';
      }
    }
    updateFertigationStatus(isActive, startTime, notes);
    // Button enable/disable logic (all users see same state based on Firestore logs)
    if (isActive) {
      // There is an active log: disable start, enable stop, disable notes
      document.getElementById('start-fertigation').disabled = true;
      document.getElementById('stop-fertigation').disabled = false;
      document.getElementById('fertigation-notes').disabled = true;
    } else {
      // No active log: enable start, disable stop, enable notes
      document.getElementById('start-fertigation').disabled = false;
      document.getElementById('stop-fertigation').disabled = true;
      document.getElementById('fertigation-notes').disabled = false;
      // If stopping, reset form
      document.getElementById('fertigation-form').reset();
    }
  });
}

async function loadFertigationHistory() {
  const historyTableBody = document.getElementById('fertigation-history');
  historyTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Loading...</td></tr>';

  try {
    const today = new Date();
    const dates = [];
    
    // Get last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Fetch fertigation logs for each date
    const allLogs = [];
    for (const date of dates) {
      const doc = await db.collection('irrigation_devices')
        .doc('MCON874Q000568')
        .collection(date)
        .doc('FERTIGATION_LOGS')
        .get();

      if (doc.exists) {
        const data = doc.data();
        allLogs.push(...(data.logs || []));
      }
    }

    if (allLogs.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No fertigation history found</td></tr>';
      return;
    }

    // Sort logs by startTime in descending order
    allLogs.sort((a, b) => b.startTime.toDate() - a.startTime.toDate());

    historyTableBody.innerHTML = '';
    allLogs.slice(0, 10).forEach(log => {
      const row = document.createElement('tr');
      const startTime = log.startTime.toDate();
      let duration = 'In Progress';
      
      if (log.endTime) {
        duration = `${log.duration} min`;
      }
      
      row.innerHTML = `
        <td>${startTime.toLocaleString()}</td>
        <td>${duration}</td>
        <td>${log.notes || '-'}</td>
      `;
      historyTableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading tank history:', error);
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-danger">
          Error loading history. Please ensure you have the required database permissions.
        </td>
      </tr>`;
  }
}

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize fertigation features
  loadFertigationHistory();
  // Attach new Cloud Run endpoints for fertigation management
  document.getElementById('start-fertigation').addEventListener('click', () => {
    const notes = document.getElementById('fertigation-notes').value || '';
    fetch('https://startfertigation-m2hab33w6q-uc.a.run.app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      loadFertigationHistory();
    })
    .catch(err => console.error(err));
  });

  document.getElementById('stop-fertigation').addEventListener('click', () => {
    fetch('https://stopfertigation-m2hab33w6q-uc.a.run.app', {
      method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      loadFertigationHistory();
    })
    .catch(err => console.error(err));
  });
  // Refresh fertigation history when tab is shown
  document.getElementById('fertigation-logs-tab').addEventListener('shown.bs.tab', loadFertigationHistory);
  // Listen for fertigation status changes in real-time
  listenFertigationStatus();
});