# Banking and ATM Transaction Processing System – OS Algorithm Visualizer

## Overview
This project models a banking system that handles ATM withdrawals, cash deposits, fund transfers, balance inquiries, and transaction-record updates. The application demonstrates CPU scheduling, producer-consumer synchronization, Banker's Algorithm, and memory management for transaction processing.

## Run
No installation or backend is needed. Keep `index.html`, `style.css` and `app.js` in one folder and open `index.html` in a browser.

## Module behavior
1. CPU Scheduling: FCFS, SJF, Priority, Round Robin
2. Producer-Consumer: bounded transaction queue with full/empty handling
3. Banker's Algorithm: safe and unsafe resource states using allocation, maximum, available, and need matrices
4. Memory Management: First Fit and Best Fit allocation for memory blocks

## Sample expectations
- FCFS example: completion time, waiting time, turnaround time, and averages are calculated automatically.
- Transaction queue blocks when full and stops when empty.
- Banker's safe example results in a valid safe sequence.
- Unsafe example shows a deadlock-risk state.
- Memory examples show successful or failed allocation clearly.

## Test the CPU scheduler
1. Open the CPU Scheduling module, then click **Load sample** or add processes with unique IDs and whole-number arrival, burst, and priority values.
2. Select FCFS, SJF, Priority, or Round Robin. For Round Robin, enter a whole-number time quantum of at least 1.
3. Click **Run Simulation**. The Gantt chart shows each execution interval (including idle time), and the results table reports completion, turnaround, and waiting times with averages.
4. Use **Remove** to remove an individual process, or **Reset** to clear the process list and results. Adding, removing, and resetting invalidate the previous simulation results.

## Comparison charts
- CPU Scheduling: after every run, FCFS, SJF, Priority and Round Robin are compared on average waiting and turnaround time (best is starred).
- Memory Management: First Fit and Best Fit are compared on utilization, internal fragmentation and failed allocations.

## Dashboard (A+ report view)
The dashboard compares FCFS, SJF, Priority and Round Robin on the same dataset (waiting, turnaround, response time, context switches), with bar charts, Gantt previews and an auto-generated insight. SJF and Priority are non-preemptive; Round Robin is preemptive. It also shows live status for the queue, Banker's safety and memory. The dashboard and the CPU Scheduling module use the same `schedule()` function.

