// --- Constants ---
const MEMORY_SIZE = 512;
const ADDRESS_MASK = 0x1FF; // 9-bit addresses
const DATA_MASK = 0xFFFF;   // 16-bit data
const MMIO_START_ADDRESS = 0x1F0; // 0x1F0 - 0x1FF are MMIO

// --- CPU State ---
let cpu = {
    // Special Purpose Registers
    pc: 0,       // Program Counter (9-bit)
    acc: 0,      // Accumulator (16-bit)
    ar: 0,       // Address Register (9-bit, internal)
    dr: 0,       // Data Register (16-bit, internal)
    tr: 0,       // Temporary Register (16-bit, internal - for complex ops if needed)
    ir: 0,       // Instruction Register (16-bit)

    // General Purpose Registers (GPRs)
    gpr: new Uint16Array(8), // R0-R7 (16-bit each)

    // Status Flags (1-bit each)
    flags: {
        z: 0,    // Zero
        n: 0,    // Negative
        c: 0,    // Carry
        v: 0     // Overflow
    },

    // Predicate Register File (1-bit each)
    p_file: {
        p0: 0,
        p1: 0,
        p2: 0,
        p3: 0
    },

    // Simulation Control
    halted: false,
    waitingForInput: false, // Flag to pause execution for MMIO input
    inputAddress: 0         // Address being read from for MMIO
};

// --- Memory ---
let memory = new Uint16Array(MEMORY_SIZE);

let instructionFormats = [];

// --- Simulation Control ---
let runInterval = null;
let runSpeedMs = 100;

// --- DOM Elements (cache them for performance) ---
const DOMElements = {
    pc: document.getElementById('reg-pc'),
    acc: document.getElementById('reg-acc'),
    ar: document.getElementById('reg-ar'),
    dr: document.getElementById('reg-dr'),
    tr: document.getElementById('reg-tr'),
    ir: document.getElementById('reg-ir'),
    gpr: [], // Will be filled in init
    flagZ: document.getElementById('flag-z'),
    flagN: document.getElementById('flag-n'),
    flagC: document.getElementById('flag-c'),
    flagV: document.getElementById('flag-v'),
    pfileP0: document.getElementById('pfile-p0'),
    pfileP1: document.getElementById('pfile-p1'),
    pfileP2: document.getElementById('pfile-p2'),
    pfileP3: document.getElementById('pfile-p3'),
    memoryView: document.getElementById('memory-view'),
    assemblyCode: document.getElementById('assembly-code'),
    assembleButton: document.getElementById('assemble-button'),
    stepButton: document.getElementById('step-button'),
    runButton: document.getElementById('run-button'),
    stopButton: document.getElementById('stop-button'),
    resetButton: document.getElementById('reset-button'),
    runSpeedInput: document.getElementById('run-speed'),
    messageArea: document.getElementById('message-area'),
    ioInputValue: document.getElementById('io-input-value'),
    ioInputProvideButton: document.getElementById('io-input-provide-button'),
    ioReadPrompt: document.getElementById('io-read-prompt'),
    ioOutputArea: document.getElementById('io-output-area'),
    executionStatus: document.getElementById('execution-status')
};

// --- Utility Functions ---
function formatHex(value, digits) {
    return `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

function logMessage(message, isError = false) {
    const prefix = isError ? "ERROR: " : "INFO: ";
    DOMElements.messageArea.textContent += prefix + message + "\n";
    DOMElements.messageArea.scrollTop = DOMElements.messageArea.scrollHeight; // Scroll to bottom
    if (isError) {
        console.error(message);
    } else {
        console.log(message);
    }
}

function clearMessages() {
    DOMElements.messageArea.textContent = "";
}

function updateExecutionStatus(status) {
    const statusElement = DOMElements.executionStatus;
    statusElement.textContent = `Status: ${status}`;

    // Remove previous status classes
    statusElement.classList.remove(
        'status-idle',
        'status-running',
        'status-paused',
        'status-halted',
        'status-error',
        'status-ready' // Add ready if you use it
       );

    // Add the appropriate class based on the status text
    if (status.toLowerCase().startsWith('idle')) {
        statusElement.classList.add('status-idle');
    } else if (status.toLowerCase().startsWith('running')) {
        statusElement.classList.add('status-running');
    } else if (status.toLowerCase().startsWith('paused')) {
        statusElement.classList.add('status-paused');
    } else if (status.toLowerCase().startsWith('halted')) {
        statusElement.classList.add('status-halted');
    } else if (status.toLowerCase().includes('error')) { // Check for 'error' substring
        statusElement.classList.add('status-error');
    } else if (status.toLowerCase().startsWith('ready')) { // Handle 'Ready' state after assembly
         statusElement.classList.add('status-ready'); // You might want a specific style for ready
         // Using idle style as default for ready
          statusElement.classList.add('status-idle');
    } else {
        // Default style (if none of the above match)
        statusElement.classList.add('status-idle');
    }
}

// --- Core CPU Functions ---

function resetCPU() {
    logMessage("Resetting CPU and Memory...");
    cpu.pc = 0;
    cpu.acc = 0;
    cpu.ar = 0;
    cpu.dr = 0;
    cpu.tr = 0;
    cpu.ir = 0;
    cpu.gpr.fill(0);
    cpu.flags.z = 0;
    cpu.flags.n = 0;
    cpu.flags.c = 0;
    cpu.flags.v = 0;
    cpu.p_file.p0 = 0;
    cpu.p_file.p1 = 0;
    cpu.p_file.p2 = 0;
    cpu.p_file.p3 = 0;
    cpu.halted = false;
    cpu.waitingForInput = false;
    cpu.inputAddress = 0;
    memory.fill(0); // Clear memory
    DOMElements.ioOutputArea.textContent = "--- Output Log ---"; // Clear IO Output
    DOMElements.ioReadPrompt.style.display = 'none';
    DOMElements.ioInputProvideButton.style.display = 'none';
    updateExecutionStatus("Idle");
    stopSimulation(); // Ensure any running interval is cleared
    updateUI();
    logMessage("Reset complete.");
}

// Fetch the instruction at PC into IR
function fetchInstruction() {
    if (cpu.pc > ADDRESS_MASK) {
        logMessage(`PC out of bounds: ${formatHex(cpu.pc, 3)}`, true);
        cpu.halted = true;
        updateExecutionStatus("Halted (PC Error)");
        return false; // Indicate fetch failure
    }
    cpu.ir = memory[cpu.pc];
    return true; // Indicate fetch success
}

// Increment PC (with 9-bit wrap-around)
function incrementPC() {
    cpu.pc = (cpu.pc + 1) & ADDRESS_MASK;
}

// Update all UI elements to reflect current CPU state
function updateUI() {
    // Special Registers
    DOMElements.pc.textContent = formatHex(cpu.pc, 3);
    DOMElements.acc.textContent = formatHex(cpu.acc, 4);
    DOMElements.ar.textContent = formatHex(cpu.ar, 3); // Mostly internal, but useful to see
    DOMElements.dr.textContent = formatHex(cpu.dr, 4); // Mostly internal
    DOMElements.tr.textContent = formatHex(cpu.tr, 4); // Mostly internal
    DOMElements.ir.textContent = formatHex(cpu.ir, 4); // Current instruction

    // GPRs
    for (let i = 0; i < 8; i++) {
        DOMElements.gpr[i].textContent = formatHex(cpu.gpr[i], 4);
    }

    // Flags & P-File
    DOMElements.flagZ.textContent = `Z:${cpu.flags.z}`;
    DOMElements.flagN.textContent = `N:${cpu.flags.n}`;
    DOMElements.flagC.textContent = `C:${cpu.flags.c}`;
    DOMElements.flagV.textContent = `V:${cpu.flags.v}`;
    DOMElements.pfileP0.textContent = `P0:${cpu.p_file.p0}`;
    DOMElements.pfileP1.textContent = `P1:${cpu.p_file.p1}`;
    DOMElements.pfileP2.textContent = `P2:${cpu.p_file.p2}`;
    DOMElements.pfileP3.textContent = `P3:${cpu.p_file.p3}`;

    // Memory View (regenerate efficiently)
    let memoryHTML = '';
    for (let i = 0; i < MEMORY_SIZE; i++) {
        const isCurrentPC = (i === cpu.pc) && !cpu.halted;
        const isMMIO = (i >= MMIO_START_ADDRESS);
        const pcClass = isCurrentPC ? ' current-pc' : '';
        const mmioClass = isMMIO ? ' mmio-range' : '';
        memoryHTML += `
            <div class="memory-location${pcClass}${mmioClass}" id="mem-${i}">
                <span class="memory-address">${formatHex(i, 3)}:</span>
                <span class="memory-value">${formatHex(memory[i], 4)}</span>
            </div>`;
    }
    DOMElements.memoryView.innerHTML = memoryHTML;

    // Scroll memory view to current PC if not visible
    const pcElement = document.getElementById(`mem-${cpu.pc}`);
    if (pcElement) {
         // Only scroll if needed, prevents jarring scroll on every step
        const viewRect = DOMElements.memoryView.getBoundingClientRect();
        const pcRect = pcElement.getBoundingClientRect();
         if (pcRect.top < viewRect.top || pcRect.bottom > viewRect.bottom) {
             pcElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
         }
    }

    // Update button states based on halt status
    DOMElements.stepButton.disabled = cpu.halted || cpu.waitingForInput;
    DOMElements.runButton.disabled = cpu.halted || cpu.waitingForInput;
    DOMElements.stopButton.disabled = runInterval === null; // Only enable if running

    // Update I/O prompt visibility
    DOMElements.ioReadPrompt.style.display = cpu.waitingForInput ? 'inline' : 'none';
    DOMElements.ioInputProvideButton.style.display = cpu.waitingForInput ? 'inline-block' : 'none';
    DOMElements.ioInputValue.disabled = !cpu.waitingForInput;

}

// --- Initialization ---
function initializeSimulator() {
    console.log("Initializing Simulator...");
     // Populate GPR DOM element cache
    for (let i = 0; i < 8; i++) {
        DOMElements.gpr[i] = document.getElementById(`reg-r${i}`);
    }
    resetCPU(); // Set initial state and render UI
    // Add event listeners later in the UI Interaction part
    console.log("Simulator Initialized.");
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeSimulator);

// --- ALU Operations (16-bit) ---

// Note: JavaScript bitwise operators work on 32 bits, but results are masked to 16.
// Signedness is handled implicitly by JS for standard operators, but we need
// specific flag logic for CMP.

function alu_add(a, b) {
    return (a + b) & DATA_MASK;
}

function alu_sub(a, b) {
    return (a - b) & DATA_MASK;
}

function alu_and(a, b) {
    return (a & b) & DATA_MASK;
}

function alu_or(a, b) {
    return (a | b) & DATA_MASK;
}

function alu_xor(a, b) {
    return (a ^ b) & DATA_MASK;
}

function alu_mov(a) { // Pass-through for MOV
    return a & DATA_MASK;
}

function alu_lshl(a, amount) {
    // Logical Shift Left - amount is 0-7 from Imm3 or register value (masked)
    return (a << (amount & 0x7)) & DATA_MASK;
}

function alu_lshr(a, amount) {
    // Logical Shift Right - amount is 0-7 from Imm3 or register value (masked)
    return (a >>> (amount & 0x7)) & DATA_MASK; // >>> ensures zero-fill (logical)
}


// --- Flag Logic (ONLY for CMP instruction) ---
// Calculates result of Rn - Rm/Imm3 and updates ZNCV flags.
// This needs careful handling of 16-bit arithmetic and borrows/overflow.
function updateFlagsForCMP(operand1, operand2) {
    const op1_16 = operand1 & DATA_MASK;
    const op2_16 = operand2 & DATA_MASK;

    // Perform 16-bit subtraction
    const result_16 = (op1_16 - op2_16) & DATA_MASK;

    // Z Flag: Set if result is zero
    cpu.flags.z = (result_16 === 0) ? 1 : 0;

    // N Flag: Set if result is negative (MSB is 1)
    cpu.flags.n = (result_16 & 0x8000) ? 1 : 0;

    // C Flag: Set if unsigned borrow occurred.
    // Borrow occurs if op1 < op2 when treated as unsigned.
    cpu.flags.c = (op1_16 < op2_16) ? 0 : 1; // C=1 means NO borrow occurred

    // V Flag: Set if signed overflow occurred.
    // Overflow occurs if signs of operands are different AND sign of result
    // is different from the sign of operand1.
    // More simply: (op1_sign != op2_sign) && (op1_sign != result_sign)
    const op1_sign = (op1_16 & 0x8000) !== 0;
    const op2_sign = (op2_16 & 0x8000) !== 0;
    const result_sign = (result_16 & 0x8000) !== 0;

    if (op1_sign !== op2_sign && op1_sign !== result_sign) {
        cpu.flags.v = 1;
    } else {
        cpu.flags.v = 0;
    }

    // Log flag changes (optional debug)
    // console.log(`CMP ${formatHex(op1_16, 4)} - ${formatHex(op2_16, 4)} = ${formatHex(result_16, 4)} -> Z:${cpu.flags.z} N:${cpu.flags.n} C:${cpu.flags.c} V:${cpu.flags.v}`);
}

// --- Condition Code Evaluation (for SETP) ---
function evaluateCond(condCode) {
    const Z = cpu.flags.z;
    const N = cpu.flags.n;
    const C = cpu.flags.c;
    const V = cpu.flags.v;

    switch (condCode) {
        case 0b000001: return Z === 1;            // EQ (Equal) Z=1
        case 0b000010: return Z === 0;            // NE (Not Equal) Z=0
        case 0b000011: return C === 1;            // CS/HS (Carry Set / Unsigned Higher or Same) C=1
        case 0b000100: return C === 0;            // CC/LO (Carry Clear / Unsigned Lower) C=0
        case 0b000101: return N === 1;            // MI (Minus / Negative) N=1
        case 0b000110: return N === 0;            // PL (Plus / Positive or Zero) N=0
        case 0b000111: return V === 1;            // VS (Overflow Set) V=1
        case 0b001000: return V === 0;            // VC (Overflow Clear) V=0
        case 0b001001: return C === 1 && Z === 0; // HI (Unsigned Higher) C=1 and Z=0
        case 0b001010: return C === 0 || Z === 1; // LS (Unsigned Lower or Same) C=0 or Z=1
        case 0b001011: return N === V;            // GE (Signed Greater than or Equal) N=V
        case 0b001100: return N !== V;            // LT (Signed Less Than) N!=V
        case 0b001101: return Z === 0 && N === V; // GT (Signed Greater Than) Z=0 and N=V
        case 0b001110: return Z === 1 || N !== V; // LE (Signed Less than or Equal) Z=1 or N!=V
        // Add cases for any other COND codes if defined
        default:
            logMessage(`Unsupported COND code: ${formatHex(condCode, 2)}`, true);
            return false; // Default to false for unknown codes
    }
}

// --- Instruction Decoding and Execution ---

// Predicate Check Map (maps Pred code [11:9] to P-File check)
const predicateCheck = [
    (p) => true,           // 000: AL (Always)
    (p) => p.p0 === 1,     // 001: (P0)
    (p) => p.p0 === 0,     // 010: (!P0)
    (p) => p.p1 === 1,     // 011: (P1)
    (p) => p.p1 === 0,     // 100: (!P1)
    (p) => p.p2 === 1,     // 101: (P2)
    (p) => p.p2 === 0,     // 110: (!P2)
    (p) => p.p3 === 1      // 111: (P3)
];

function decodeAndExecute(instructionWord, formatType) {
    if (cpu.halted) return;

    const opcode = instructionWord >> 12;          // Bits [15:12]
    const pred = (instructionWord >> 9) & 0b111;   // Bits [11:9]

    // --- 1. Predicate Check ---
    const predicateTrue = predicateCheck[pred](cpu.p_file);
    if (!predicateTrue) {
        updateExecutionStatus(`Running (Skipped ${formatHex(cpu.pc -1, 3)})`);
        return; // Skip execution if predicate is false
    }
    updateExecutionStatus(`Running (Executing ${formatHex(cpu.pc -1, 3)})`);

    // --- 2. Decode and Execute based on *Format Type* ---
    let rd, rn, rm_idx, imm3, address, pd, condCode, result; // Declare fields needed
    let operand1_val, operand2, cmp_op1, cmp_op2; // For ALU operands
    const bits_2_0 = instructionWord & 0b111; // Common extraction for last 3 bits

    // <<< NEW: Use formatType as the primary switch >>>
    switch (formatType) {
        case "MEMORY":
            address = instructionWord & 0x1FF; // Address [8:0]
            cpu.ar = address;
            // Opcode distinguishes LDR/STR within this format
            if (opcode === 0b0000) { // LDR
                if (address >= MMIO_START_ADDRESS) { handleMMIORead(address); }
                else { cpu.dr = memory[address]; cpu.acc = cpu.dr; }
            } else if (opcode === 0b0001) { // STR
                cpu.dr = cpu.acc;
                if (address >= MMIO_START_ADDRESS) { handleMMIOWrite(address, cpu.dr); }
                else { memory[address] = cpu.dr; }
            } else {
                 logMessage(`Error: Unexpected opcode ${formatHex(opcode,1)} for MEMORY format.`, true);
                 cpu.halted = true;
            }
            break;

        case "BRANCH":
            address = instructionWord & 0x1FF; // Address [8:0]
            cpu.pc = address; // Absolute branch
            break;

        case "I_ALU": // Covers I-Type ADD, SUB, AND, OR, XOR, LSHL, LSHR
        case "I_MOV": // Covers I-Type MOV Rd, Rn, #Imm
            rd = (instructionWord >> 6) & 0b111;
            rn = (instructionWord >> 3) & 0b111;
            imm3 = bits_2_0; // Bits [2:0] are Imm3 value

            operand1_val = cpu.gpr[rn];
            operand2 = imm3; // Use immediate value

            switch (opcode) { // Opcode needed to know *which* ALU op
                case 0b0010: result = alu_add(operand1_val, operand2); break; // ADD I
                case 0b0011: result = alu_sub(operand1_val, operand2); break; // SUB I
                case 0b0100: result = alu_and(operand1_val, operand2); break; // AND I
                case 0b0101: result = alu_or(operand1_val, operand2); break;  // ORR I
                case 0b0110: result = alu_xor(operand1_val, operand2); break; // XOR I
                case 0b0111: result = alu_mov(operand2); break; // I-Type MOV Rd = Imm3
                case 0b1011: result = alu_lshl(operand1_val, operand2); break; // LSHL I
                case 0b1100: result = alu_lshr(operand1_val, operand2); break; // LSHR I
                default:
                     logMessage(`Error: Unexpected opcode ${formatHex(opcode,1)} for I_ALU/I_MOV format.`, true);
                     cpu.halted = true; result = cpu.gpr[rd]; // Prevent crash
                     break;
            }
            cpu.gpr[rd] = result;
            break;

        case "R_ALU": // Covers R-Type ADD, SUB, AND, OR, XOR, LSHL, LSHR
        case "R_MOV": // Covers R-Type MOV Rd, Rn, Rm
            rd = (instructionWord >> 6) & 0b111;
            rn = (instructionWord >> 3) & 0b111;
            rm_idx = bits_2_0; // Bits [2:0] are Rm index

            operand1_val = cpu.gpr[rn];
            operand2 = cpu.gpr[rm_idx]; // Fetch from Rm register
            result;

            switch (opcode) {
                case 0b0010: result = alu_add(operand1_val, operand2); break; // ADD R
                case 0b0011: result = alu_sub(operand1_val, operand2); break; // SUB R
                case 0b0100: result = alu_and(operand1_val, operand2); break; // AND R
                case 0b0101: result = alu_or(operand1_val, operand2); break;  // ORR R
                case 0b0110: result = alu_xor(operand1_val, operand2); break; // XOR R
                case 0b0111: result = alu_mov(operand2); break; // R-Type MOV Rd = GPR[Rm]
                case 0b1011: result = alu_lshl(operand1_val, operand2 & 0x7); break; // LSHL R (by Rm value)
                case 0b1100: result = alu_lshr(operand1_val, operand2 & 0x7); break; // LSHR R (by Rm value)
                default:
                     logMessage(`Error: Unexpected opcode ${formatHex(opcode,1)} for R_ALU/R_MOV format.`, true);
                     cpu.halted = true; result = cpu.gpr[rd]; // Prevent crash
                     break;
            }
             cpu.gpr[rd] = result;
             break;

        case "R_CMP": // Covers R-Type CMP Rn, Rm
        case "I_CMP": // Covers I-Type CMP Rn, #Imm3
            // Note: Rd field (bits 8:6) is ignored for CMP
            rn = (instructionWord >> 3) & 0b111;
            operand1_val = cpu.gpr[rn];

            if(formatType === "R_CMP") {
                rm_idx = bits_2_0; // Bits [2:0] are Rm index
                operand2 = cpu.gpr[rm_idx]; // Fetch from Rm register
            } else { // I_CMP
                imm3 = bits_2_0; // Bits [2:0] are Imm3 value
                operand2 = imm3;
            }
            updateFlagsForCMP(operand1_val, operand2);
            break;

        case "SETP":
            pd = (instructionWord >> 7) & 0b11;    // Bits [8:7]
            condCode = instructionWord & 0b111111; // Bits [5:0]
            const conditionMet = evaluateCond(condCode);
            const valueToSet = conditionMet ? 1 : 0;
            switch (pd) {
                case 0b00: cpu.p_file.p0 = valueToSet; break;
                case 0b01: cpu.p_file.p1 = valueToSet; break;
                case 0b10: cpu.p_file.p2 = valueToSet; break;
                case 0b11: cpu.p_file.p3 = valueToSet; break;
            }
            break;

        case "HLT":
            cpu.halted = true;
            updateExecutionStatus("Halted");
            logMessage("HLT instruction encountered.");
            stopSimulation();
            break;

        // Handle errors or unknown types
        case "ERROR": // Format determined as error by assembler
             logMessage(`Attempted to execute instruction assembled with errors at ${formatHex(cpu.pc - 1, 3)}`, true);
             cpu.halted = true; updateExecutionStatus("Halted (Assembly Error)");
             break;
        case "UNKNOWN": // Format wasn't determined or index out of bounds
        default:
             logMessage(`Unknown or unhandled formatType '${formatType}' for Opcode ${formatHex(opcode, 1)} at ${formatHex(cpu.pc - 1, 3)}`, true);
             // Fallback to opcode check for safety?
             if(opcode === 0b1101) { /* HLT */ cpu.halted = true; updateExecutionStatus("Halted"); }
             else if(opcode === 0b1110 || opcode === 0b1111) { /* RESERVED */ cpu.halted = true; updateExecutionStatus("Halted (Reserved Opcode)");}
             else { /* UNKNOWN */ cpu.halted = true; updateExecutionStatus("Halted (Unknown Format/Opcode)"); }
            break;
    }
}

// --- Assembler ---

const opCodeMap = {
    'LDR':  { opcode: 0b0000, format: 'Memory' },
    'STR':  { opcode: 0b0001, format: 'Memory' },
    'ADD':  { opcode: 0b0010, format: 'DataProc' }, // Can be R or I
    'SUB':  { opcode: 0b0011, format: 'DataProc' }, // Can be R or I
    'AND':  { opcode: 0b0100, format: 'DataProc' }, // Can be R or I
    'ORR':  { opcode: 0b0101, format: 'DataProc' }, // Can be R or I
    'XOR':  { opcode: 0b0110, format: 'DataProc' }, // Can be R or I
    'MOV':  { opcode: 0b0111, format: 'DataProc' }, // Can be R or I
    'CMP':  { opcode: 0b1000, format: 'DataProc' }, // Can be R or I
    'SETP': { opcode: 0b1001, format: 'SETP' },
    'B':    { opcode: 0b1010, format: 'Branch' },
    'LSHL': { opcode: 0b1011, format: 'DataProc' }, // Can be R or I
    'LSHR': { opcode: 0b1100, format: 'DataProc' }, // Can be R or I
    'HLT':  { opcode: 0b1101, format: 'HLT' },
};

const regMap = {
    'R0': 0, 'R1': 1, 'R2': 2, 'R3': 3, 'R4': 4, 'R5': 5, 'R6': 6, 'R7': 7,
};

const pRegMap = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };

const predMap = {
    'AL': 0b000, '(P0)': 0b001, '(!P0)': 0b010, '(P1)': 0b011,
    '(!P1)': 0b100, '(P2)': 0b101, '(!P2)': 0b110, '(P3)': 0b111
};
const defaultPredCode = predMap['AL'];

const condCodeMap = {
    'EQ': 0b000001, 'NE': 0b000010, 'CS': 0b000011, 'HS': 0b000011,
    'CC': 0b000100, 'LO': 0b000100, 'MI': 0b000101, 'PL': 0b000110,
    'VS': 0b000111, 'VC': 0b001000, 'HI': 0b001001, 'LS': 0b001010,
    'GE': 0b001011, 'LT': 0b001100, 'GT': 0b001101, 'LE': 0b001110
};


function assemble(assemblyCode) {
    clearMessages();
    logMessage("Starting Assembly...");
    const lines = assemblyCode.split('\n');
    const symbolTable = {};
    let machineCode = []; // Build dynamically
    let formatInfo = [];  // Build dynamically
    let errors = [];
    let currentAddress = 0; // Tracks current address *during generation* in Pass 2
    let pass1Errors = []; // Separate errors for Pass 1

    // --- Pass 1: Build Symbol Table ONLY ---
    logMessage("Running Pass 1 (Symbol Table)...");
    let addressCounterP1 = 0; // Counter for Pass 1 addresses
    lines.forEach((line, index) => {
        const cleanedLine = line.replace(/;.*$/, '').trim();
        if (!cleanedLine) return;

        const labelMatch = cleanedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
        if (labelMatch) {
            const label = labelMatch[1];
            if (symbolTable.hasOwnProperty(label)) {
                pass1Errors.push(`Line ${index + 1}: Duplicate label '${label}'`);
            } else {
                 // Check conflicts
                 if (regMap.hasOwnProperty(label.toUpperCase()) ||
                     pRegMap.hasOwnProperty(label.toUpperCase()) ||
                     opCodeMap.hasOwnProperty(label.toUpperCase()) ||
                     predMap.hasOwnProperty(label.toUpperCase()) ||
                     condCodeMap.hasOwnProperty(label.toUpperCase()) ) {
                    pass1Errors.push(`Line ${index + 1}: Label '${label}' conflicts with a reserved keyword.`);
                 } else {
                    symbolTable[label] = addressCounterP1; // Assign current address
                 }
            }
            // Does an instruction follow the label?
            const codeAfterLabel = cleanedLine.substring(labelMatch[0].length).trim();
            if (codeAfterLabel) {
                addressCounterP1++; // Instruction takes space
            }
             // Label itself doesn't increment address unless code follows
        } else {
            // This line is assumed to be an instruction
            addressCounterP1++;
        }
    });
    const totalInstructions = addressCounterP1; // Total size determined
    logMessage(`Pass 1 complete. Symbols: ${JSON.stringify(symbolTable)}, Estimated Size: ${totalInstructions} words.`);

    if (pass1Errors.length > 0) {
         pass1Errors.forEach(err => logMessage(err, true));
         return { success: false, errors: pass1Errors, machineCode: [], formatInfo: [] };
     }
    if (totalInstructions > MEMORY_SIZE) {
        logMessage(`Assembly Error: Program too large (${totalInstructions} instructions exceeds memory size ${MEMORY_SIZE})`, true);
        return { success: false, errors: [`Program too large`], machineCode: [], formatInfo: [] };
    }

    // --- Pass 2: Generate Machine Code & Format Info ---
    logMessage("Running Pass 2 (Code Generation)...");
    errors = []; // Reset errors for Pass 2
    currentAddress = 0; // Tracks the index for machineCode/formatInfo arrays being pushed

    lines.forEach((line, index) => {
        let originalLine = line;
        let cleanedLine = line.replace(/;.*$/, '').trim();
        if (!cleanedLine) return; // Skip empty

        const isLabelOnlyLine = cleanedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*$/); // Check if ONLY a label
        const labelRemovedLine = cleanedLine.replace(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/, '').trim(); // Remove label def for parsing instr

        if (!labelRemovedLine || isLabelOnlyLine) {
            return; // Skip lines with only labels or empty after label removal
        }

        // --- Process potential instruction on this line ---
        // Use the refined Regex that handles optional operands better
        const instructionRegex = /^(?:\(([!A-Z0-9]+)\)\s+)?([A-Z]{1,4})\s*(.+)?$/i;
        const match = labelRemovedLine.match(instructionRegex);

        let generatedWord = 0; // Default word on error
        let specificFormat = "ERROR"; // Default format on error
        let hasErrorOnLine = false;

        if (!match) {
             if (labelRemovedLine) {
                  errors.push(`Line ${index + 1}: Invalid instruction format: "${originalLine.trim()}"`);
                  hasErrorOnLine = true;
             }
        } else {
            // Safely extract potentially undefined groups
            let [ , predMnemonic, mnemonic, operandsGroup] = match;
            mnemonic = mnemonic.toUpperCase();
            // Use captured group 3 (operandsGroup), trim if exists, otherwise empty string
            let operandsStr = operandsGroup ? operandsGroup.trim() : "";

            // ************************************************
            // **** BRANCH DEBUGGING BLOCK ****
            // ************************************************
            // Check content specifically for known failing lines
            const lineContentForDebug = labelRemovedLine.toLowerCase(); // Case-insensitive check
            if ((lineContentForDebug.startsWith("b ") || lineContentForDebug.match(/^\([a-z0-9!]+\)\s+b\s+/)) && // Basic check for Branch mnemonic
                (lineContentForDebug.includes("always_branch") ||
                 lineContentForDebug.includes("skip_target") ||
                 lineContentForDebug.includes("hit_target")))
            {
                console.log(`--- DEBUG Line ${index + 1} ---`);
                console.log(`Content Parsed: "${labelRemovedLine}"`);
                console.log(`Regex Result (match):`, match); // Log the actual match object or null
                if (match) {
                    console.log(`  Match[1] (Pred): ${match[1]}`);
                    console.log(`  Match[2] (Mnem): ${match[2]}`);
                    console.log(`  Match[3] (OpStr): ${match[3]} <-- Is this the correct label?`);
                    console.log(`  Using operandsStr: "${operandsStr}"`); // Log the extracted operand string
                } else {
                    console.log(`  Regex DID NOT MATCH!`);
                }
                console.log(`--- END DEBUG Line ${index + 1} ---`);
            }
            // ************************************************
            // **** END BRANCH DEBUGGING BLOCK ****
            // ************************************************


            if (!opCodeMap.hasOwnProperty(mnemonic)) {
                errors.push(`Line ${index + 1}: Unknown mnemonic '${mnemonic}'`);
                hasErrorOnLine = true;
            } else {
                const { opcode, format: baseFormat } = opCodeMap[mnemonic];
                let predCode = defaultPredCode;
                 if (predMnemonic) {
                    const canonicalPred = `(${predMnemonic.toUpperCase()})`;
                     if (!predMap.hasOwnProperty(canonicalPred)) {
                          if(predMnemonic.toUpperCase() === 'AL') { predCode = predMap['AL']; }
                          else { errors.push(`Line ${index + 1}: Invalid predicate '${predMnemonic}'`); hasErrorOnLine = true; }
                     } else { predCode = predMap[canonicalPred]; }
                 }

                let instructionWord = (opcode << 12) | (predCode << 9);
                specificFormat = "UNKNOWN"; // Reset before try

                if (!hasErrorOnLine) {
                    try {
                        let addrVal, rd, rn, rm, imm3, condStr, pdStr, condVal, pdVal; // Declare vars

                        switch (baseFormat) {
                             case 'Memory':
                                specificFormat = "MEMORY";
                                if (!operandsStr) throw new Error(`Expected 1 operand (Address or Label), found none.`);
                                addrVal = parseAddress(operandsStr, symbolTable, index + 1);
                                instructionWord |= (addrVal & ADDRESS_MASK);
                                break;

                            case 'Branch':
                                specificFormat = "BRANCH";
                                if (!operandsStr) throw new Error(`Expected 1 operand (Target Address or Label), found none.`);
                                addrVal = parseAddress(operandsStr, symbolTable, index + 1); // Use directly extracted operandsStr
                                instructionWord |= (addrVal & ADDRESS_MASK);
                                break;

                            case 'DataProc':
                                // Needs comma splitting for this format
                                let operandsDP = operandsStr ? operandsStr.split(',').map(op => op.trim()).filter(op => op.length > 0) : [];
                                if (mnemonic === 'CMP') {
                                     if (operandsDP.length !== 2) throw new Error(`Expected 2 operands (Rn, Rm or Rn, #Imm3), found ${operandsDP.length}`);
                                     rn = parseRegister(operandsDP[0], index+1);
                                     if (operandsDP[1].startsWith('#')) {
                                         specificFormat = "I_CMP";
                                         imm3 = parseImmediate(operandsDP[1], 3, false, index+1);
                                         instructionWord |= (rn << 3) | (imm3 & 0b111);
                                     } else {
                                         specificFormat = "R_CMP";
                                         rm = parseRegister(operandsDP[1], index+1);
                                         instructionWord |= (rn << 3) | (rm & 0b111);
                                     }
                                } else { // Other DataProc
                                    if (operandsDP.length !== 3) throw new Error(`Expected 3 operands (Rd, Rn, Rm or Rd, Rn, #Imm3), found ${operandsDP.length}`);
                                    rd = parseRegister(operandsDP[0], index+1);
                                    rn = parseRegister(operandsDP[1], index+1);
                                     if (operandsDP[2].startsWith('#')) {
                                         specificFormat = (mnemonic === 'MOV') ? "I_MOV" : "I_ALU";
                                         imm3 = parseImmediate(operandsDP[2], 3, false, index+1);
                                         instructionWord |= (rd << 6) | (rn << 3) | (imm3 & 0b111);
                                     } else {
                                         specificFormat = (mnemonic === 'MOV') ? "R_MOV" : "R_ALU";
                                         rm = parseRegister(operandsDP[2], index+1);
                                         instructionWord |= (rd << 6) | (rn << 3) | (rm & 0b111);
                                     }
                                }
                                break;
                            case 'SETP':
                                specificFormat = "SETP";
                                // Needs comma splitting
                                let operandsSETP = operandsStr ? operandsStr.split(',').map(op => op.trim()).filter(op => op.length > 0) : [];
                                if (operandsSETP.length !== 2) throw new Error(`Expected 2 operands (Condition, Pd), found ${operandsSETP.length}`);
                                condStr = operandsSETP[0].toUpperCase();
                                pdStr = operandsSETP[1].toUpperCase();
                                if (!condCodeMap.hasOwnProperty(condStr)) throw new Error(`Invalid condition code '${condStr}'`);
                                if (!pRegMap.hasOwnProperty(pdStr)) throw new Error(`Invalid predicate register '${pdStr}'`);
                                condVal = condCodeMap[condStr];
                                pdVal = pRegMap[pdStr];
                                instructionWord |= (pdVal << 7) | (condVal & 0b111111);
                                break;
                            case 'HLT':
                                specificFormat = "HLT";
                                // Check if operandsStr had any content (even after trim)
                                if (operandsStr) throw new Error(`HLT takes no operands, found '${operandsStr}'`);
                                break;
                            default:
                                throw new Error(`Internal Assembler Error: Unknown base format '${baseFormat}'`);
                        }
                        generatedWord = instructionWord; // Success
                    } catch (e) {
                        errors.push(`Line ${index + 1}: ${e.message} in "${originalLine.trim()}"`);
                        specificFormat = "ERROR";
                        hasErrorOnLine = true;
                    }
                } // end if !hasErrorOnLine (parsing part)
            } // end if opcode known
        } // end if instruction match

        // --- Add results for this instruction line ---
        // Only push if an instruction was expected here (i.e., not just a label line)
        if (!isLabelOnlyLine && labelRemovedLine){ // Ensure we process lines meant for instructions
            machineCode.push(generatedWord);
            // If an error occurred at any stage for this line, mark format as ERROR
            formatInfo.push(hasErrorOnLine ? "ERROR" : specificFormat);
            currentAddress++;
        }


        if (currentAddress > MEMORY_SIZE) {
             errors.push(`Assembly Error: Program has exceeded memory size ${MEMORY_SIZE}`);
             // Optional: break loop early?
        }

    }); // End forEach line

    // Final check and return logic ...
     if (errors.length > 0) {
        const nonBoundsErrors = errors.filter(e => !e.startsWith("Assembly Error: Program has exceeded"));
         if (nonBoundsErrors.length > 0) { nonBoundsErrors.forEach(err => logMessage(err, true)); }
         errors.filter(e => e.startsWith("Assembly Error: Program has exceeded")).forEach(err => logMessage(err, true));
        logMessage("Assembly failed.");
        return { success: false, errors: errors, machineCode: [], formatInfo: [] };
    } else if (currentAddress !== totalInstructions && totalInstructions <= MEMORY_SIZE) {
         logMessage(`Warning: Pass 1 count (${totalInstructions}) differs from Pass 2 generated count (${currentAddress}). Check assembly logic.`, true);
         return { success: true, errors: [], machineCode: machineCode, formatInfo: formatInfo };
    }
    else {
        logMessage(`Assembly successful. ${machineCode.length} words generated.`);
        return { success: true, errors: [], machineCode: machineCode, formatInfo: formatInfo };
    }
} // End of assemble function

// --- Assembler Helper Functions ---

function parseRegister(regStr, lineNum) {
    const reg = regStr.toUpperCase();
    if (!regMap.hasOwnProperty(reg)) {
        throw new Error(`Invalid register '${regStr}'`);
    }
    return regMap[reg];
}

function parseImmediate(immStr, bits, allowSigned, lineNum) {
    if (!immStr.startsWith('#')) {
        throw new Error(`Invalid immediate format '${immStr}'. Must start with '#'`);
    }
    const numStr = immStr.substring(1);
    let value;
    if (numStr.toLowerCase().startsWith('0x')) {
        value = parseInt(numStr, 16);
    } else if (numStr.toLowerCase().startsWith('0b')) {
         value = parseInt(numStr.substring(2), 2);
    } else {
        value = parseInt(numStr, 10);
    }

    if (isNaN(value)) {
        throw new Error(`Invalid number format for immediate '${immStr}'`);
    }

    // Check range based on bits and signedness
    // For Imm3 (unsigned 0-7 as per spec simplification)
     if (bits === 3 && !allowSigned) {
        if (value < 0 || value > 7) {
             throw new Error(`Immediate '${immStr}' out of range for 3-bit unsigned (0-7)`);
        }
        return value & 0b111;
    }
    // Add checks for other bit sizes if needed later

    // General case (adapt if signed needed)
     const maxUnsigned = (1 << bits) - 1;
     if (value < 0 || value > maxUnsigned) {
         // Add signed checks here if allowSigned is true
         throw new Error(`Immediate '${immStr}' out of range for ${bits}-bit value`);
     }

    return value & ((1 << bits) - 1); // Mask to required bits
}


function parseAddress(addrStr, symbolTable, lineNum) {
    console.log(`DEBUG parseAddress: Input='${addrStr}'`); // Log input
    let value;
    if (addrStr.toLowerCase().startsWith('0x')) {
        value = parseInt(addrStr, 16);
    } else if (/^[0-9]+$/.test(addrStr)) { // Allow decimal addresses too? Let's stick to hex/labels.
        value = parseInt(addrStr, 10); // Or disallow decimal addresses? Let's allow.
        // throw new Error(`Decimal addresses like '${addrStr}' are ambiguous. Use 0x prefix for hex.`);
    } else {
        // Assume it's a label
        if (!symbolTable.hasOwnProperty(addrStr)) {
            throw new Error(`Undefined label '${addrStr}'`);
        }
        value = symbolTable[addrStr];
    }

    if (isNaN(value) || value < 0 || value > ADDRESS_MASK) {
        throw new Error(`Invalid or out-of-range address/label value '${addrStr}' (0x000-0x1FF)`);
    }
    return value & ADDRESS_MASK;
}

// --- I/O Handling ---

function handleMMIORead(address) {
    logMessage(`MMIO Read triggered for address ${formatHex(address, 3)}`);
    // For now, only support input on Port 0x1F0
    if (address === MMIO_START_ADDRESS) { // 0x1F0
        cpu.waitingForInput = true;
        cpu.inputAddress = address;
        updateExecutionStatus(`Paused (Waiting for Input @ ${formatHex(address, 3)})`);
        logMessage(`Execution paused. Provide input value (0-65535) for ${formatHex(address, 3)} and click 'Provide Input'.`);
        updateUI(); // Update button states and show prompt
        // Execution resumes when the 'Provide Input' button is clicked (see event listener)
    } else {
        logMessage(`MMIO Read from unsupported/unimplemented port ${formatHex(address, 3)}. Returning 0.`, true);
        cpu.acc = 0; // Default value for reads from other MMIO addresses
    }
}

function resumeFromMMIORead(inputValue) {
    if (!cpu.waitingForInput) return;

    const value = parseInt(inputValue);
    if (isNaN(value) || value < 0 || value > DATA_MASK) {
        logMessage(`Invalid input value provided: "${inputValue}". Using 0.`, true);
        cpu.acc = 0;
    } else {
         logMessage(`Input ${formatHex(value, 4)} received for ${formatHex(cpu.inputAddress, 3)}.`);
        cpu.acc = value & DATA_MASK; // Put value into ACC (as per LDR target)
    }
    cpu.dr = cpu.acc; // Also update DR conceptually
    cpu.waitingForInput = false;
    cpu.inputAddress = 0;
    updateExecutionStatus("Running"); // Resume status
    updateUI(); // Update UI (hide prompt, enable buttons)

    // If running continuously, restart the interval
    if (runInterval !== null) {
        // Need to clear the *previous* interval handle if one existed *before* MMIO wait
        // This logic is tricky. Let's handle it in the run function itself.
        // For now, just allow manual stepping or restarting run after input.
        logMessage("Input received. Continue with 'Step' or 'Run'.");
        // Or attempt to restart run if needed: startSimulation();
    }
}

function handleMMIOWrite(address, value) {
    logMessage(`MMIO Write to ${formatHex(address, 3)}: Value = ${formatHex(value, 4)} (${value})`);
    // Append to the I/O output area
    const outputLine = `[${formatHex(address, 3)}]: ${formatHex(value, 4)} (${value})\n`;
    DOMElements.ioOutputArea.textContent += outputLine;
    DOMElements.ioOutputArea.scrollTop = DOMElements.ioOutputArea.scrollHeight; // Scroll to bottom
}

// --- Simulation Control Functions ---

function stepExecution() {
    if (cpu.halted || cpu.waitingForInput) {
        logMessage("Cannot step: CPU is halted or waiting for input.", true);
        return;
    }

    const pcToFetch = cpu.pc; // Get PC before potential increment

    if (pcToFetch > ADDRESS_MASK) { // Check bounds before fetch attempt
        logMessage(`PC out of bounds: ${formatHex(pcToFetch, 3)}`, true);
        cpu.halted = true;
        updateExecutionStatus("Halted (PC Error)");
        updateUI();
        return;
    }

    if (!fetchInstruction()) { // Fetches into cpu.ir
        updateUI();
        return;
    }
    const currentFormat = (pcToFetch < instructionFormats.length) ? instructionFormats[pcToFetch] : "UNKNOWN";

    incrementPC(); // Increment PC *before* execute
    decodeAndExecute(cpu.ir, currentFormat);

    // Update UI AFTER execution step is complete
    updateUI();

     // Check if HLT occurred during execution
    if (cpu.halted) {
        logMessage("CPU Halted after instruction execution.");
        stopSimulation(); // Ensure run loop stops if it was running
    }
     // Check if we are now waiting for input
     if (cpu.waitingForInput) {
         stopSimulation(); // Pause run loop if we hit MMIO read
     }
}

function startSimulation() {
    if (cpu.halted) {
        logMessage("CPU is halted. Reset to run again.", true);
        return;
    }
     if (cpu.waitingForInput) {
        logMessage("CPU is waiting for input. Provide input to continue.", true);
        return;
    }
    if (runInterval !== null) {
        logMessage("Simulation is already running.", true);
        return; // Prevent multiple intervals
    }

    let speedInput = parseFloat(DOMElements.runSpeedInput.value);
    let validatedSpeed;

    if (isNaN(speedInput) || speedInput < 0) { // Check for NaN or negative
        logMessage(`Invalid speed input "${DOMElements.runSpeedInput.value}". Must be non-negative. Using default 100ms.`, true);
        validatedSpeed = 100; // Fallback for invalid input
        DOMElements.runSpeedInput.value = validatedSpeed; // Correct the displayed value
    } else {
        validatedSpeed = speedInput; // Use the valid user input (0 or positive)
        // No need to update input field if it was already valid, it reflects user's choice
    }

    // Update the global runSpeedMs before starting the interval
    runSpeedMs = validatedSpeed;

    logMessage(`Starting continuous execution (Requested Delay: ${speedInput}ms, Actual Interval: ${runSpeedMs} ms)...`);
    // Note: Actual delay might be higher due to browser clamping (min ~4-10ms).
    if (runSpeedMs === 0) {
         logMessage("INFO: Delay of 0ms means 'run as fast as possible' (limited by browser).");
    }
    updateExecutionStatus("Running (Continuous)");
    updateUI(); // Update button states (disable Run, enable Stop)

    runInterval = setInterval(() => {
        // Check state *before* stepping in the interval callback
        if (cpu.halted || cpu.waitingForInput) {
            stopSimulation(); // Stop interval if CPU halted or needs input
        } else {
            stepExecution();
            // Re-check state *after* stepping, in case the executed step caused halt/wait
             if (cpu.halted || cpu.waitingForInput) {
                 stopSimulation(); // Stop immediately if halt/wait occurred
             }
        }
    }, runSpeedMs); // Use the validated speed
}

function stopSimulation() {
    if (runInterval !== null) {
        clearInterval(runInterval);
        runInterval = null;
        logMessage("Continuous execution stopped.");
         if (!cpu.halted && !cpu.waitingForInput) {
            updateExecutionStatus("Paused");
         }
         updateUI(); // Update button states
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // *** Logic for placeholder code in textarea ***
    const assemblyTextarea = DOMElements.assemblyCode;
    const initialExampleCode = assemblyTextarea.value; // Store the initial code
    let placeholderActive = true; // Flag to track if placeholder is active

    // Style it initially if it contains the placeholder code
    if(assemblyTextarea.value === initialExampleCode) {
        assemblyTextarea.classList.add('placeholder-active');
    } else {
        placeholderActive = false; // Code might have been changed before JS ran (e.g., browser restoring state)
    }

    // --- Event listener for FOCUS on the textarea ---
    assemblyTextarea.addEventListener('focus', () => {
        if (placeholderActive && assemblyTextarea.value === initialExampleCode) {
            assemblyTextarea.value = ''; // Clear the text
            assemblyTextarea.classList.remove('placeholder-active'); // Remove the placeholder styling
            placeholderActive = false; // Mark the placeholder as inactive, so this doesn't happen again on subsequent focuses
        }
    });
    assemblyTextarea.addEventListener('blur', () => {
        if (assemblyTextarea.value !== initialExampleCode && assemblyTextarea.classList.contains('placeholder-active')){
             // If content is NOT the placeholder but style IS applied, remove style.
             assemblyTextarea.classList.remove('placeholder-active');
        } else if (placeholderActive && assemblyTextarea.value === initialExampleCode && !assemblyTextarea.classList.contains('placeholder-active')) {
             // If placeholder IS active, content IS placeholder, but style is missing, add style.
             assemblyTextarea.classList.add('placeholder-active');
        }
    });

    // --- Event listener for INPUT (typing, pasting, deleting) in the textarea ---
    assemblyTextarea.addEventListener('input', () => {
        // If the placeholder was active, but the content has now changed from the initial example code...
        if (placeholderActive && assemblyTextarea.value !== initialExampleCode) {
            // The user has started typing meaningful input.
            assemblyTextarea.classList.remove('placeholder-active'); // Remove placeholder styling
            placeholderActive = false; // Mark placeholder as inactive for focus events
        }
    });

    // --- Event listener for the ASSEMBLE button ---
    DOMElements.assembleButton.addEventListener('click', () => {
        const code = DOMElements.assemblyCode.value;
        const result = assemble(code); // Assemble the code

        if (result.success) {
            // Load into memory if assembly was successful
            resetCPU(); // Reset CPU state before loading new program
            result.machineCode.forEach((word, index) => {
                if (index < MEMORY_SIZE) {
                    memory[index] = word; // Copy machine code word to memory
                }
            });
            instructionFormats = result.formatInfo; // Store format info for the simulator

            logMessage(`Loaded ${result.machineCode.length} words into memory.`);
            updateUI(); // Refresh the display (memory, registers)
            updateExecutionStatus("Ready"); // Set status to ready
        } else {
             // Assembly failed
             logMessage("Assembly failed. See error messages.", true);
             instructionFormats = []; // Clear format info on failure
             updateExecutionStatus("Assembly Error"); // Set error status
        }

        // Regardless of success/failure, ensure the placeholder logic is deactivated
        // since the user has now explicitly interacted via the assemble button.
        placeholderActive = false;
        assemblyTextarea.classList.remove('placeholder-active');
    });

    // --- Event listener for the STEP button ---
    DOMElements.stepButton.addEventListener('click', stepExecution);

    // --- Event listener for the RUN button ---
    DOMElements.runButton.addEventListener('click', startSimulation);

    // --- Event listener for the STOP button ---
    DOMElements.stopButton.addEventListener('click', stopSimulation);

    // --- Event listener for the RESET button ---
    DOMElements.resetButton.addEventListener('click', resetCPU);

    // --- Event listener for the PROVIDE INPUT button (MMIO) ---
    DOMElements.ioInputProvideButton.addEventListener('click', () => {
         // Only proceed if the CPU is actually waiting for input
         if (cpu.waitingForInput) {
            resumeFromMMIORead(DOMElements.ioInputValue.value); // Pass the value from the input field
         }
    });

    // --- Event listener for pressing ENTER in the MMIO input field ---
    DOMElements.ioInputValue.addEventListener('keydown', (event) => {
        // Check if the key pressed was 'Enter' and if the CPU is waiting
        if (event.key === 'Enter' && cpu.waitingForInput) {
            event.preventDefault(); // Prevent default form submission/newline behavior
            DOMElements.ioInputProvideButton.click(); // Simulate a click on the provide button
        }
    });

    // --- Event listener for changing the RUN SPEED input ---
    DOMElements.runSpeedInput.addEventListener('change', () => {
        let speedInput = parseFloat(DOMElements.runSpeedInput.value);
        let validatedSpeed;

        // Validate the input: allow 0 or positive numbers
        if (isNaN(speedInput) || speedInput < 0) { // Check for NaN or negative
             logMessage(`Invalid speed input "${DOMElements.runSpeedInput.value}". Must be non-negative. Resetting input to 100ms.`, true);
             validatedSpeed = 100; // Default if invalid
             DOMElements.runSpeedInput.value = validatedSpeed; // Correct the input field visually
        } else {
             validatedSpeed = speedInput; // Keep the user's valid input (0 or positive)
             // Input field already shows the valid number user entered
        }

        // Update the global runSpeedMs only AFTER validation
        runSpeedMs = validatedSpeed;
        logMessage(`Run speed setting changed to ${runSpeedMs}ms interval.`);
        // --- MODIFIED SECTION END ---


        // If simulation is running, restart it with the new speed
        if (runInterval !== null) {
            stopSimulation();
            startSimulation(); // startSimulation will now use the latest validated runSpeedMs
        }
    });
}

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    initializeSimulator();
    setupEventListeners(); // Attach listeners after init
});

// --- Make sure initializeSimulator is correctly defined ---
function initializeSimulator() {
    console.log("Initializing Simulator...");
     // Populate GPR DOM element cache
    for (let i = 0; i < 8; i++) {
        DOMElements.gpr[i] = document.getElementById(`reg-r${i}`);
    }
    resetCPU(); // Set initial state and render UI
    // Event listeners are added in setupEventListeners
    console.log("Simulator Initialized.");
}