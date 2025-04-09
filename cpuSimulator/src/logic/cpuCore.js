// src/logic/cpuCore.js

// --- Constants based on ISA Document ---
export const MEMORY_SIZE = 512;
export const WORD_SIZE = 16;
export const ADDR_MASK = 0x1FF; // 9 bits for address/port/ignored operand
export const MAX_WORD_VALUE = 0xFFFF;
export const SIGN_BIT_MASK = 0x8000;

// Predicates (MUST MATCH assembler.js)
export const PREDICATE = {
    AL: 0b000, // Always
    EQ: 0b001, // Z=1 (Equal / Zero)
    NE: 0b010, // Z=0 (Not Equal / Not Zero)
    CS: 0b011, // C=1 (Carry Set / Unsigned >=)
    CC: 0b100, // C=0 (Carry Clear / Unsigned <)
    MI: 0b101, // N=1 (Minus / Negative)
    PL: 0b110, // N=0 (Plus / Positive)
    VS: 0b111, // V=1 (Overflow Set)
};
const PREDICATE_REV = Object.fromEntries(Object.entries(PREDICATE).map(([k, v]) => [v, k])); // For logging


// Opcodes (MUST MATCH assembler.js)
// Values are the 4-bit Opcode (Bits 15:12) + higher bits if needed by ISA (not needed here as type is determined first)
const OPCODE_MEM = {
    LDA: 0b0000, STA: 0b0001, ADD: 0b0010, SUB: 0b0011,
    AND: 0b0100, OR:  0b0101, XOR: 0b0110, JMP: 0b0111,
};
const OPCODE_REG = {
    // Opcodes from Reg Ref Table (Bits 15:12 seem to determine type, these are lower bits)
    // Let's stick to the full 4-bit opcode field for simplicity in matching
    MOV:  0b1100, ADD:  0b1101, SUB:  0b1110, CMP:  0b1111,
    AND:  0b0000, OR:   0b0001, LSHL: 0b0010, LSHR: 0b0011, // These overlap with MEM opcodes - decode logic MUST handle this
};
const OPCODE_IO = {
    // Opcodes from I/O Table
    IN:    0b1000, OUT:   0b1001, INOUT: 0b1010, OUTIN: 0b1011,
    WAIT:  0b1100, HALT:  0b1101, // These overlap with REG opcodes - decode logic MUST handle this
};

// Reverse maps for logging (Handle overlaps carefully)
const MNEMONIC_MEM = Object.fromEntries(Object.entries(OPCODE_MEM).map(([k, v]) => [v, k]));
const MNEMONIC_REG = Object.fromEntries(Object.entries(OPCODE_REG).map(([k, v]) => [v, k]));
const MNEMONIC_IO = Object.fromEntries(Object.entries(OPCODE_IO).map(([k, v]) => [v, k]));

// --- Helper: calculateFlags ---
// ... (rest of calculateFlags remains the same)
function calculateFlags(result, operandA, operandB, operation = 'LOGIC') {
    const maskedResult = result & MAX_WORD_VALUE;
    const Z = maskedResult === 0 ? 1 : 0;
    const N = (maskedResult & SIGN_BIT_MASK) ? 1 : 0;
    let C = 0;
    let V = 0;

    if (operation === 'ADD') {
        C = result > MAX_WORD_VALUE ? 1 : 0;
        // Check for overflow: sign of inputs different from sign of result
        V = (((operandA ^ operandB) & SIGN_BIT_MASK) === 0 && ((operandA ^ maskedResult) & SIGN_BIT_MASK) !== 0) ? 1 : 0;
    } else if (operation === 'SUB') {
        // Carry Flag for SUB: Indicates NO borrow occurred (A >= B unsigned)
        C = operandA >= operandB ? 1 : 0;
        // Check for overflow: sign of operands are different, and sign of result matches operandB
        V = (((operandA ^ operandB) & SIGN_BIT_MASK) !== 0 && ((operandB ^ maskedResult) & SIGN_BIT_MASK) === 0) ? 1 : 0;
        // Alternative check: Sign(A) != Sign(B) and Sign(Res) != Sign(A)
        // V = (((operandA ^ operandB) & SIGN_BIT_MASK) !== 0 && ((operandA ^ maskedResult) & SIGN_BIT_MASK) !== 0) ? 1 : 0; // Old version
    } else if (operation === 'SHIFT') {
       C = arguments[4] || 0; // Carry bit shifted out (passed as 5th arg)
       // Shift operations typically don't affect V in simple models, N/Z based on result
    }
    // Note: CMP is like SUB but only sets flags. Logic flags only set Z, N usually.
    return { Z, N, C, V };
}


// --- Core Cycle Functions ---

export function fetch(memory, pc) {
    if (pc < 0 || pc >= MEMORY_SIZE) {
        throw new Error(`PC out of bounds during fetch: ${pc}`);
    }
    // Ensure memory read is safe even if array is sparse/undefined
    const word = memory[pc];
    if (typeof word !== 'number') {
        console.warn(`Memory read at PC=${pc} yielded non-numeric value: ${word}. Returning 0.`);
        return 0;
    }
    return word & MAX_WORD_VALUE; // Ensure it's treated as a 16-bit word
}

// --- UPDATED DECODE TO BETTER HANDLE OPCODES ---
export function decode(instructionWord) {
    const opcodeField = (instructionWord >> 12) & 0xF; // Bits 15:12
    const predicateCode = (instructionWord >> 9) & 0x7; // Bits 11:9
    const operandBits = instructionWord & ADDR_MASK; // Bits 8:0

    let type = 'UNKNOWN';
    let mnemonic = 'UNK';
    let effectiveOperand = operandBits;
    let specificOpcode = opcodeField; // Use the 4-bit field initially

    // Determine TYPE based on the 4-bit opcode field range, then refine mnemonic
    if (opcodeField >= 0b0000 && opcodeField <= 0b0111) { // Potential MEM or REG (AND, OR)
        if (opcodeField === OPCODE_REG.AND && MNEMONIC_REG[opcodeField] === 'AND') {
             // Ambiguous: Could be LDA (0000) or REG AND (0000)
             // Need a way to differentiate - ASSUME MEMORY for LDA/STA for now
             // Assume REG otherwise? This ISA design is ambiguous.
             // Let's prioritize MEM if the mnemonic exists there.
             if (MNEMONIC_MEM[opcodeField]) {
                 type = 'MEMORY';
                 mnemonic = MNEMONIC_MEM[opcodeField];
                 console.warn(`Decode: Opcode ${opcodeField.toString(2)} could be MEM ${mnemonic} or REG AND. Assuming MEM.`);
             } else {
                 // This case shouldn't happen if AND/OR are 0000/0001 and LDA/STA are too
                 type = 'REGISTER'; // Fallback?
                 mnemonic = MNEMONIC_REG[opcodeField]; // Will be AND or OR
                 console.warn(`Decode: Opcode ${opcodeField.toString(2)} interpreted as REG ${mnemonic}.`);
             }
        } else if (opcodeField === OPCODE_REG.OR && MNEMONIC_REG[opcodeField] === 'OR') {
              if (MNEMONIC_MEM[opcodeField]) {
                 type = 'MEMORY';
                 mnemonic = MNEMONIC_MEM[opcodeField]; // STA
                 console.warn(`Decode: Opcode ${opcodeField.toString(2)} could be MEM ${mnemonic} or REG OR. Assuming MEM.`);
             } else {
                 type = 'REGISTER';
                 mnemonic = MNEMONIC_REG[opcodeField]; // OR
                 console.warn(`Decode: Opcode ${opcodeField.toString(2)} interpreted as REG ${mnemonic}.`);
             }
        } else if (opcodeField === OPCODE_REG.LSHL || opcodeField === OPCODE_REG.LSHR) {
            // LSHL (0010) / LSHR (0011) overlaps with MEM ADD/SUB
            // This is problematic. How does the CPU know?
            // **ASSUMPTION**: The Assembler *forces* operand to 0 for REG ops.
            // If operand is non-zero, it MUST be MEM. If operand is zero, AMBIGUOUS.
            // Let's stick to the primary opcode table interpretation for now and fix if needed.
            if (MNEMONIC_MEM[opcodeField]) {
                 type = 'MEMORY';
                 mnemonic = MNEMONIC_MEM[opcodeField];
                 console.warn(`Decode: Opcode ${opcodeField.toString(2)} could be MEM ${mnemonic} or REG SHIFT. Assuming MEM.`);
            } else {
                 // Should not happen
                 type = 'REGISTER';
                 mnemonic = MNEMONIC_REG[opcodeField];
            }
        }
         else { // Remaining MEM codes (0100-0111)
            type = 'MEMORY';
            mnemonic = MNEMONIC_MEM[opcodeField];
            if (!mnemonic) { type='UNKNOWN'; mnemonic=`UNK_MEM_${opcodeField}`; }
        }
    } else if (opcodeField >= 0b1000 && opcodeField <= 0b1011) { // IO Range
        type = 'IO';
        mnemonic = MNEMONIC_IO[opcodeField];
        if (!mnemonic) { type='UNKNOWN'; mnemonic=`UNK_IO_${opcodeField}`; }
    } else if (opcodeField >= 0b1100 && opcodeField <= 0b1111) { // Potential REG or IO (WAIT, HALT)
        if (opcodeField === OPCODE_IO.WAIT && MNEMONIC_IO[opcodeField] === 'WAIT') {
            // Ambiguous: REG MOV (1100) or IO WAIT (1100)
            // **ASSUMPTION**: Assembler forces operand=0 for WAIT.
            // If operand != 0, assume MOV? If operand == 0, assume WAIT? Risky.
            // Let's prioritize REG MOV unless operand suggests otherwise (requires Execute check?)
            if (MNEMONIC_REG[opcodeField]) {
                 type = 'REGISTER';
                 mnemonic = MNEMONIC_REG[opcodeField]; // MOV
                 console.warn(`Decode: Opcode ${opcodeField.toString(2)} could be REG ${mnemonic} or IO WAIT. Assuming REG.`);
            } else {
                 type = 'IO';
                 mnemonic = MNEMONIC_IO[opcodeField]; // WAIT
                 console.warn(`Decode: Opcode ${opcodeField.toString(2)} interpreted as IO ${mnemonic}.`);
            }
        } else if (opcodeField === OPCODE_IO.HALT && MNEMONIC_IO[opcodeField] === 'HALT') {
            // Ambiguous: REG ADD (1101) or IO HALT (1101)
            if (MNEMONIC_REG[opcodeField]) {
                 type = 'REGISTER';
                 mnemonic = MNEMONIC_REG[opcodeField]; // ADD
                 console.warn(`Decode: Opcode ${opcodeField.toString(2)} could be REG ${mnemonic} or IO HALT. Assuming REG.`);
            } else {
                 type = 'IO';
                 mnemonic = MNEMONIC_IO[opcodeField]; // HALT
                 console.warn(`Decode: Opcode ${opcodeField.toString(2)} interpreted as IO ${mnemonic}.`);
            }
        } else { // Remaining REG codes (1110 SUB, 1111 CMP)
            type = 'REGISTER';
            mnemonic = MNEMONIC_REG[opcodeField];
             if (!mnemonic) { type='UNKNOWN'; mnemonic=`UNK_REG_${opcodeField}`; }
        }
    } else {
        console.error(`Unknown Opcode Field: ${opcodeField.toString(2)}`);
        mnemonic = `OP_${opcodeField.toString(16)}`;
    }

    // Override type/mnemonic for specific zero-operand cases based on operand bits?
    // Example: If opcode is 1100 (MOV/WAIT) and operandBits is 0, maybe force to WAIT?
    // Example: If opcode is 1101 (ADD/HALT) and operandBits is 0, maybe force to HALT?
    // This feels like patching over an ambiguous ISA design.
    if (opcodeField === 0b1100 && operandBits === 0 && MNEMONIC_IO[opcodeField] === 'WAIT') {
        console.log("Decode Override: Opcode 1100 with operand 0 -> Assuming WAIT");
        type = 'IO';
        mnemonic = 'WAIT';
        specificOpcode = OPCODE_IO.WAIT;
    }
    if (opcodeField === 0b1101 && operandBits === 0 && MNEMONIC_IO[opcodeField] === 'HALT') {
        console.log("Decode Override: Opcode 1101 with operand 0 -> Assuming HALT");
        type = 'IO';
        mnemonic = 'HALT';
        specificOpcode = OPCODE_IO.HALT;
    }

    // If type is REGISTER, the actual opcode might need adjustment based on overlaps
    // e.g., REG AND is 0000, but that might have been interpreted as LDA initially.
    if(type === 'REGISTER') {
        specificOpcode = opcodeField; // Use the 4-bit field value for REGISTER ops directly
        mnemonic = MNEMONIC_REG[specificOpcode] || `UNK_REG_${specificOpcode}`;
    }
    // Similar check if type ended up as MEMORY but should have been REG
    // This decoding is complex due to ISA overlaps. A cleaner ISA would avoid this.


    return {
        type,           // 'MEMORY', 'REGISTER', 'IO', 'UNKNOWN'
        opcode: specificOpcode, // The specific opcode value relevant to the type
        predicate: predicateCode,      // Raw 3-bit predicate
        operand: effectiveOperand, // Address, Port, or Ignored Reg bits
        mnemonic,       // Determined mnemonic string
        originalWord: instructionWord,
        predicateStr: PREDICATE_REV[predicateCode] || '???' // Add predicate string for logging
    };
}


// --- Execute Function (Minor logging change, V flag fix) ---
export function execute(decoded, currentState) {
    const { registers, flags, memory } = currentState;
    const { type, predicate, opcode, operand, mnemonic, predicateStr } = decoded; // operand = bits 8:0

    // 1. Check Predicate
    let shouldExecute = false;
    switch (predicate) {
        case PREDICATE.AL: shouldExecute = true; break;
        case PREDICATE.EQ: shouldExecute = flags.Z === 1; break;
        case PREDICATE.NE: shouldExecute = flags.Z === 0; break;
        case PREDICATE.CS: shouldExecute = flags.C === 1; break;
        case PREDICATE.CC: shouldExecute = flags.C === 0; break;
        case PREDICATE.MI: shouldExecute = flags.N === 1; break;
        case PREDICATE.PL: shouldExecute = flags.N === 0; break;
        case PREDICATE.VS: shouldExecute = flags.V === 1; break;
        default: // Should not happen with 3 bits
            console.warn(`Unknown predicate code: ${predicate}`);
            shouldExecute = false;
    }

    // Prepare updates
    let nextRegisters = { ...registers };
    let nextFlags = { ...flags }; // Keep old flags if instruction doesn't change them
    let nextMemory = memory; // Assume memory doesn't change unless written to
    let nextPC = (registers.pc + 1) & ADDR_MASK; // Default: increment PC
    let logMessage = `${mnemonic}${predicateStr !== 'AL' ? `(${predicateStr})` : ''} `; // More concise log
    let haltExecution = false;

    if (!shouldExecute) {
        logMessage += `Skipped (Predicate Fail)`;
        // Return immediately if skipped - PC already incremented conceptually
        // Important: Keep existing register/flag/memory state
        return { registers: nextRegisters, flags: nextFlags, memory: nextMemory, pc: nextPC, log: logMessage, halt: haltExecution };
    }

    // 2. Execute based on Type and Specific Opcode
    let tempVal = 0;
    let result = 0;
    let sourceVal = 0; // Used for R2 simulation

    try {
        switch (type) {
            case 'MEMORY':
                const memAddress = operand; // Use bits 8:0 as direct address
                logMessage += `Addr:0x${memAddress.toString(16).padStart(3,'0')} `; // Pad address

                // Read from memory needed for most ops except STA, JMP
                if (opcode !== OPCODE_MEM.STA && opcode !== OPCODE_MEM.JMP) {
                    if (memAddress < 0 || memAddress >= MEMORY_SIZE) throw new Error(`Memory read OOB: Addr ${memAddress}`);
                    tempVal = memory[memAddress] ?? 0; // Read safely, default to 0 if undefined
                }

                switch (opcode) {
                    case OPCODE_MEM.LDA:
                        nextRegisters.acc = tempVal;
                        nextFlags = calculateFlags(tempVal, 0, 0, 'LOGIC'); // LDA affects N, Z flags
                        logMessage += `ACC<-M[${memAddress.toString(16).padStart(3,'0')}] (0x${tempVal.toString(16).padStart(4,'0')})`;
                        break;
                    case OPCODE_MEM.STA:
                        if (memAddress < 0 || memAddress >= MEMORY_SIZE) throw new Error(`Memory write OOB: Addr ${memAddress}`);
                        nextMemory = [...memory]; // Copy on write
                        nextMemory[memAddress] = registers.acc;
                        logMessage += `M[${memAddress.toString(16).padStart(3,'0')}]<-ACC (0x${registers.acc.toString(16).padStart(4,'0')})`;
                        break;
                    case OPCODE_MEM.ADD:
                        result = registers.acc + tempVal;
                        nextFlags = calculateFlags(result, registers.acc, tempVal, 'ADD');
                        nextRegisters.acc = result & MAX_WORD_VALUE;
                        logMessage += `ACC<-ACC+M[${memAddress.toString(16).padStart(3,'0')}] = 0x${nextRegisters.acc.toString(16).padStart(4,'0')}`;
                        break;
                    case OPCODE_MEM.SUB:
                        result = registers.acc - tempVal;
                        nextFlags = calculateFlags(result, registers.acc, tempVal, 'SUB');
                        nextRegisters.acc = result & MAX_WORD_VALUE;
                        logMessage += `ACC<-ACC-M[${memAddress.toString(16).padStart(3,'0')}] = 0x${nextRegisters.acc.toString(16).padStart(4,'0')}`;
                        break;
                    case OPCODE_MEM.AND: // AND with Memory
                        result = registers.acc & tempVal;
                        nextFlags = calculateFlags(result, 0, 0, 'LOGIC');
                        nextRegisters.acc = result;
                        logMessage += `ACC<-ACC&M[${memAddress.toString(16).padStart(3,'0')}] = 0x${result.toString(16).padStart(4,'0')}`;
                        break;
                    case OPCODE_MEM.OR: // OR with Memory
                        result = registers.acc | tempVal;
                        nextFlags = calculateFlags(result, 0, 0, 'LOGIC');
                        nextRegisters.acc = result;
                        logMessage += `ACC<-ACC|M[${memAddress.toString(16).padStart(3,'0')}] = 0x${result.toString(16).padStart(4,'0')}`;
                        break;
                    case OPCODE_MEM.XOR:
                        result = registers.acc ^ tempVal;
                        nextFlags = calculateFlags(result, 0, 0, 'LOGIC');
                        nextRegisters.acc = result;
                        logMessage += `ACC<-ACC^M[${memAddress.toString(16).padStart(3,'0')}] = 0x${result.toString(16).padStart(4,'0')}`;
                        break;
                    case OPCODE_MEM.JMP:
                        if (memAddress < 0 || memAddress >= MEMORY_SIZE) throw new Error(`JMP destination OOB: Addr ${memAddress}`);
                        nextPC = memAddress; // PC <- Address Field
                        logMessage += `PC<-${memAddress.toString(16).padStart(3,'0')}`;
                        break;
                    default: throw new Error(`Invalid MEM Opcode in Execute: ${opcode}`);
                }
                break; // End MEMORY type

            case 'REGISTER':
                // Simulate R1=ACC, R2=DR, using TR internally based on micro-ops
                logMessage += `(R1=ACC, R2=DR) `;
                // For operations needing R2, it's usually loaded into TR first in microcode.
                // Let's simulate that where needed. DR is the source register (R2).
                sourceVal = registers.dr; // The value from DR is the second operand

                switch (opcode) {
                    // These map to the *Register* opcodes (e.g., 1100 for MOV)
                    case OPCODE_REG.MOV: // ACC <- DR
                        nextRegisters.acc = sourceVal;
                        nextFlags = calculateFlags(nextRegisters.acc, 0, 0, 'LOGIC'); // MOV affects N, Z
                        logMessage += `ACC<-DR (0x${sourceVal.toString(16).padStart(4,'0')})`;
                        break;
                    case OPCODE_REG.ADD: // ACC <- ACC + DR
                        result = registers.acc + sourceVal;
                        nextFlags = calculateFlags(result, registers.acc, sourceVal, 'ADD');
                        nextRegisters.acc = result & MAX_WORD_VALUE;
                        logMessage += `ACC<-ACC+DR = 0x${nextRegisters.acc.toString(16).padStart(4,'0')}`;
                        break;
                    case OPCODE_REG.SUB: // ACC <- ACC - DR
                        result = registers.acc - sourceVal;
                        nextFlags = calculateFlags(result, registers.acc, sourceVal, 'SUB');
                        nextRegisters.acc = result & MAX_WORD_VALUE;
                        logMessage += `ACC<-ACC-DR = 0x${nextRegisters.acc.toString(16).padStart(4,'0')}`;
                        break;
                    case OPCODE_REG.CMP: // Flags <- ACC - DR
                        result = registers.acc - sourceVal;
                        nextFlags = calculateFlags(result, registers.acc, sourceVal, 'SUB');
                        // ACC not updated
                        logMessage += `Flags<-ACC-DR`;
                        break;
                    case OPCODE_REG.AND: // ACC <- ACC & DR
                        result = registers.acc & sourceVal;
                        nextFlags = calculateFlags(result, 0, 0, 'LOGIC');
                        nextRegisters.acc = result;
                        logMessage += `ACC<-ACC&DR = 0x${result.toString(16).padStart(4,'0')}`;
                        break;
                    case OPCODE_REG.OR: // ACC <- ACC | DR
                        result = registers.acc | sourceVal;
                        nextFlags = calculateFlags(result, 0, 0, 'LOGIC');
                        nextRegisters.acc = result;
                        logMessage += `ACC<-ACC|DR = 0x${result.toString(16).padStart(4,'0')}`;
                        break;
                    case OPCODE_REG.LSHL: // ACC <- ACC << 1
                        tempVal = registers.acc;
                        result = (tempVal << 1);
                        let carryOutL = (tempVal & SIGN_BIT_MASK) ? 1 : 0; // MSB shifted out is carry
                        nextRegisters.acc = result & MAX_WORD_VALUE;
                        nextFlags = calculateFlags(nextRegisters.acc, 0, 0, 'SHIFT', carryOutL); // Pass C explicitly
                        logMessage += `ACC<-ACC<<1 = 0x${nextRegisters.acc.toString(16).padStart(4,'0')}, C=${carryOutL}`;
                        break;
                    case OPCODE_REG.LSHR: // ACC <- ACC >>> 1 (Logical Right Shift)
                        tempVal = registers.acc;
                        result = (tempVal >>> 1); // Use zero-fill right shift
                        let carryOutR = (tempVal & 1) ? 1 : 0; // LSB shifted out is carry
                        nextRegisters.acc = result; // Already masked by >>>
                        nextFlags = calculateFlags(nextRegisters.acc, 0, 0, 'SHIFT', carryOutR); // Pass C explicitly
                        nextFlags.N = 0; // Logical shift clears N flag
                        logMessage += `ACC<-ACC>>>1 = 0x${nextRegisters.acc.toString(16).padStart(4,'0')}, C=${carryOutR}`;
                        break;
                    default: throw new Error(`Invalid REG Opcode in Execute: ${opcode}`);
                }
                break; // End REGISTER type

            case 'IO':
                const portAddress = operand; // Use bits 8:0 as port address
                logMessage += `Port:0x${portAddress.toString(16).padStart(3,'0')} `; // Pad port

                // Check port range if necessary (0-511 same as address)
                if (portAddress < 0 || portAddress > ADDR_MASK) throw new Error(`I/O Port OOB: ${portAddress}`);

                switch (opcode) {
                    case OPCODE_IO.IN: // ACC <- I/O[Port]
                        // Simulate input - replace with actual I/O handler if needed
                        tempVal = Math.floor(Math.random() * (MAX_WORD_VALUE + 1)); // Random input
                        console.log(`SIMULATED I/O IN Port ${portAddress}: Read 0x${tempVal.toString(16).padStart(4,'0')}`);
                        nextRegisters.acc = tempVal;
                        nextFlags = calculateFlags(nextRegisters.acc, 0, 0, 'LOGIC'); // IN affects N, Z
                        logMessage += `ACC<-I/O[${portAddress.toString(16).padStart(3,'0')}] (Sim 0x${tempVal.toString(16).padStart(4,'0')})`;
                        break;
                    case OPCODE_IO.OUT: // I/O[Port] <- ACC
                        console.log(`SIMULATED I/O OUT Port ${portAddress}: Write 0x${registers.acc.toString(16).padStart(4,'0')}`);
                        logMessage += `I/O[${portAddress.toString(16).padStart(3,'0')}]<-ACC (0x${registers.acc.toString(16).padStart(4,'0')})`;
                        break;
                    case OPCODE_IO.INOUT: // Input then Output (Simulated) ACC <- IO; IO <- ACC
                        tempVal = Math.floor(Math.random() * (MAX_WORD_VALUE + 1)); // Simulate Input
                         console.log(`SIMULATED I/O IN Port ${portAddress}: Read 0x${tempVal.toString(16).padStart(4,'0')}`);
                        nextRegisters.acc = tempVal; // ACC updated first
                        nextFlags = calculateFlags(nextRegisters.acc, 0, 0, 'LOGIC'); // IN affects N, Z
                        console.log(`SIMULATED I/O OUT Port ${portAddress}: Write 0x${nextRegisters.acc.toString(16).padStart(4,'0')} (after IN)`);
                        logMessage += `IN->ACC(0x${tempVal.toString(16).padStart(4,'0')}); OUT from ACC`;
                        break;
                    case OPCODE_IO.OUTIN: // Output then Input (Simulated) IO <- ACC; ACC <- IO
                        console.log(`SIMULATED I/O OUT Port ${portAddress}: Write 0x${registers.acc.toString(16).padStart(4,'0')} (before IN)`);
                        tempVal = Math.floor(Math.random() * (MAX_WORD_VALUE + 1)); // Simulate Input
                        console.log(`SIMULATED I/O IN Port ${portAddress}: Read 0x${tempVal.toString(16).padStart(4,'0')}`);
                        nextRegisters.acc = tempVal; // ACC updated after output
                        nextFlags = calculateFlags(nextRegisters.acc, 0, 0, 'LOGIC'); // IN affects N, Z
                        logMessage += `OUT from ACC; IN->ACC(0x${tempVal.toString(16).padStart(4,'0')})`;
                        break;
                    case OPCODE_IO.WAIT: // Wait for I/O (No-op in simulation for now)
                        logMessage += `WAIT (No-op)`;
                        // Could potentially halt/yield in a more complex simulation
                        break;
                    case OPCODE_IO.HALT: // Halt processor
                        haltExecution = true;
                        nextPC = registers.pc; // PC does not advance on HALT
                        logMessage += `HALT`;
                        break;
                    default: throw new Error(`Invalid IO Opcode in Execute: ${opcode}`);
                }
                break; // End IO type

            default: // UNKNOWN Type from decode
                 logMessage += `-> ERROR: Unknown instruction type '${type}' from Decode`;
                 haltExecution = true; // Stop on unknown types
                 nextPC = registers.pc; // Keep PC at faulting instruction
        } // End switch(type)

    } catch (error) {
        console.error("Execution Error:", error);
        // Use PC *before* execution for error location
        const errorLocation = registers.pc.toString(16).padStart(3, '0');
        logMessage = `EXEC ERROR @ ${errorLocation}: ${error.message}`;
        haltExecution = true; // Stop on error
        nextPC = registers.pc; // Keep PC where error occurred
        // Reset potentially partially modified state? Or keep for debugging?
        // Let's keep potentially modified regs/flags for inspection, but stop execution.
        nextRegisters = registers; // Revert to pre-execution registers? Maybe too destructive.
        nextFlags = flags;         // Keep flags from before error
    }

    // Update PC in the final returned state
    nextRegisters.pc = nextPC;

    // Consolidate state updates
    const finalState = {
         registers: nextRegisters,
         flags: nextFlags,
         memory: nextMemory,
         pc: nextPC, // Redundant with registers.pc but kept for compatibility if needed
         log: logMessage.trim(), // Trim trailing space
         halt: haltExecution
    };

     // Add flag changes to log if they occurred
     const flagChanges = ['Z', 'N', 'C', 'V']
        .filter(f => flags[f] !== nextFlags[f])
        .map(f => `${f}:${nextFlags[f]}`)
        .join(',');
     if (flagChanges) {
         finalState.log += ` {Flags: ${flagChanges}}`;
     }


    return finalState;
}


// --- Need to define initialCpuState within CpuContext.jsx using MEMORY_SIZE ---
// Make sure initialCpuState in CpuContext.jsx has:
/*
const initialCpuState = {
  registers: {
    pc: 0,      // Program Counter (9 bits)
    ar: 0,      // Address Register (9 bits) - Used internally?
    acc: 0,     // Accumulator (16 bits)
    dr: 0,      // Data Register (16 bits) - Often operand source/dest
    tr: 0,      // Temp Register (16 bits) - Internal ALU use
    pr: 0,      // Port Register (9 bits?) - Or just use operand bits? Assume unused for now.
    // Add any other registers defined by the microarchitecture if needed
  },
  flags: {
    Z: 0, // Zero flag
    C: 0, // Carry flag
    N: 0, // Negative/Sign flag
    V: 0, // Overflow flag
    // Add I (Interrupt Enable?) if needed
  },
  memory: new Array(MEMORY_SIZE).fill(0), // Use constant
  isRunning: false,
  outputLog: ["CPU Initialized and Ready."], // Initial message
};
*/