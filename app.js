const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function show(t) {
  document.querySelectorAll('main>section').forEach(s => s.hidden = s.id !== t);
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  const sec = $(t); sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter');
}

document.querySelectorAll('[data-t],[data-go]').forEach(b => {
  b.onclick = () => show(b.dataset.t || b.dataset.go);
});

function done(k, info) {
  if (info) S[k] = info;
  dash();
  const e = $('st-' + k);
  if (e) {
    e.textContent = 'Executed';
    e.classList.add('done');
  }
}

const S = { cpu: null, bank: null, mem: null };
function setK(id, v) {
  const e = $(id);
  if (e.textContent !== String(v)) {
    e.textContent = v;
    e.classList.remove('tick');
    void e.offsetWidth;
    e.classList.add('tick');
  }
}

const isInt = (v, min) => Number.isInteger(v) && v >= min;

/* ---------- MODULE 1: CPU SCHEDULING ---------- */
let procs = [];

function loadProcs() {
  procs = [
    ['P1', 'ATM Withdrawal', 0, 5, 2],
    ['P2', 'Cash Deposit', 1, 3, 1],
    ['P3', 'Fund Transfer', 2, 8, 4],
    ['P4', 'Balance Inquiry', 3, 2, 3],
    ['P5', 'Transaction Record Update', 4, 4, 5]
  ].map(a => ({ id: a[0], name: a[1], at: a[2], bt: a[3], pr: a[4] }));
  clearCPUResults();
  drawProcs();
}

function drawProcs() {
  $('ptab').innerHTML = '<tr><th>ID</th><th>Transaction</th><th>Arrival</th><th>Burst</th><th>Priority</th><th></th></tr>' +
    procs.map((p, i) => `
      <tr>
        <td>${esc(p.id)}</td>
        <td>${esc(p.name)}</td>
        <td>${p.at}</td>
        <td>${p.bt}</td>
        <td>${p.pr}</td>
        <td><button class="alt" onclick="removeProc(${i})">Remove</button></td>
      </tr>
    `).join('') + (procs.length ? '' : '<tr><td colspan="6" class="muted">No processes. Add a process or load the sample set.</td></tr>');
  dash();
}

function clearCPUResults() {
  $('cpu-out').innerHTML = '<p class="muted">Run the scheduler to see the Gantt chart and calculations.</p>';
  S.cpu = null;
  $('cpu-cmp').innerHTML = '<p class="muted">Run the scheduler to compare all four algorithms.</p>';
  const status = $('st-cpu');
  status.textContent = 'Ready';
  status.classList.remove('done');
}

function removeProc(index) {
  if (!Number.isInteger(index) || index < 0 || index >= procs.length) return;
  procs.splice(index, 1);
  clearCPUResults();
  drawProcs();
}

function resetCPU() {
  procs = [];
  ['c-id', 'c-name', 'c-at', 'c-bt', 'c-pr'].forEach(field => $(field).value = '');
  $('algo').value = 'FCFS';
  $('quantum').value = '2';
  $('d-quantum').value = '2';
  clearCPUResults();
  drawProcs();
}

function addProc(p = 'c') {
  const id = $(p + '-id').value.trim();
  const name = $(p + '-name').value.trim() || id;
  const atText = $(p + '-at').value.trim();
  const btText = $(p + '-bt').value.trim();
  const prText = $(p + '-pr').value.trim();
  const at = Number(atText);
  const bt = Number(btText);
  const pr = Number(prText);

  if (!id || !atText || !btText || !prText ||
      !Number.isSafeInteger(at) || at < 0 ||
      !Number.isSafeInteger(bt) || bt < 1 ||
      !Number.isSafeInteger(pr) || pr < 1) {
    return alert('Enter a process ID, arrival >= 0, burst >= 1, and priority >= 1 (whole numbers).');
  }
  if (procs.some(p => p.id.toLowerCase() === id.toLowerCase())) {
    return alert('Process ID already exists.');
  }

  procs.push({ id, name, at, bt, pr });
  ['id', 'name', 'at', 'bt', 'pr'].forEach(f => $(p + '-' + f).value = '');
  clearCPUResults();
  drawProcs();
}

function schedule(list, algo, q) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Add at least one process before running the scheduler.');
  }
  if (!['FCFS', 'SJF', 'PRIO', 'RR', 'SRTF', 'PPRIO'].includes(algo)) {
    throw new Error('Choose a supported scheduling algorithm.');
  }
  if (algo === 'RR' && (!Number.isSafeInteger(q) || q < 1)) {
    throw new Error('Time quantum must be a whole number >= 1.');
  }

  const jobs = list.map((p, index) => ({ ...p, index, remaining: p.bt }));
  if (jobs.some(p => typeof p.id !== 'string' || !p.id.trim() ||
      !Number.isSafeInteger(p.at) || p.at < 0 ||
      !Number.isSafeInteger(p.bt) || p.bt < 1 ||
      !Number.isSafeInteger(p.pr) || p.pr < 1)) {
    throw new Error('Each process needs an ID, arrival >= 0, burst >= 1, and priority >= 1 (whole numbers).');
  }
  if (new Set(jobs.map(p => p.id.toLowerCase())).size !== jobs.length) {
    throw new Error('Process IDs must be unique.');
  }

  const completed = new Map();
  const execution = [];
  let currentTime = 0;
  const byArrival = (a, b) => a.at - b.at || a.index - b.index;

  if (algo === 'SRTF' || algo === 'PPRIO') {
    let doneCount = 0;
    while (doneCount < jobs.length) {
      const c = jobs.filter(p => p.remaining > 0 && p.at <= currentTime);
      if (!c.length) {
        const nx = Math.min(...jobs.filter(p => p.remaining > 0).map(p => p.at));
        execution.push({ id: null, s: currentTime, e: nx });
        currentTime = nx;
        continue;
      }
      c.sort(algo === 'SRTF' ? (a, b) => a.remaining - b.remaining || byArrival(a, b) : (a, b) => a.pr - b.pr || byArrival(a, b));
      const p = c[0];
      const arr = jobs.filter(x => x.remaining > 0 && x.at > currentTime).map(x => x.at);
      const run = Math.min(p.remaining, arr.length ? Math.min(...arr) - currentTime : Infinity);
      const last = execution[execution.length - 1];
      if (last && last.id === p.id && last.e === currentTime) last.e += run;
      else execution.push({ id: p.id, s: currentTime, e: currentTime + run });
      currentTime += run;
      p.remaining -= run;
      if (p.remaining === 0) { completed.set(p.id, currentTime); doneCount += 1; }
    }
  } else if (algo === 'RR') {
    const order = [...jobs].sort(byArrival);
    const ready = [];
    let nextArrivalIndex = 0;
    let doneCount = 0;

    while (doneCount < jobs.length) {
      while (nextArrivalIndex < order.length && order[nextArrivalIndex].at <= currentTime) {
        ready.push(order[nextArrivalIndex]);
        nextArrivalIndex += 1;
      }

      if (!ready.length) {
        const nextArrival = order[nextArrivalIndex].at;
        if (nextArrival > currentTime) {
          execution.push({ id: null, s: currentTime, e: nextArrival });
          currentTime = nextArrival;
        }
        continue;
      }

      const proc = ready.shift();
      const run = Math.min(q, proc.remaining);
      if (!Number.isSafeInteger(currentTime + run)) {
        throw new Error('Combined process times exceed the safe calculation range.');
      }
      execution.push({ id: proc.id, s: currentTime, e: currentTime + run });
      currentTime += run;
      proc.remaining -= run;

      while (nextArrivalIndex < order.length && order[nextArrivalIndex].at <= currentTime) {
        ready.push(order[nextArrivalIndex]);
        nextArrivalIndex += 1;
      }

      if (proc.remaining > 0) {
        ready.push(proc);
      } else {
        completed.set(proc.id, currentTime);
        doneCount += 1;
      }
    }
  } else {
    while (completed.size < jobs.length) {
      const candidates = jobs.filter(p => !completed.has(p.id) && p.at <= currentTime);

      if (!candidates.length) {
        const next = jobs
          .filter(p => !completed.has(p.id))
          .sort(byArrival)[0];
        execution.push({ id: null, s: currentTime, e: next.at });
        currentTime = next.at;
        continue;
      }

      let proc;
      if (algo === 'FCFS') {
        proc = candidates.sort(byArrival)[0];
      } else if (algo === 'SJF') {
        proc = candidates.sort((a, b) => a.bt - b.bt || byArrival(a, b))[0];
      } else {
        proc = candidates.sort((a, b) => a.pr - b.pr || byArrival(a, b))[0];
      }

      const start = currentTime;
      const finish = start + proc.bt;
      if (!Number.isSafeInteger(finish)) {
        throw new Error('Combined process times exceed the safe calculation range.');
      }
      execution.push({ id: proc.id, s: start, e: finish });
      currentTime = finish;
      completed.set(proc.id, finish);
    }
  }

  const rows = list.map(p => {
    const ct = completed.get(p.id);
    const tat = ct - p.at;
    const wt = tat - p.bt;
    return { ...p, ct, tat, wt };
  });

  return { rows, execution, totalTime: currentTime };
}

function runCPU() {
  if (!procs.length) return alert('Add processes first.');

  const algo = $('algo').value;
  const q = +$('quantum').value;

  if (algo === 'RR' && (!Number.isSafeInteger(q) || q < 1)) {
    return alert('Time quantum must be a whole number >= 1.');
  }

  let result;
  try {
    result = schedule(procs, algo, q);
  } catch (error) {
    return alert(error.message);
  }
  const { rows, execution, totalTime } = result;
  const average = key => (rows.reduce((sum, r) => sum + r[key], 0) / rows.length).toFixed(2);

  const executionOrder = execution.filter(s => s.id).map(s => esc(s.id)).join(' → ') || 'None';
  const gantt = execution.map((seg, gi) => {
    const width = Math.max(seg.e - seg.s, 1);
    const label = seg.id ? esc(seg.id) : 'Idle';
    const small = `${seg.s}–${seg.e}`;
    return `<div class="seg ${seg.id ? '' : 'idle'}" style="flex:${width} 0 ${width * 30}px;animation-delay:${gi * 0.15}s">${label}<small>${small}</small></div>`;
  }).join('');

  $('cpu-out').innerHTML = `
    <h3>Gantt chart</h3>
    <div class="gantt">${gantt}</div>
    <p>Execution order: ${executionOrder} (finish time ${totalTime})</p>
    <div class="scroll">
      <table>
        <tr>
          <th>ID</th><th>Transaction</th><th>AT</th><th>BT</th><th>Priority</th><th>CT</th><th>TAT = CT − AT</th><th>WT = TAT − BT</th>
        </tr>
        ${rows.map(r => `
          <tr>
            <td>${esc(r.id)}</td>
            <td>${esc(r.name)}</td>
            <td>${r.at}</td>
            <td>${r.bt}</td>
            <td>${r.pr}</td>
            <td>${r.ct}</td>
            <td>${r.tat}</td>
            <td>${r.wt}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <p><b>Average waiting time:</b> ${average('wt')} &nbsp; <b>Average turnaround time:</b> ${average('tat')}</p>
  `;

  renderCPUCmp(q);
  done('cpu', algo + ' · Avg WT ' + average('wt'));
}

/* ---------- MODULE 2: PRODUCER-CONSUMER ---------- */
let buf = [], cap = 5, tid = 0, plog = [], pushIdx = -1;
const items = ['ATM Withdrawal', 'Cash Deposit', 'Fund Transfer', 'Balance Inquiry', 'Transaction Record Update'];

function setCap() {
  const c = +$('cap').value;
  if (!isInt(c, 1) || c > 12) {
    return alert('Capacity must be between 1 and 12.');
  }
  cap = c;
  buf = [];
  tid = 0;
  plog = [];
  drawPC();
}

function plogAdd(message) {
  plog.unshift(message);
  if (plog.length > 40) plog.pop();
}

function produce() {
  if (buf.length >= cap) {
    plogAdd('Producer blocked: transaction queue is full. No overflow allowed (wait(empty) blocks the producer).');
  } else {
    tid += 1;
    const txn = { id: 'TXN-' + (1000 + tid), name: items[(tid - 1) % items.length] };
    buf.push(txn);
    pushIdx = buf.length - 1;
    plogAdd(`Producer: request ${txn.id} (${txn.name}) added to queue at position ${buf.length}. wait(empty) → wait(mutex) → insert → signal(mutex) → signal(full).`);
  }
  drawPC();
  done('pc');
}

function consume() {
  if (!buf.length) {
    plogAdd('Consumer blocked: transaction queue is empty. No underflow allowed (wait(full) blocks the consumer).');
  } else {
    const txn = buf.shift();
    pushIdx = -1;
    plogAdd(`Consumer: processed ${txn.id} (${txn.name}) from the front of the queue in FIFO order. wait(full) → wait(mutex) → remove → signal(mutex) → signal(empty).`);
  }
  drawPC();
  done('pc');
}

function drawPC() {
  const n = buf.length;
  $('pc-stat').textContent = `Capacity ${cap} | Transactions in queue = ${n} | Free slots = ${cap - n} | Mutex = 1 | Status: ${n === cap ? 'FULL' : n === 0 ? 'EMPTY' : 'PARTIAL'}`;

  let html = '';
  for (let i = 0; i < cap; i++) {
    const txn = buf[i];
    if (txn) {
      html += `<div class="slot f${i === pushIdx ? ' pop' : ''}"><b>Position ${i + 1}</b>${i === 0 ? ' (front)' : ''}<br>${txn.id}<br>${txn.name}</div>`;
    } else {
      html += `<div class="slot">Position ${i + 1}<br>Empty</div>`;
    }
  }

  $('slots').innerHTML = html;
  $('pc-log').innerHTML = plog.map(msg => `<div>${esc(msg)}</div>`).join('');
}

/* ---------- MODULE 3: BANKER'S ALGORITHM ---------- */
const RN = ['Database Connections', 'Transaction Processing Services', 'ATM Communication Channels'];
const rname = j => RN[j] || 'R' + j;

function tbl(pre, n, m, d) {
  let html = '<table><tr><th></th>' + Array.from({ length: m }, (_, j) => `<th>${rname(j)}</th>`).join('') + '</tr>';

  for (let i = 0; i < n; i++) {
    html += `<tr><th>P${i}</th>`;
    for (let j = 0; j < m; j++) {
      const value = d && d[i] && d[i][j] !== undefined ? d[i][j] : 0;
      html += `<td><input type="number" min="0" id="${pre}-${i}-${j}" value="${value}"></td>`;
    }
    html += '</tr>';
  }
  return html + '</table>';
}

function buildGrid(A, M, V) {
  let n = Number($('bn').value);
  let m = Number($('bm').value);

  if (!Number.isInteger(n) || n < 1 || n > 8) {
    $('bn').value = '5';
    n = 5;
  }
  if (!Number.isInteger(m) || m < 1 || m > 6) {
    $('bm').value = '3';
    m = 3;
  }

  $('bgrid').innerHTML = `
    <div class="mxgrid">
      <div class="mx"><b>Allocation</b>${tbl('a', n, m, A)}</div>
      <div class="mx"><b>Maximum</b>${tbl('x', n, m, M)}</div>
      <div class="mx"><b>Available</b>${tbl('v', 1, m, V ? [V] : null).replace('<th>P0</th>', '<th>Avail</th>')}</div>
    </div>
  `;
}

function loadBank(type) {
  const examples = {
    safe: {
      A: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
      M: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
      V: [3, 3, 2]
    },
    unsafe: {
      A: [[2, 1, 1], [1, 2, 1], [1, 1, 2]],
      M: [[4, 3, 3], [3, 4, 3], [3, 3, 4]],
      V: [1, 0, 0]
    }
  };

  const ex = examples[type];
  if (!ex) return;

  $('bn').value = ex.A.length;
  $('bm').value = 3;
  buildGrid(ex.A, ex.M, ex.V);
  runBank();
}

function readM(pre, n, m) {
  const matrix = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < m; j++) {
      const value = Number($(`${pre}-${i}-${j}`).value);
      if (!Number.isInteger(value) || value < 0) return null;
      row.push(value);
    }
    matrix.push(row);
  }
  return matrix;
}

function readAvailable(m) {
  const row = [];
  for (let j = 0; j < m; j++) {
    const value = Number($(`v-0-${j}`).value);
    if (!Number.isInteger(value) || value < 0) return null;
    row.push(value);
  }
  return row;
}

function mt(title, data, prefix = 'P') {
  const columns = data[0].map((_, j) => `<th>${rname(j)}</th>`).join('');
  const rows = data.map((row, i) => `<tr><th>${prefix}${i}</th>${row.map(v => `<td>${v}</td>`).join('')}</tr>`).join('');
  return `<div class="mx"><b>${title}</b><table><tr><th></th>${columns}</tr>${rows}</table></div>`;
}

function runBank() {
  const n = +$('bn').value;
  const m = +$('bm').value;

  if (!$('v-0-0')) {
    buildGrid();
  }

  const A = readM('a', n, m);
  const X = readM('x', n, m);
  const V = readAvailable(m);

  if (!A || !X || !V) {
    return alert('All resource values must be whole numbers >= 0.');
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (A[i][j] > X[i][j]) {
        return alert(`Invalid state: Allocation exceeds Maximum for P${i} on ${rname(j)}.`);
      }
    }
  }

  const need = X.map((row, i) => row.map((val, j) => val - A[i][j]));
  const work = [...V];
  const finish = Array(n).fill(false);
  const safeSeq = [], trace = [];

  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < n; i++) {
      if (!finish[i] && need[i].every((val, j) => val <= work[j])) {
        const before = work.join(', ');
        for (let j = 0; j < m; j++) {
          work[j] += A[i][j];
        }
        trace.push(`P${i}: Need (${need[i].join(', ')}) ≤ Work (${before}) → can finish, releases its Allocation → Work = (${work.join(', ')})`);
        finish[i] = true;
        safeSeq.push('P' + i);
        progress = true;
      }
    }
  }

  const safe = finish.every(Boolean);
  const blocked = finish.map((done, i) => done ? '' : 'P' + i).filter(Boolean).join(', ');

  $('bank-out').innerHTML = `
    ${mt('Allocation', A)}
    ${mt('Maximum', X)}
    ${mt('Need = Maximum − Allocation', need)}
    <div class="mx"><b>Available</b><table><tr><th>Resource</th><th>Units</th></tr>${V.map((v, j) => `<tr><th>${rname(j)}</th><td>${v}</td></tr>`).join('')}</table></div>
    ${safe ? `<p class="ok">SAFE state. Safe sequence: ${safeSeq.join(' → ')}</p>` : `<p class="bad">UNSAFE state. No safe sequence exists. Blocked processes: ${blocked || 'None'}.</p>`}
    <div class="mx" style="grid-column:1/-1"><b>Safety algorithm trace</b><div class="log">${trace.map(t => `<div>${t}</div>`).join('') || '<div>No process can proceed with the available resources.</div>'}</div></div>
  `;

  done('bank', safe ? 'Safe state' : 'Unsafe state');
}

buildGrid([[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]], [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]], [3, 3, 2]);

/* ---------- MODULE 4: MEMORY MANAGEMENT ---------- */
const MN = ['ATM Withdrawal', 'Cash Deposit', 'Fund Transfer', 'Balance Inquiry', 'Transaction Record Update'];

function runMem() {
  const parse = s => s.split(',').map(x => x.trim()).filter(x => x !== '').map(Number);
  const blocks = parse($('blocks').value);
  const processSizes = parse($('msizes').value);
  const algo = $('malgo').value;

  if (!blocks.length || !processSizes.length || blocks.some(v => !isInt(v, 1)) || processSizes.some(v => !isInt(v, 1))) {
    return alert('Enter whole numbers >= 1 separated by commas.');
  }

  if (processSizes.length > 5 && !confirm('More than 5 transactions: names will repeat. Continue?')) {
    return;
  }

  const owner = Array(blocks.length).fill(-1);
  const results = [];

  processSizes.forEach((size, idx) => {
    let pick = -1;
    for (let b = 0; b < blocks.length; b++) {
      if (owner[b] !== -1 || blocks[b] < size) continue;
      if (algo === 'FF') {
        pick = b;
        break;
      }
      if (pick === -1 || blocks[b] < blocks[pick]) {
        pick = b;
      }
    }

    if (pick >= 0) owner[pick] = idx;
    results.push({ idx, size, block: pick });
  });

  const nameFor = i => MN[i] || 'Transaction ' + (i + 1);
  const totalMemory = blocks.reduce((sum, b) => sum + b, 0);
  const allocatedMemory = results.filter(r => r.block >= 0).reduce((sum, r) => sum + r.size, 0);
  const internalFrag = results.filter(r => r.block >= 0).reduce((sum, r) => sum + (blocks[r.block] - r.size), 0);
  const freeBlocks = blocks.filter((_, b) => owner[b] === -1).reduce((sum, b) => sum + b, 0);

  $('mem-out').innerHTML = `
    <div class="bar">
      ${blocks.map((size, b) => {
        const procIndex = owner[b];
        if (procIndex >= 0) {
          const usedPercent = (processSizes[procIndex] / size) * 100;
          return `<div class="blk" style="flex:${size} 0 0"><div style="display:flex;height:100%"><div class="used" style="width:${usedPercent}%">P${procIndex + 1}</div><div class="free"></div></div></div>`;
        }
        return `<div class="blk" style="flex:${size} 0 0"><div class="free"></div></div>`;
      }).join('')}
    </div>
    <p class="note">Blocks: ${blocks.map((s, idx) => `B${idx + 1}=${s}KB`).join(', ')}. Dark segments are allocated; light segments are free.</p>
    <div class="scroll">
      <table>
        <tr><th>Process</th><th>Transaction</th><th>Size</th><th>Block</th><th>Internal fragmentation</th></tr>
        ${results.map(r => `
          <tr>
            <td>P${r.idx + 1}</td>
            <td>${nameFor(r.idx)}</td>
            <td>${r.size}</td>
            <td>${r.block >= 0 ? `B${r.block + 1} (${blocks[r.block]}KB)` : '<span class="bad">NOT ALLOCATED</span>'}</td>
            <td>${r.block >= 0 ? `${blocks[r.block] - r.size} KB` : '-'}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <p>Total memory ${totalMemory} KB | Allocated to transactions ${allocatedMemory} KB | Utilization ${(allocatedMemory / totalMemory * 100).toFixed(1)}% | Internal fragmentation ${internalFrag} KB | Free unused blocks ${freeBlocks} KB | Total free ${(totalMemory - allocatedMemory)} KB</p>
    ${results.some(r => r.block < 0) ? '<p class="bad">Some transactions failed to allocate due to insufficient free memory block size.</p>' : '<p class="ok">All transactions allocated successfully.</p>'}
  `;

  renderMemCmp(blocks, processSizes);
  done('mem', (allocatedMemory / totalMemory * 100).toFixed(1) + '% utilized');
}


/* ---------- COMPARISON CHARTS ---------- */
function barRows(items, unit, lowerBetter) {
  const vals = items.map(i => i.value);
  const max = Math.max(...vals, 1);
  const best = lowerBetter ? Math.min(...vals) : Math.max(...vals);
  return items.map((it, i) => `<div class="brow"><span class="bl">${it.label}</span><div class="btrack"><div class="bfill ${it.value === best ? 'best' : ''}" style="width:${it.value / max * 100}%;animation-delay:${i * 0.12}s"></div></div><span class="bv">${it.value}${unit}${it.value === best ? ' ★' : ''}</span></div>`).join('');
}

function renderCPUCmp(q) {
  const names = { FCFS: 'FCFS', SJF: 'SJF', SRTF: 'SRTF', PRIO: 'Priority', PPRIO: 'Preemptive Priority', RR: 'Round Robin' };
  const res = [];
  for (const a of Object.keys(names)) {
    try {
      const rows = schedule(procs, a, q).rows;
      const avg = k => +(rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(2);
      res.push({ label: names[a], wt: avg('wt'), tat: avg('tat') });
    } catch (e) { /* skip algorithm that cannot run with current inputs */ }
  }
  const bestWT = Math.min(...res.map(r => r.wt));
  const winners = res.filter(r => r.wt === bestWT).map(r => r.label).join(' / ');
  $('cpu-cmp').innerHTML = `<div class="cmpgrid">
    <div class="cgroup"><h4>Average waiting time (lower is better)</h4>${barRows(res.map(r => ({ label: r.label, value: r.wt })), '', true)}</div>
    <div class="cgroup"><h4>Average turnaround time (lower is better)</h4>${barRows(res.map(r => ({ label: r.label, value: r.tat })), '', true)}</div></div>
    <p class="ok">Lowest average waiting time: ${winners} (${bestWT}). Round Robin used quantum ${q}.</p>`;
}

function memStats(blocks, sizes, algo) {
  const owner = Array(blocks.length).fill(-1);
  let used = 0, frag = 0, failed = 0;
  sizes.forEach((sz, idx) => {
    let pick = -1;
    for (let b = 0; b < blocks.length; b++) {
      if (owner[b] !== -1 || blocks[b] < sz) continue;
      if (algo === 'FF') { pick = b; break; }
      if (pick === -1 || (algo === 'WF' ? blocks[b] > blocks[pick] : blocks[b] < blocks[pick])) pick = b;
    }
    if (pick >= 0) { owner[pick] = idx; used += sz; frag += blocks[pick] - sz; } else failed++;
  });
  const total = blocks.reduce((a, b) => a + b, 0);
  return { util: +(used / total * 100).toFixed(1), frag, failed, used, total, alloc: sizes.length - failed };
}

function renderMemCmp(blocks, sizes) {
  const ff = memStats(blocks, sizes, 'FF'), bf = memStats(blocks, sizes, 'BF');
  const pair = k => [{ label: 'First Fit', value: ff[k] }, { label: 'Best Fit', value: bf[k] }];
  const verdict = ff.util === bf.util ? 'Both algorithms give the same memory utilization for this input.'
    : `${bf.util > ff.util ? 'Best Fit' : 'First Fit'} gives higher utilization (${Math.max(ff.util, bf.util)}% vs ${Math.min(ff.util, bf.util)}%).`;
  $('mem-cmp').innerHTML = `<div class="cmpgrid">
    <div class="cgroup"><h4>Memory utilization (higher is better)</h4>${barRows(pair('util'), '%', false)}</div>
    <div class="cgroup"><h4>Internal fragmentation in KB (lower is better)</h4>${barRows(pair('frag'), ' KB', true)}</div>
    <div class="cgroup"><h4>Failed allocations (lower is better)</h4>${barRows(pair('failed'), '', true)}</div></div>
    <p class="ok">${verdict}</p>`;
}

/* ---------- DASHBOARD (shares schedule(), memStats() and the Banker grid with the modules) ---------- */
const ALGOS = [['FCFS', 'FCFS', 'Non-preemptive'], ['SJF', 'SJF', 'Non-preemptive'], ['SRTF', 'SRTF', 'Preemptive'], ['PRIO', 'Priority', 'Non-preemptive'], ['PPRIO', 'Preemptive Priority', 'Preemptive'], ['RR', 'Round Robin', 'Preemptive']];
const GCOL = ['#0f766e', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#d97706'];
const parseList = s => s.split(',').map(x => x.trim()).filter(x => x !== '').map(Number);

function metrics(list, algo, q) {
  const r = schedule(list, algo, q);
  const first = new Map();
  r.execution.forEach(s => { if (s.id !== null && !first.has(s.id)) first.set(s.id, s.s); });
  const rows = r.rows.map(x => ({ ...x, rt: first.get(x.id) - x.at }));
  const seq = r.execution.filter(s => s.id !== null).map(s => s.id);
  let sw = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) sw++;
  const avg = k => +(rows.reduce((a, x) => a + x[k], 0) / rows.length).toFixed(2);
  const busy = r.execution.filter(s => s.id !== null).reduce((a, s) => a + s.e - s.s, 0);
  return { execution: r.execution, totalTime: r.totalTime, wt: avg('wt'), tat: avg('tat'), rt: avg('rt'), sw, util: +(busy / r.totalTime * 100).toFixed(1), tp: +(rows.length / r.totalTime).toFixed(3) };
}

function bankStatus() {
  try {
    const n = +$('bn').value, m = +$('bm').value;
    const A = readM('a', n, m), X = readM('x', n, m), V = readAvailable(m);
    if (!A || !X || !V || A.some((r, i) => r.some((v, j) => v > X[i][j]))) return { invalid: true };
    const need = X.map((r, i) => r.map((v, j) => v - A[i][j])), work = [...V], fin = Array(n).fill(false), seq = [];
    let prog = true;
    while (prog) {
      prog = false;
      for (let i = 0; i < n; i++) {
        if (!fin[i] && need[i].every((v, j) => v <= work[j])) { work.forEach((_, j) => { work[j] += A[i][j]; }); fin[i] = true; seq.push('P' + i); prog = true; }
      }
    }
    return { safe: fin.every(Boolean), seq, n, m };
  } catch (e) { return { invalid: true }; }
}

let lastRes = null, dMetric = 'wt';
function drawChart(k) {
  dMetric = k;
  const t = { wt: 'Waiting', tat: 'Turnaround', rt: 'Response', sw: 'Switches' };
  $('d-charts').innerHTML = `<div class="seg-ctl">${Object.keys(t).map(m => `<button class="${m === k ? 'on' : ''}" onclick="drawChart('${m}')">${t[m]}</button>`).join('')}</div>${barRows(lastRes.map(r => ({ label: r.l, value: r[k] })), '', true)}<p class="note">Average ${t[k].toLowerCase()} (context switches for Switches). Lower is better, ★ = best.</p>`;
}

function dash() {
  const q = +$('d-quantum').value;
  let res = null, err = '';
  if (!procs.length) err = 'No processes loaded. Click "Load ATM Sample Data" or add processes in the CPU Scheduling module.';
  else if (!Number.isSafeInteger(q) || q < 1) err = 'Enter a whole-number Round Robin time quantum of at least 1.';
  else { try { res = ALGOS.map(([k, l, t]) => ({ k, l, t, ...metrics(procs, k, q) })); } catch (e) { err = e.message; } }
  drawStatus();
  if (!res) { ['d-kpi', 'd-charts', 'd-gantt', 'd-insight'].forEach(i => $(i).innerHTML = ''); $('d-cmp').innerHTML = `<p class="muted">${esc(err)}</p>`; return; }
  const keys = ['wt', 'tat', 'rt', 'sw'];
  const best = k => Math.min(...res.map(r => r[k]));
  keys.forEach(k => res.forEach(r => { r['r_' + k] = res.filter(x => x[k] < r[k]).length + 1; }));
  res.forEach(r => { r.score = keys.reduce((a, k) => a + r['r_' + k], 0); });
  const bs = Math.min(...res.map(r => r.score));
  const names = k => res.filter(r => r[k] === best(k)).map(r => r.l).join(' / ');
  const winner = res.filter(r => r.score === bs).map(r => r.l).join(' / ');
  const cell = (r, k) => `<td class="${r[k] === best(k) ? 'best' : ''}" data-v="${r[k]}">${r[k]}</td>`;
  const bs2 = bankStatus();

  $('d-kpi').innerHTML = [
    ['Lowest avg waiting time', names('wt'), best('wt') + ' time units'],
    ['Lowest avg response time', names('rt'), best('rt') + ' time units'],
    ['Fewest context switches', names('sw'), best('sw') + ' switches'],
    ['Best overall (rank sum)', winner, 'score ' + bs + ' (lower is better)']
  ].map(c => `<div class="kpi"><small>${c[0]}</small><b>${c[1]}</b><span>${c[2]}</span></div>`).join('');

  $('d-cmp').innerHTML = `
    <div class="scroll"><table class="cmp"><tr><th>Algorithm</th><th>Avg. Waiting</th><th>Avg. Turnaround</th><th>Avg. Response</th><th>Context Switches</th><th>CPU Util. %</th><th>Throughput</th><th>Overall Score</th><th>Type</th></tr>
    ${res.map(r => `<tr><th>${r.l}</th>${cell(r, 'wt')}${cell(r, 'tat')}${cell(r, 'rt')}${cell(r, 'sw')}<td>${r.util}</td><td>${r.tp}</td><td class="${r.score === bs ? 'best' : ''}">${r.score}${r.score === bs ? ' ★' : ''}</td><td>${r.t}</td></tr>`).join('')}</table></div>
    <p class="note"><span class="chip"><i class="bestdot"></i>Highlighted = best (lowest) value; ties are all highlighted.</span> ${procs.length} processes, Round Robin quantum ${q}. Priority: lower number = higher priority. Response = first CPU start − arrival. Context switch = CPU moves to a different process. Throughput = processes per time unit. Overall score = sum of the ranks (1 = best) on waiting, turnaround, response and context switches.</p>`;

  lastRes = res; drawChart(dMetric);

  $('d-gantt').innerHTML = res.map(r => `<div class="grow"><span>${r.l}</span><div class="gantt mini">${r.execution.map(s => `<div class="seg ${s.id ? '' : 'idle'}" style="flex:${s.e - s.s} 0 0;${s.id ? 'background:' + GCOL[(+s.id.replace(/\D/g, '') || 1) % GCOL.length] : ''}" title="${s.id || 'Idle'} ${s.s}-${s.e}">${s.id ? esc(s.id) : ''}</div>`).join('')}</div></div>`).join('') + '<p class="note">Each bar is the CPU timeline (0 → finish). Colour = process, so you can see how often each algorithm switches.</p>';

  const L = k => res.find(r => r.k === k);
  $('d-insight').innerHTML = `<p class="ok"><b>Insight:</b> ${names('wt')} gives the lowest average waiting time (${best('wt')}), but SJF/SRTF can starve long jobs such as large fund transfers. ${names('rt')} gives the best response time (${best('rt')}); Round Robin pays for it with ${L('RR').sw} context switches versus ${L('FCFS').sw} for FCFS. FCFS is simplest and fair but suffers the convoy effect. Best balanced choice on this data: <b>${winner}</b>.</p>`;
}

function drawStatus() {
  const n = buf.length, pct = Math.round(n / cap * 100), b = bankStatus();
  const bl = parseList($('blocks').value), ms = parseList($('msizes').value);
  let mem = '<p class="muted">Enter valid block and process sizes in Memory Management.</p>';
  if (bl.length && ms.length && ![...bl, ...ms].some(v => !isInt(v, 1))) {
    const row = (l, a) => { const s = memStats(bl, ms, a); return `<tr><th>${l}</th><td>${s.util}%</td><td>${s.frag} KB</td><td>${s.failed}</td></tr>`; };
    mem = `<table class="cmp"><tr><th>Algorithm</th><th>Utilization</th><th>Int. frag.</th><th>Failed</th></tr>${row('First Fit', 'FF')}${row('Best Fit', 'BF')}${row('Worst Fit', 'WF')}</table>`;
  }
  $('d-status').innerHTML = `
    <div class="panel"><h2>Producer–Consumer</h2><div class="meter"><i style="width:${pct}%"></i></div>
      <p><b>${n}/${cap}</b> slots used · ${cap - n} free · <b>${n === cap ? 'FULL' : n === 0 ? 'EMPTY' : 'PARTIAL'}</b></p>
      <p class="note">Semaphores: empty = ${cap - n}, full = ${n}, mutex = 1</p></div>
    <div class="panel"><h2>Banker's Algorithm</h2>
      ${b.invalid ? '<p class="muted">Resource matrices are invalid.</p>' : b.safe ? `<p class="ok">SAFE state<br>${b.seq.join(' → ')}</p>` : '<p class="bad">UNSAFE state: deadlock risk</p>'}
      <p class="note">${b.invalid ? '' : b.n + ' processes, ' + b.m + ' resource types'}</p></div>
    <div class="panel"><h2>Memory placement</h2>${mem}</div>`;
}

function animateNums() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('#d-cmp td[data-v]').forEach(td => {
    const target = Number(td.dataset.v), dec = (td.dataset.v.split('.')[1] || '').length, t0 = performance.now();
    const step = now => {
      const p = Math.min((now - t0) / 700, 1);
      td.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(dec);
      if (p < 1) requestAnimationFrame(step); else td.textContent = td.dataset.v;
    };
    requestAnimationFrame(step);
  });
}

function compareAll() { dash(); }
['d-quantum', 'quantum'].forEach(id => $(id).addEventListener('input', () => { const v = $(id).value; $('d-quantum').value = v; $('quantum').value = v; dash(); }));
['bgrid', 'blocks', 'msizes', 'cap'].forEach(id => $(id).addEventListener('input', dash));
$('malgo').addEventListener('change', dash);
const _bg = buildGrid;
buildGrid = function (...a) { _bg(...a); dash(); };
dash();

loadProcs();
drawPC();
const _dp = drawProcs, _dq = drawPC;
drawProcs = function () { _dp(); dash(); };
drawPC = function () { _dq(); dash(); };
dash();
