// --- Global CPU State ---
let AC = 0;         // 16-bit Accumulator
let E = 0;          // 1-bit Extension (Carry)
let PC = 0;         // 10-bit Program Counter
let AR = 0;         // 10-bit Address Register
let IR = 0;         // 16-bit Instruction Register
let DR = 0;         // 16-bit Data Register
let TR = 0;         // 16-bit Temporary Register
let P1 = 0, P2 = 0, P3 = 0; // 1-bit Predicate Registers (P0 is always 1)
let FGI = 1;        // 1-bit Input Flag (Start ready)
let FGO = 1;        // 1-bit Output Flag (Start ready)
let INPR = 0;       // 8-bit Input Register
let OUTR = 0;       // 8-bit Output Register
let memory = new Array(1024).fill(0); // 1024 words of 16 bits
let halt = false;   // Halt flag
let runInterval = null; // Interval timer for run mode
let inputBuffer = ''; // Buffer for simulated input
let currentSymbolTable = {}; // Store symbol table from last assembly
let lastPC = 0; // Track PC before fetch for status messages

// --- Constants ---
const MASK_16BIT = 0xFFFF;
const MASK_10BIT = 0x3FF;
const MASK_8BIT = 0xFF;
const SIGN_BIT_16 = 0x8000;

// --- UI Element References ---
const codeInput = document.getElementById('codeInput');
const loadBtn = document.getElementById('loadBtn');
const stepBtn = document.getElementById('stepBtn');
const runBtn = document.getElementById('runBtn');
const resetBtn = document.getElementById('resetBtn');
const runDelayInput = document.getElementById('runDelay');
const statusDiv = document.getElementById('status');
const memoryView = document.getElementById('memoryView');
const inputData = document.getElementById('inputData');
const sendInputBtn = document.getElementById('sendInputBtn');
const nextInputCode = document.getElementById('nextInputCode');
const outputData = document.getElementById('outputData');

// --- Utility Functions ---

// Format number as hex string with padding
function formatHex(value, bits) {
    const hex = value.toString(16).toUpperCase();
    const padding = Math.ceil(bits / 4);
    return hex.padStart(padding, '0');
}

// Convert signed 16-bit value to decimal
function formatSignedDec(value) {
    if (value & SIGN_BIT_16) { // Check sign bit
        return (~(value - 1) & MASK_16BIT) * -1; // Calculate two's complement negative value
    }
    return value;
}

// Update all register displays in the UI
function updateRegistersUI() {
    document.getElementById('regPC_hex').textContent = formatHex(PC, 10);
    document.getElementById('regPC_dec').textContent = PC;
    document.getElementById('regAR_hex').textContent = formatHex(AR, 10);
    document.getElementById('regAR_dec').textContent = AR;
    document.getElementById('regIR_hex').textContent = formatHex(IR, 16);
    document.getElementById('regIR_dec').textContent = IR;
    document.getElementById('regAC_hex').textContent = formatHex(AC, 16);
    document.getElementById('regAC_dec').textContent = formatSignedDec(AC); // Show signed decimal for AC
    document.getElementById('regDR_hex').textContent = formatHex(DR, 16);
    document.getElementById('regDR_dec').textContent = formatSignedDec(DR);
    document.getElementById('regTR_hex').textContent = formatHex(TR, 16);
    document.getElementById('regTR_dec').textContent = formatSignedDec(TR);
    document.getElementById('regE_hex').textContent = E;
    document.getElementById('regE_dec').textContent = E;
    document.getElementById('regP1_hex').textContent = P1;
    document.getElementById('regP1_dec').textContent = P1;
    document.getElementById('regP2_hex').textContent = P2;
    document.getElementById('regP2_dec').textContent = P2;
    document.getElementById('regP3_hex').textContent = P3;
    document.getElementById('regP3_dec').textContent = P3;
    document.getElementById('regFGI_hex').textContent = FGI;
    document.getElementById('regFGI_dec').textContent = FGI;
    document.getElementById('regINPR_hex').textContent = formatHex(INPR, 8);
    document.getElementById('regINPR_dec').textContent = INPR;
    document.getElementById('regOUTR_hex').textContent = formatHex(OUTR, 8);
    document.getElementById('regOUTR_dec').textContent = OUTR;
}

// Update the memory view display, potentially showing labels
function updateMemoryUI() {
    let memHTML = '';
    // Simple display for debugging: Show first 100 locations
    console.log("Updating Memory UI...");
    for (let i = 0; i < Math.min(memory.length, 100); i++) { // Show limited range for debugging
        const value = memory[i];
        const pcMarker = (i === lastPC) ? ' *PC*' : '';
        const arMarker = (i === AR) ? ' >AR' : '';
        memHTML += `${formatHex(i, 10)}: ${formatHex(value, 16)}${pcMarker}${arMarker}\n`;
    }
    if (memory.length > 100) {
        memHTML += '...\n';
    }
    memoryView.textContent = memHTML;
}

// Update the input status display
function updateInputUI() {
    if (inputBuffer.length > 0) {
        const charCode = inputBuffer.charCodeAt(0);
        nextInputCode.textContent = `${charCode} ('${inputBuffer[0]}')`;
        FGI = 1; // Set flag if data is available
    } else {
        nextInputCode.textContent = 'N/A';
        FGI = 0; // Clear flag if buffer is empty
    }
    updateRegistersUI(); // Update FGI display
}

// Reset the entire simulator state
function reset() {
    console.log("Resetting simulator state...");
    AC = 0; E = 0; PC = 0; AR = 0; IR = 0; DR = 0; TR = 0;
    P1 = 0; P2 = 0; P3 = 0;
    FGI = 0;
    FGO = 1;
    INPR = 0; OUTR = 0;
    memory = new Array(1024).fill(0); // Reinitialize memory
    halt = false;
    inputBuffer = '';
    outputData.value = '';
    currentSymbolTable = {};
    lastPC = 0;
    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
        runBtn.textContent = "Run"; // Ensure button resets
    }
    statusDiv.textContent = "Status: Reset";
    console.log("Memory reset, length:", memory.length);
    updateInputUI();
    updateRegistersUI();
    updateMemoryUI(); // Update UI after reset
    console.log("Reset complete.");
}

// Load program from text area into memory using the assembler
function loadProgram() {
    console.log("Load Program button clicked.");
    reset(); // Ensure clean state before loading
    const assemblyCode = codeInput.value;
    console.log("Attempting to assemble code...");
    const result = assemble(assemblyCode); // Use the assembler

    if (result.success && result.machineCode.length > 0) {
        console.log("Assembly successful. Loading machine code into memory...");
        currentSymbolTable = result.symbolTable; // Store symbol table
        result.machineCode.forEach(entry => {
            if (entry.address >= 0 && entry.address < memory.length) {
                console.log(`DEBUG Load: Preparing to write Addr=${formatHex(entry.address, 10)}, Value=${formatHex(entry.instruction, 16)}`);
                writeMemory(entry.address, entry.instruction); // Use helper
            } else {
                console.error(`Load Error: Address ${entry.address} out of bounds for instruction ${formatHex(entry.instruction, 16)} from line ${entry.sourceLineNumber}.`);
            }
        });
        statusDiv.textContent = "Status: Program Assembled and Loaded";
        console.log("Loading complete.");
        updateMemoryUI(); // Update UI *after* loading loop
        updateRegistersUI();
    } else if (result.success && result.machineCode.length === 0) {
        statusDiv.textContent = "Status: Assembly successful, but no code generated (check input).";
        console.warn("Assembly generated no machine code.");
        updateMemoryUI(); // Update UI to show empty memory
        updateRegistersUI();
    } else {
        console.error("Assembly failed.");
        updateMemoryUI(); // Update UI to show empty memory after failed load
        updateRegistersUI();
    }
}

// --- Simulation Core ---

// Fetch cycle
function fetch() {
    if (halt) {
        console.log("Fetch skipped: Halt flag is set.");
        return false;
    }
    lastPC = PC; // Store PC before fetch for UI display
    AR = PC; // T0: AR <- PC
    console.log(`Fetch: PC=${formatHex(lastPC, 10)}`); // Log fetch PC

    if (AR < 0 || AR >= memory.length) {
        statusDiv.textContent = `Status: Halted - PC out of bounds (${formatHex(AR, 10)})`;
        console.error(`Halt: PC out of bounds (${formatHex(AR, 10)})`);
        halt = true;
        updateMemoryUI();
        updateRegistersUI();
        return false;
    }
    IR = memory[AR]; // T1: IR <- M[AR]
    PC = (PC + 1) & MASK_10BIT; // T1: PC <- PC + 1
    console.log(`  Fetched IR=${formatHex(IR, 16)}, New PC=${formatHex(PC, 10)}`); // Log fetched instruction
    return true;
}

// Decode instruction fields
function decode() {
    const I = (IR >> 15) & 1;
    const opcode = (IR >> 12) & 0b111; // Bits 14-12
    const pred = (IR >> 10) & 0b11;    // Bits 11-10
    const addr_op = IR & MASK_10BIT;   // Bits 9-0

    return { I, opcode, pred, addr_op };
}

// Evaluate the predicate condition
function evaluatePredicate(predField) {
    switch (predField) {
        case 0b00: return true; // P0 is always true
        case 0b01: return P1 === 1;
        case 0b10: return P2 === 1;
        case 0b11: return P3 === 1;
        default: return false; // Should not happen
    }
}

// Evaluate SETP condition
function evaluateSetpCondition(conditionCode) {
    console.log(`DEBUG SETP: Evaluating condition code ${conditionCode.toString(2)}`); // Log condition code
    switch (conditionCode) {
        case 0b001: return AC > 0; // AC > 0
        case 0b010: return (AC & SIGN_BIT_16) !== 0; // AC < 0 (Check sign bit)
        case 0b011: return AC === 0; // AC = 0
        case 0b100: // E=0
            console.log(`DEBUG SETP: Checking E === 0. Current E=${E}`); // Log E value
            return E === 0;
        case 0b101: return P1 === 1; // P1=1
        case 0b110: return P2 === 1; // P2=1
        case 0b111: return P3 === 1; // P3=1
        default:
            console.error(`Unknown SETP condition code: ${conditionCode}`);
            return false;
    }
}

// --- Memory Access Helpers (Moved to global scope) ---
const readMemory = (addr) => {
    if (addr < 0 || addr >= memory.length) {
        statusDiv.textContent = `Status: Halted - Memory read out of bounds (${formatHex(addr, 10)}) at PC=${formatHex(lastPC, 10)}`;
        console.error(`Halt: Memory read out of bounds (${formatHex(addr, 10)}) at PC=${formatHex(lastPC, 10)}`);
        halt = true;
        return undefined; // Indicate error
    }
    return memory[addr];
};

const writeMemory = (addr, value) => {
    if (addr < 0 || addr >= memory.length) {
        statusDiv.textContent = `Status: Halted - Memory write out of bounds (${formatHex(addr, 10)}) at PC=${formatHex(lastPC, 10)}`;
        console.error(`Halt: Memory write out of bounds (${formatHex(addr, 10)}) at PC=${formatHex(lastPC, 10)}`);
        halt = true;
        return false; // Indicate error
    }
    const oldValue = memory[addr]; // Get old value for logging
    memory[addr] = value & MASK_16BIT; // Ensure value is 16 bits
    console.log(`DEBUG writeMemory: Addr=${formatHex(addr, 10)}, Old=${formatHex(oldValue, 16)}, New=${formatHex(memory[addr], 16)}`);
    return true; // Indicate success
};

// Execute the instruction in IR
function execute() {
    if (halt) {
        console.log("Execute skipped: Halt flag is set.");
        return;
    }
    console.log(`Execute: Processing IR=${formatHex(IR, 16)} fetched from ${formatHex(lastPC, 10)}`);
    const { I, opcode, pred, addr_op } = decode();
    let effectiveAddress = addr_op; // Default to direct address
    let executeInstruction = true; // Assume execution unless predicate fails

    // --- Determine Instruction Type and Handle Indirect Addressing ---
    let isMemoryRef = false;
    let isSetp = false;
    let isRegRef = false;
    let isIO = false;

    if (opcode === 0b111) { // Register Ref / IO / SETP
        if (I === 0) { // Register Ref or SETP
            if ((IR & 0xFF00) === 0x7300) { // Check for SETP signature (73xx)
                isSetp = true;
            } else {
                isRegRef = true;
            }
        } else { // I=1, IO Instruction
            isIO = true;
        }
    } else { // Memory Reference (Opcode 000-110)
        isMemoryRef = true;
        // Handle Indirect Addressing (T3)
        if (I === 1) {
            const indirectAddr = addr_op; // The address *containing* the effective address
            if (indirectAddr < 0 || indirectAddr >= memory.length) {
                statusDiv.textContent = `Status: Halted - Indirect address pointer out of bounds (${formatHex(indirectAddr, 10)})`;
                console.error(`Halt: Indirect address pointer out of bounds (${formatHex(indirectAddr, 10)})`);
                halt = true;
                return;
            }
            console.log(`DEBUG Decode Indirect: Reading address from M[${formatHex(indirectAddr, 10)}]`);
            const fetchedAddress = readMemory(indirectAddr);
            if (fetchedAddress === undefined) { // Check if readMemory halted
                return;
            }
            effectiveAddress = fetchedAddress & MASK_10BIT; // Use only 10 bits for address
            console.log(`Decode: Indirect Addr=${formatHex(indirectAddr, 10)}, Fetched EffAddr=${formatHex(effectiveAddress, 10)}`);
        }
    }

    if (isMemoryRef) { // Check bounds for memory refs
        if (effectiveAddress < 0 || effectiveAddress >= memory.length) {
            statusDiv.textContent = `Status: Halted - Memory access address out of bounds (${formatHex(effectiveAddress, 10)})`;
            console.error(`Halt: Memory access address out of bounds (${formatHex(effectiveAddress, 10)})`);
            halt = true;
            return;
        }
        AR = effectiveAddress; // AR holds effective address for Mem Ref
        console.log(`DEBUG AR Assign: MemRef. EffectiveAddr=${formatHex(effectiveAddress, 10)}. AR=${formatHex(AR, 10)}`);
    } else if (isSetp || isRegRef || isIO) {
        AR = addr_op;
        console.log(`DEBUG AR Assign: Reg/IO/SETP. AddrOpField=${formatHex(addr_op, 10)}. AR=${formatHex(AR, 10)}`);
    } else {
        console.error(`DEBUG AR Assign: Unknown instruction type for IR=${formatHex(IR, 16)}`);
        AR = addr_op; // Default assignment
    }

    // --- Predicate Evaluation (Common for predicated instructions) ---
    isPredicated = false; // Reset before check
    if (isMemoryRef) {
        isPredicated = true;
    } else if (isRegRef) {
        const baseOperation = IR & 0x0FFF & ~0x0C00; // Mask out predicate bits
        for (const mnemonic in registerRefOpcodes) {
            if (registerRefOpcodes[mnemonic] === baseOperation && predicatedRegRef.includes(mnemonic)) {
                isPredicated = true;
                break;
            }
        }
    } else if (isIO) {
        const baseOperation = IR & 0x0FFF & ~0x0C00; // Mask out predicate bits
        for (const mnemonic in ioOpcodes) {
            if (ioOpcodes[mnemonic] === baseOperation && predicatedIO.includes(mnemonic)) {
                isPredicated = true;
                break;
            }
        }
    }

    if (isPredicated) {
        executeInstruction = evaluatePredicate(pred);
        if (!executeInstruction) {
            statusDiv.textContent = `Status: Instruction ${formatHex(IR, 16)} at ${formatHex(lastPC, 10)} nullified (P${pred}=0)`;
            updateRegistersUI();
            updateMemoryUI();
            return;
        }
    }

    // --- Instruction Execution Logic ---
    statusDiv.textContent = `Status: Executing ${formatHex(IR, 16)} at ${formatHex(lastPC, 10)}`;
    console.log(`Executing instruction: ${formatHex(IR, 16)} at ${formatHex(lastPC, 10)}`);

    if (isMemoryRef) {
        console.log(`DEBUG MemRef Predicate Check: Pred=${pred}, P${pred}=${[P1,P2,P3][pred-1]}, isPredicated=${isPredicated}, executeInstruction=${executeInstruction}`);
        if (isPredicated && !executeInstruction) { // Check if predicated AND nullified
            console.log(`Skipped predicated MemRef IR=${formatHex(IR, 16)} because predicate was false.`);
            updateRegistersUI(); updateMemoryUI(); return; // Nullified
        }
        // If not predicated, or predicated and true, continue...

        let memValue;
        // Pre-read for instructions that need it
        if ([0b000, 0b001, 0b010, 0b110].includes(opcode)) {
            memValue = readMemory(AR);
            if (memValue === undefined) {
                updateRegistersUI();
                updateMemoryUI();
                return;
            }
        }

        switch (opcode) {
            case 0b000: // AND
                DR = memValue;
                AC = (AC & DR) & MASK_16BIT;
                break;
            case 0b001: // ADD
                DR = memValue;
                const sum = AC + DR;
                AC = sum & MASK_16BIT;
                E = (sum > MASK_16BIT) ? 1 : 0;
                break;
            case 0b010: // LDA
                DR = memValue;
                AC = DR;
                break;
            case 0b011: // STA
                if (!writeMemory(AR, AC)) {
                    updateRegistersUI();
                    updateMemoryUI();
                    return;
                }
                updateMemoryUI();
                break;
            case 0b100: // BUN
                PC = AR;
                break;
            case 0b101: // BSA
                const returnAddr = PC; // PC = address *after* BSA instruction
                const subroutineAddr = AR; // AR = effective address of subroutine label
                const postStoreAR = (subroutineAddr + 1) & MASK_10BIT; // T4: AR <- AR + 1

                console.log(`DEBUG BSA[${formatHex(lastPC,10)}]: Start. AR(subAddr)=${formatHex(subroutineAddr, 10)}, PC(retAddr)=${formatHex(returnAddr, 10)}, postStoreAR=${formatHex(postStoreAR, 10)}`);

                // T4: M[AR] <- PC (Store return address at subroutineAddr)
                console.log(`DEBUG BSA[${formatHex(lastPC,10)}]: Attempting writeMemory(${formatHex(subroutineAddr, 10)}, ${formatHex(returnAddr, 10)})`);
                const bsaWriteSuccess = writeMemory(subroutineAddr, returnAddr);
                if (!bsaWriteSuccess) {
                    console.error(`DEBUG BSA[${formatHex(lastPC,10)}]: writeMemory FAILED.`);
                    updateRegistersUI(); updateMemoryUI(); return; // Halt occurred
                }
                console.log(`DEBUG BSA[${formatHex(lastPC,10)}]: writeMemory SUCCEEDED.`);

                // T4: AR <- AR + 1
                AR = postStoreAR; // Update AR *after* using subroutineAddr for store
                console.log(`DEBUG BSA[${formatHex(lastPC,10)}]: AR updated to ${formatHex(AR, 10)}`);

                // Check jump target (which is now AR) bounds before assigning to PC
                if (AR < 0 || AR >= memory.length) {
                    console.error(`DEBUG BSA[${formatHex(lastPC,10)}]: Jump target AR=${formatHex(AR, 10)} out of bounds.`);
                    statusDiv.textContent = `Status: Halted - BSA jump target address out of bounds (${formatHex(AR, 10)})`;
                    halt = true;
                    updateRegistersUI(); updateMemoryUI(); return;
                }

                // T5: PC <- AR
                PC = AR;
                console.log(`DEBUG BSA[${formatHex(lastPC,10)}]: Jumped. New PC=${formatHex(PC, 10)}`);
                updateMemoryUI();
                break;
            case 0b110: // ISZ
                // T4: DR <- M[AR] (memValue holds M[AR])
                DR = memValue;
                console.log(`DEBUG ISZ[${formatHex(lastPC,10)}]: Start. AR=${formatHex(AR, 10)}, M[AR](memValue)=${formatHex(memValue, 16)}`);

                // T5: DR <- DR + 1
                DR = (DR + 1) & MASK_16BIT;
                console.log(`DEBUG ISZ[${formatHex(lastPC,10)}]: Incremented DR=${formatHex(DR, 16)}`);

                // T6: M[AR] <- DR (Write incremented value back)
                console.log(`DEBUG ISZ[${formatHex(lastPC,10)}]: Attempting writeMemory(${formatHex(AR, 10)}, ${formatHex(DR, 16)})`);
                const iszWriteSuccess = writeMemory(AR, DR);
                if (!iszWriteSuccess) {
                    console.error(`DEBUG ISZ[${formatHex(lastPC,10)}]: writeMemory FAILED.`);
                    updateRegistersUI(); updateMemoryUI(); return; // Halt occurred
                }
                console.log(`DEBUG ISZ[${formatHex(lastPC,10)}]: writeMemory SUCCEEDED.`);

                // T6: if (DR = 0) then (PC ← PC + 1)
                if (DR === 0) {
                    PC = (PC + 1) & MASK_10BIT;
                    pcIncrementedBySkip = true;
                    console.log(`DEBUG ISZ[${formatHex(lastPC,10)}]: Skipped. New PC=${formatHex(PC, 10)}`);
                } else {
                    console.log(`DEBUG ISZ[${formatHex(lastPC,10)}]: No skip.`);
                }
                updateMemoryUI();
                break;
        }
    } else if (isSetp) {
        const cond = (IR >> 6) & 0b11;
        const dest = (IR >> 4) & 0b11;
        let conditionMet = false;
        const isNegative = (AC & SIGN_BIT_16) !== 0;
        const isZero = AC === 0;

        switch (cond) {
            case 0b00: conditionMet = !isNegative && !isZero; break;
            case 0b01: conditionMet = isNegative; break;
            case 0b10: conditionMet = isZero; break;
            case 0b11: conditionMet = (E === 0); break;
        }
        const valueToSet = conditionMet ? 1 : 0;
        switch (dest) {
            case 0b01: P1 = valueToSet; break;
            case 0b10: P2 = valueToSet; break;
            case 0b11: P3 = valueToSet; break;
        }
    } else if (isRegRef) {
        const operationBits = IR & 0xFFF;
        console.log(`DEBUG RegRef Predicate Check: Pred=${pred}, P${pred}=${[P1,P2,P3][pred-1]}, isPredicated=${isPredicated}, executeInstruction=${executeInstruction}`);

        if (isPredicated && !executeInstruction) {
            console.log(`Skipped predicated RegRef IR=${formatHex(IR, 16)} because predicate was false.`);
            updateRegistersUI(); updateMemoryUI(); return; // Nullified
        }

        let operationPerformed = false; // Track if any micro-op ran

        // Group 1 (Operate) - Can be combined
        if (operationBits & 0x0800) { AC = 0; console.log("RegRef: CLA"); operationPerformed = true; } // Bit 11: CLA
        if (operationBits & 0x0400) { E = 0; console.log("RegRef: CLE"); operationPerformed = true; } // Bit 10: CLE
        if (operationBits & 0x0200) { AC = (~AC) & MASK_16BIT; console.log("RegRef: CMA"); operationPerformed = true; } // Bit 9: CMA
        if (operationBits & 0x0100) { E = 1 - E; console.log("RegRef: CME"); operationPerformed = true; } // Bit 8: CME
        if (operationBits & 0x0080) { const LSB_AC = AC & 1; AC = (AC >> 1) | (E << 15); E = LSB_AC; AC &= MASK_16BIT; console.log("RegRef: CIR"); operationPerformed = true; } // Bit 7: CIR
        if (operationBits & 0x0040) { const MSB_AC = (AC >> 15) & 1; AC = (AC << 1) | E; E = MSB_AC; AC &= MASK_16BIT; console.log("RegRef: CIL"); operationPerformed = true; } // Bit 6: CIL
        if (operationBits & 0x0020) { AC = (AC + 1) & MASK_16BIT; console.log("RegRef: INC"); operationPerformed = true; } // Bit 5: INC

        // Group 2 (Skip) - Checked sequentially, only one skip can happen
        if (operationBits & 0x0010) { // Bit 4: SPA
            if ((AC & SIGN_BIT_16) === 0) { PC = (PC + 1) & MASK_10BIT; pcIncrementedBySkip = true; console.log("RegRef: SPA Skip"); }
            operationPerformed = true;
        } else if (operationBits & 0x0008) { // Bit 3: SNA
            if ((AC & SIGN_BIT_16) !== 0) { PC = (PC + 1) & MASK_10BIT; pcIncrementedBySkip = true; console.log("RegRef: SNA Skip"); }
            operationPerformed = true;
        } else if (operationBits & 0x0004) { // Bit 2: SZA
            if (AC === 0) { PC = (PC + 1) & MASK_10BIT; pcIncrementedBySkip = true; console.log("RegRef: SZA Skip"); }
            operationPerformed = true;
        } else if (operationBits & 0x0002) { // Bit 1: SZE
            if (E === 0) { PC = (PC + 1) & MASK_10BIT; pcIncrementedBySkip = true; console.log("RegRef: SZE Skip"); }
            operationPerformed = true;
        }

        // Group 3 (HLT)
        if (operationBits & 0x0001) { // Bit 0: HLT
            console.log(`DEBUG HLT[${formatHex(lastPC,10)}]: About to execute HLT. Current AR=${formatHex(AR, 10)}`);
            halt = true;
            statusDiv.textContent = `Status: Halted by HLT at ${formatHex(lastPC, 10)}`;
            console.log(`DEBUG HLT[${formatHex(lastPC,10)}]: Halt flag set. Final AR=${formatHex(AR, 10)}`);
            operationPerformed = true;
        }

        // Handle NOP (0000)
        if (operationBits === 0x0000) {
            console.log(`Executed NOP at ${formatHex(lastPC, 10)}`);
            operationPerformed = true;
        }

        // If it was predicated but no operation bits were set (shouldn't happen with valid opcodes)
        if (isPredicated && !operationPerformed) {
            console.log(`Predicated RegRef IR=${formatHex(IR, 16)} executed but no micro-ops matched?`);
        }
    } else if (isIO) {
        const operationBits = IR & 0xFFF;

        if (isPredicated && executeInstruction) {
            const baseOperation = operationBits & ~0x0C00;
            switch (baseOperation) {
                case ioOpcodes['INP']:
                    if (FGI === 1) {
                        AC = (AC & 0xFF00) | (INPR & MASK_8BIT);
                        FGI = 0;
                        updateInputUI();
                    } else {
                        statusDiv.textContent = `Status: INP skipped, FGI=0`;
                    }
                    break;
                case ioOpcodes['OUT']:
                    if (FGO === 1) {
                        OUTR = AC & MASK_8BIT;
                        outputData.value += String.fromCharCode(OUTR);
                        FGO = 0;
                        setTimeout(() => { FGO = 1; updateRegistersUI(); }, 50);
                    } else {
                        statusDiv.textContent = `Status: OUT skipped, FGO=0`;
                    }
                    break;
            }
        } else if (isPredicated && !executeInstruction) {
            console.log(`Skipped predicated IO IR=${formatHex(IR, 16)} because predicate was false.`);
        }

        let isNonPredicatedOpIO = false;
        const baseOperationNonPredIO = operationBits & ~0x0C00;
        for (const mnemonic in ioOpcodes) {
            if (ioOpcodes[mnemonic] === baseOperationNonPredIO && !predicatedIO.includes(mnemonic)) {
                isNonPredicatedOpIO = true;
                break;
            }
        }
        if (isNonPredicatedOpIO) {
            switch (operationBits) {
                case ioOpcodes['SKI']: if (FGI === 1) { PC = (PC + 1) & MASK_10BIT; } break;
                case ioOpcodes['SKO']: if (FGO === 1) { PC = (PC + 1) & MASK_10BIT; } break;
            }
        }
    }

    updateRegistersUI();
    updateMemoryUI();

    // Log end state
    const finalLogPrefix = halt ? `Execute Halted` : `Execute End`;
    console.log(`${finalLogPrefix}: PC=${formatHex(PC, 10)}, AR=${formatHex(AR, 10)}, AC=${formatHex(AC, 16)}, E=${E}, P1-3=${P1}${P2}${P3}, Halt=${halt}`);
}

// Perform one full instruction cycle
function step() {
    console.log("Step button clicked or step called.");
    if (halt) {
        statusDiv.textContent = `Status: Halted at ${formatHex(lastPC, 10)}`;
        console.log("Step: Already halted.");
        updateRegistersUI();
        updateMemoryUI();
        if (runInterval) {
            clearInterval(runInterval);
            runInterval = null;
            runBtn.textContent = "Run";
            console.log("Step: Cleared run interval while halted.");
        }
        return;
    }
    if (fetch()) {
        execute();
    }
    if (halt) {
        console.log("Step: Halt flag detected after fetch/execute.");
        statusDiv.textContent = `Status: Halted at ${formatHex(lastPC, 10)}`;
        if (runInterval) {
            clearInterval(runInterval);
            runInterval = null;
            runBtn.textContent = "Run";
            console.log("Step: Cleared run interval after halt detected.");
        }
        updateRegistersUI();
        updateMemoryUI();
    }
}

// Run the simulation continuously
function run() {
    console.log("Run button clicked.");
    if (runInterval) {
        console.log("Pausing execution.");
        clearInterval(runInterval);
        runInterval = null;
        runBtn.textContent = "Run";
        statusDiv.textContent = "Status: Paused";
        return;
    }

    if (halt) {
        console.log("Run: Cannot start, already halted.");
        statusDiv.textContent = "Status: Halted";
        return;
    }

    const delay = parseInt(runDelayInput.value) || 0;
    runBtn.textContent = "Pause";
    statusDiv.textContent = "Status: Running...";
    console.log(`Starting continuous run with delay ${delay}ms.`);

    runInterval = setInterval(() => {
        if (halt) {
            console.log("Run Interval: Halt detected, stopping.");
            clearInterval(runInterval);
            runInterval = null;
            runBtn.textContent = "Run";
            statusDiv.textContent = `Status: Halted at ${formatHex(lastPC, 10)}`;
            updateRegistersUI();
            updateMemoryUI();
        } else {
            step();
        }
    }, delay);
}

// Override handleInput to set FGI immediately if buffer has content
function handleInput() {
    inputBuffer += inputData.value;
    inputData.value = '';
    FGI = (inputBuffer.length > 0) ? 1 : 0;
    updateInputUI();
    updateRegistersUI();
}

// --- Event Listeners ---
loadBtn.addEventListener('click', loadProgram);
stepBtn.addEventListener('click', step);
runBtn.addEventListener('click', run);
resetBtn.addEventListener('click', reset);
sendInputBtn.addEventListener('click', handleInput);
inputData.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleInput();
    }
});

// --- Initial Setup ---
reset(); // Initialize state on page load

