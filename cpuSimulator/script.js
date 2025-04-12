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
     DOMElements.executionStatus.textContent = `Status: ${status}`;
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

function decodeAndExecute(instructionWord) {
    if (cpu.halted) return; // Don't execute if halted

    const opcode = instructionWord >> 12;          // Bits [15:12]
    const pred = (instructionWord >> 9) & 0b111;   // Bits [11:9]

    // --- 1. Predicate Check ---
    const predicateTrue = predicateCheck[pred](cpu.p_file);

    if (!predicateTrue) {
        // console.log(`Predicated false: Skipping instruction ${formatHex(instructionWord, 4)} at ${formatHex(cpu.pc -1, 3)}`); // PC already incremented
        updateExecutionStatus(`Running (Skipped ${formatHex(cpu.pc -1, 3)})`);
        return; // Skip execution if predicate is false
    }

    updateExecutionStatus(`Running (Executing ${formatHex(cpu.pc -1, 3)})`);

    // --- 2. Decode based on Opcode and Execute ---
    let rd, rn, rm, imm3, address, pd, condCode; // Declare fields needed

    switch (opcode) {
        // --- Memory Reference ---
        case 0b0000: // LDR - Load ACC from Memory
            address = instructionWord & 0x1FF; // Bits [8:0]
            cpu.ar = address; // Update internal AR
            if (address >= MMIO_START_ADDRESS) {
                // Memory-Mapped I/O Read
                 handleMMIORead(address); // This will pause execution if needed
                 // Value will be placed in ACC when input is provided (see handleMMIORead resume)
            } else {
                // Normal Memory Read
                cpu.dr = memory[address];
                cpu.acc = cpu.dr;
            }
            break;

        case 0b0001: // STR - Store ACC to Memory
            address = instructionWord & 0x1FF; // Bits [8:0]
            cpu.ar = address;
            cpu.dr = cpu.acc; // Data to be stored is in ACC
            if (address >= MMIO_START_ADDRESS) {
                // Memory-Mapped I/O Write
                handleMMIOWrite(address, cpu.dr);
            } else {
                // Normal Memory Write
                memory[address] = cpu.dr;
            }
            break;

        // --- Data Processing (R-Type / I-Type) ---
        // Determine if it's R-Type or I-Type based on context or specific bits
        // In this ISA, the same opcode is used. Let's assume a non-existent bit
        // distinguishes them, or more realistically, define separate opcodes or
        // check if Rn == specific value, etc.
        // *Correction:* The ISA PDF doesn't specify how R vs I is distinguished for ADD/SUB/etc.
        // Let's *assume* a hypothetical bit (e.g., bit 3) or just *implement both* and let the assembler decide?
        // *Simplest Approach Given Spec:* The assembler needs to generate the correct format.
        // The simulator can't easily distinguish ADD Rd, Rn, Rm from ADD Rd, Rn, #Imm based *only* on the opcode 0010.
        // *WORKAROUND:* Let's assume for simulation purposes we check if Rm field *could* be a valid register (0-7).
        // This is NOT how real hardware works but is a simulation necessity without a dedicated I-bit.
        // A better ISA would have an I-bit or separate opcodes.
        // *REVISED PLAN:* Assume the *assembler* MUST produce the correct instruction format bits.
        // The simulator will *only* interpret the format literally. The PDF shows distinct diagrams.
        // Let's assume R-Type is the primary format for these opcodes, and add specific I-type opcodes later if needed,
        // or stick to the formats literally as presented.

        // Sticking to the PDF format descriptions: ADD/SUB/AND/OR/XOR/MOV/LSHL/LSHR can be R or I type.
        // The *diagrams* show identical bit layouts except for the last field (Rm vs Imm3).
        // We will implement logic based on the opcode, assuming the bits are laid out as shown.

        case 0b0010: // ADD (R/I)
        case 0b0011: // SUB (R/I)
        case 0b0100: // AND (R/I)
        case 0b0101: // ORR (R/I)
        case 0b0110: // XOR (R/I)
        case 0b0111: // MOV (R/I)
        case 0b1011: // LSHL (R/I)
        case 0b1100: // LSHR (R/I)
            rd = (instructionWord >> 6) & 0b111; // Bits [8:6]
            rn = (instructionWord >> 3) & 0b111; // Bits [5:3]
            // Assume I-Type: Extract Imm3 (Zero-Extended as requested)
            imm3 = instructionWord & 0b111;       // Bits [2:0]
            // Assume R-Type: Extract Rm
            rm = instructionWord & 0b111;         // Bits [2:0]

            // *** SIMULATION HACK/CHOICE: How to decide R vs I? ***
            // Since the ISA doesn't give a bit, we *must* assume the *assembler* knows.
            // For the *simulator*, let's arbitrarily decide based on the opcode, or add
            // a convention (e.g., certain Rn values imply Immediate).
            // Let's choose a simple convention for NOW: If Rn is R7 (111), treat it as I-Type using Imm3.
            // This is NOT ideal but necessary without ISA clarification.
            // A better ISA would dedicate a bit.
            // *User specified example uses MOV R3, R7, #Imm - suggesting Rn is NOT the indicator*
            // *Let's strictly follow formats:* Implement both R and I type based on *separate* opcodes (even if map shows overlap)
            // *Going with user request to follow provided map strictly:* Opcodes ARE reused.
            // We need a way for the *assembler* to tell the simulator. Let's add a placeholder.
            // *RETHINK*: The simplest interpretation adhering to the diagrams is that *BOTH* formats
            // use the *same* opcode, and the *assembler* is responsible for generating the bits where
            // bits [2:0] are *either* Rm or Imm3. The simulator just reads those bits.
            // We'll treat bits [2:0] as the second source operand value, regardless of whether it *originally*
            // came from a register or immediate in assembly. This avoids simulator ambiguity.

            const operand2_val = instructionWord & 0b111; // Treat bits [2:0] as the value (either Imm3 zero-extended or Rm index)
            let operand1_val = cpu.gpr[rn];
            let result;

             // For R-type interpretation (needed for shifts where operand2 is the *amount*):
             let source_reg_val = cpu.gpr[operand2_val]; // Get value if Rm was intended

            switch (opcode) {
                case 0b0010: // ADD
                     // *If* we needed to distinguish R/I here, logic would differ.
                     // Assuming bits [2:0] ARE the second operand (either Imm or Reg Index)
                     // To make sense, ADD R, R, #Imm means bits [2:0] are Imm. ADD R,R,R means bits [2:0] are Rm index.
                     // Let's simulate the I-Type path: Rd = Rn + Imm3 (zero-extended)
                     result = alu_add(operand1_val, operand2_val); // operand2_val is Imm3 (0-7)
                     cpu.gpr[rd] = result;
                     // If simulating R-Type: result = alu_add(operand1_val, cpu.gpr[rm]); cpu.gpr[rd] = result;
                     // *** DECISION: Per example & simplicity: treat as I-Type by default for simulation ***
                    break;
                case 0b0011: // SUB (Treat as I-Type for now)
                     result = alu_sub(operand1_val, operand2_val);
                     cpu.gpr[rd] = result;
                    break;
                case 0b0100: // AND (Treat as I-Type for now)
                     result = alu_and(operand1_val, operand2_val);
                     cpu.gpr[rd] = result;
                     break;
                case 0b0101: // ORR (Treat as I-Type for now)
                    result = alu_or(operand1_val, operand2_val);
                    cpu.gpr[rd] = result;
                    break;
                case 0b0110: // XOR (Treat as I-Type for now)
                    result = alu_xor(operand1_val, operand2_val);
                    cpu.gpr[rd] = result;
                    break;
                case 0b0111: // MOV (Treat as I-Type for now: Rd = Imm3) - The example MOV R3, R7, #1 implies Rn is ignored? Let's assume Rd = Imm3 for I-type Mov.
                    // Correction: MOV Rd, Rn, #Imm usually means Rd = Rn + Imm or similar, but the spec implies Rd <- Imm or Rd <- Rm based on format.
                    // Let's assume MOV Rd, Rn, #Imm moves the *immediate* to Rd, ignoring Rn (matching example's dummy Rn usage)
                    result = alu_mov(operand2_val); // operand2_val is Imm3
                    cpu.gpr[rd] = result;
                    // If R-Type: result = alu_mov(cpu.gpr[rm]); cpu.gpr[rd] = result;
                    break;
                case 0b1011: // LSHL (Logical Shift Left) - Amount can be Imm3 or Rm's value
                     // Let's assume I-Type: Rd = Rn << Imm3
                     result = alu_lshl(operand1_val, operand2_val); // operand2_val is Imm3
                     cpu.gpr[rd] = result;
                     // If R-Type: result = alu_lshl(operand1_val, cpu.gpr[rm] & 0x7); cpu.gpr[rd] = result; // Use lower bits of Rm value
                     break;
                case 0b1100: // LSHR (Logical Shift Right) - Amount can be Imm3 or Rm's value
                     // Let's assume I-Type: Rd = Rn >>> Imm3
                     result = alu_lshr(operand1_val, operand2_val); // operand2_val is Imm3
                     cpu.gpr[rd] = result;
                     // If R-Type: result = alu_lshr(operand1_val, cpu.gpr[rm] & 0x7); cpu.gpr[rd] = result; // Use lower bits of Rm value
                     break;
             }
            // IMPORTANT NOTE: This simulation currently assumes the I-Type interpretation for ambiguous opcodes.
            // A robust solution requires the *assembler* to output distinct instruction words
            // or for the simulator to receive metadata about the original assembly line.
            break;


        case 0b1000: // CMP (Compare Register or Immediate) - SETS FLAGS
            rn = (instructionWord >> 3) & 0b111; // Bits [5:3]
            // Similar ambiguity R-Type (Rn vs Rm) vs I-Type (Rn vs Imm3)
            imm3 = instructionWord & 0b111;       // Bits [2:0]
            rm = instructionWord & 0b111;         // Bits [2:0]

            // Assume I-Type based on example CMP R0, #0
            const cmp_op1 = cpu.gpr[rn];
            const cmp_op2 = imm3; // Treat bits [2:0] as Imm3 for now
            // If R-Type: cmp_op2 = cpu.gpr[rm];

            updateFlagsForCMP(cmp_op1, cmp_op2); // Calculate Rn - Op2 and set flags
            // Result is discarded
            break;

        // --- Predicate Setting ---
        case 0b1001: // SETP - Set Predicate Register
            pd = (instructionWord >> 7) & 0b11;    // Bits [8:7] (00=P0, 01=P1, 10=P2, 11=P3)
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

        // --- Control Flow ---
        case 0b1010: // B - Branch
            address = instructionWord & 0x1FF; // Bits [8:0] (Absolute address)
            cpu.pc = address; // Update PC directly
            // Note: The default PC increment after fetch is overridden here.
            break;

        // --- System ---
        case 0b1101: // HLT - Halt Processor
            cpu.halted = true;
            updateExecutionStatus("Halted");
            logMessage("HLT instruction encountered.");
            stopSimulation(); // Stop run loop if active
            break;

        // --- Reserved Opcodes ---
        case 0b1110:
        case 0b1111:
            logMessage(`Executed Reserved Opcode: ${formatHex(opcode, 1)} at ${formatHex(cpu.pc - 1, 3)}`, true);
            cpu.halted = true;
            updateExecutionStatus("Halted (Reserved Opcode)");
            break;

        default:
            logMessage(`Unknown Opcode encountered: ${formatHex(opcode, 1)} at ${formatHex(cpu.pc - 1, 3)}`, true);
            cpu.halted = true;
            updateExecutionStatus("Halted (Unknown Opcode)");
            break;
    }

    // Ensure PC and AR remain within 9 bits, ACC/DR/TR/GPRs within 16 bits
    // (Masking is done where values are assigned)
}