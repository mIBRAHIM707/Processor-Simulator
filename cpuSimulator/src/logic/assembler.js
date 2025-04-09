// src/logic/assembler.js

// --- Define constants STRICTLY matching cpuCore.js ---
// It's better to import these if possible, but defining ensures consistency if not.
const MEMORY_SIZE = 512;
const ADDR_MASK = 0x1FF; // 9 bits
const MAX_WORD_VALUE = 0xFFFF; // 16 bits

// Predicates (Must match cpuCore.js exactly)
const PREDICATE = {
    AL: 0b000, // Always
    EQ: 0b001, // Z=1 (Equal / Zero)
    NE: 0b010, // Z=0 (Not Equal / Not Zero)
    CS: 0b011, // C=1 (Carry Set / Unsigned >=)
    CC: 0b100, // C=0 (Carry Clear / Unsigned <)
    MI: 0b101, // N=1 (Minus / Negative)
    PL: 0b110, // N=0 (Plus / Positive)
    VS: 0b111, // V=1 (Overflow Set)
};

// Opcodes (Must match cpuCore.js exactly)
const OPCODE_MEM = {
    LDA: 0b0000, STA: 0b0001, ADD: 0b0010, SUB: 0b0011,
    AND: 0b0100, OR:  0b0101, XOR: 0b0110, JMP: 0b0111,
};
const OPCODE_REG = {
    MOV:  0b1100, ADD:  0b1101, SUB:  0b1110, CMP:  0b1111,
    AND:  0b0000, OR:   0b0001, LSHL: 0b0010, LSHR: 0b0011,
};
const OPCODE_IO = {
    IN:    0b1000, OUT:   0b1001, INOUT: 0b1010, OUTIN: 0b1011,
    WAIT:  0b1100, HALT:  0b1101,
};
// --- End Constant Definitions ---


// Basic error class
class AssemblyError extends Error {
    constructor(message, lineNumber = null) {
        super(lineNumber ? `${message} (Line ${lineNumber})` : message);
        this.name = "AssemblyError";
        this.lineNumber = lineNumber;
    }
}

/**
 * Assembles assembly code based on the ISA document.
 * Returns a Map where keys are addresses and values are the words to store.
 */
export function assemble(codeString) {
    const lines = codeString.split('\n');
    // STEP 1 CHANGE: Output is now a Map, not an array
    const memoryMap = new Map();
    let currentLineNumber = 0;
    // STEP 1 ADDITION: Track current assembly address
    let currentAddress = 0;

    for (const line of lines) {
        currentLineNumber++;
        let trimmedLine = line.trim();

        // Comments and empty lines
        const commentIndex = trimmedLine.indexOf(';');
        if (commentIndex !== -1) trimmedLine = trimmedLine.substring(0, commentIndex).trim();
        if (!trimmedLine) continue;

        // --- Placeholder for future directive parsing (Step 2) ---
        // In Step 1, we assume every non-comment/non-empty line is an instruction


        // --- Enhanced Parsing Logic ---
        let instructionWord = null;
        let parsed = false;

        // 1. Try Format: (PRED) MNEMONIC OPERAND (numeric)
        // Covers: MEM instructions, IO instructions with Port operand
        let match = trimmedLine.match(/^(?:\(([^)]+)\)\s+)?([A-Z]{2,5})\s+(0x[0-9A-Fa-f]+|[0-9]+)$/i);
        if (match) {
            const predicateStr = match[1]?.toUpperCase() || 'AL';
            const mnemonic = match[2].toUpperCase();
            const operandStr = match[3];
            let operandValue = 0;

            if (operandStr.startsWith('0x')) operandValue = parseInt(operandStr.substring(2), 16);
            else operandValue = parseInt(operandStr, 10);

            if (isNaN(operandValue) || operandValue < 0 || operandValue > ADDR_MASK) { // Use ADDR_MASK
                 throw new AssemblyError(`Operand [${operandStr}] out of 9-bit range (0-${ADDR_MASK})`, currentLineNumber);
            }
            const predicateCode = PREDICATE[predicateStr];
            if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumber);

            // Determine if MEM or IO based on mnemonic
            let opcode = OPCODE_MEM[mnemonic] ?? OPCODE_IO[mnemonic]; // Check MEM first, then IO

            if (opcode === undefined) {
                 // Removed the faulty check here. Now correctly checks only if mnemonic isn't MEM/IO.
                 if (OPCODE_REG[mnemonic] !== undefined) {
                      // This case means a REG instruction was used with a numeric operand where it's not allowed.
                       throw new AssemblyError(`Register instruction '${mnemonic}' cannot take a direct numeric/address operand in this format`, currentLineNumber);
                 } else {
                      // Truly unknown mnemonic for this format
                      throw new AssemblyError(`Unknown mnemonic or mnemonic '${mnemonic}' does not take a numeric/address operand`, currentLineNumber);
                 }
            }

            // Verify it's not a zero-operand IO op used incorrectly with an operand
            if ((mnemonic === 'HALT' || mnemonic === 'WAIT') && OPCODE_IO[mnemonic] !== undefined) {
                 throw new AssemblyError(`${mnemonic} instruction does not take an operand`, currentLineNumber);
            }

            instructionWord = (opcode << 12) | (predicateCode << 9) | operandValue;
            parsed = true;
        }

        // 2. Try Format: (PRED) MNEMONIC (Zero operand IO: HALT, WAIT)
        if (!parsed) {
            match = trimmedLine.match(/^(?:\(([^)]+)\)\s+)?(HALT|WAIT)$/i);
             if (match) {
                 const predicateStr = match[1]?.toUpperCase() || 'AL';
                 const mnemonic = match[2].toUpperCase();
                 const predicateCode = PREDICATE[predicateStr];
                 const opcode = OPCODE_IO[mnemonic]; // Must be HALT or WAIT

                 if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumber);
                 if (opcode === undefined) throw new AssemblyError(`Internal Error: Mnemonic ${mnemonic} not found in IO Opcodes`, currentLineNumber);

                 // Check if it was accidentally defined in MEM or REG
                 if (OPCODE_MEM[mnemonic] !== undefined || OPCODE_REG[mnemonic] !== undefined) {
                     console.warn(`Assembler Warning: Mnemonic ${mnemonic} also exists in MEM/REG maps, but parsed as IO.`);
                 }

                 instructionWord = (opcode << 12) | (predicateCode << 9) | 0; // Operand is 0
                 parsed = true;
             }
        }

        // 3. Try Format: (PRED) MNEMONIC R1 (Conceptual: LSHL ACC, LSHR ACC)
        if (!parsed) {
             match = trimmedLine.match(/^(?:\(([^)]+)\)\s+)?(LSHL|LSHR)\s+(ACC)$/i);
             if (match) {
                 const predicateStr = match[1]?.toUpperCase() || 'AL';
                 const mnemonic = match[2].toUpperCase();
                 const regStr = match[3].toUpperCase(); // Should be ACC
                 const predicateCode = PREDICATE[predicateStr];
                 const opcode = OPCODE_REG[mnemonic]; // Must be LSHL or LSHR

                 if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumber);
                 if (opcode === undefined) throw new AssemblyError(`Internal Error: Mnemonic ${mnemonic} not found in REG Opcodes`, currentLineNumber);
                 if (regStr !== 'ACC') throw new AssemblyError(`Only 'ACC' is supported as operand for ${mnemonic}`, currentLineNumber);

                 instructionWord = (opcode << 12) | (predicateCode << 9) | 0;
                 parsed = true;
             }
        }

        // 4. Try Format: (PRED) MNEMONIC R1, R2 (Conceptual: MOV ACC, DR etc.)
        if (!parsed) {
             match = trimmedLine.match(/^(?:\(([^)]+)\)\s+)?(MOV|ADD|SUB|CMP|AND|OR)\s+(ACC)\s*,?\s*(DR)$/i);
             if (match) {
                 const predicateStr = match[1]?.toUpperCase() || 'AL';
                 const mnemonic = match[2].toUpperCase();
                 const r1Str = match[3].toUpperCase(); // Should be ACC
                 const r2Str = match[4].toUpperCase(); // Should be DR
                 const predicateCode = PREDICATE[predicateStr];
                 const opcode = OPCODE_REG[mnemonic]; // Must be MOV, ADD, SUB, CMP, AND, OR

                 if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumber);
                 if (opcode === undefined) throw new AssemblyError(`Internal Error: Mnemonic ${mnemonic} not found in REG Opcodes`, currentLineNumber);
                 if (r1Str !== 'ACC' || r2Str !== 'DR') throw new AssemblyError(`Only 'ACC, DR' are supported as operands for ${mnemonic}`, currentLineNumber);

                 instructionWord = (opcode << 12) | (predicateCode << 9) | 0;
                 parsed = true;
             }
        }

        // --- Final Check & Placement ---
        if (!parsed || instructionWord === null) {
            // If not parsed as instruction, maybe it's a directive (handle in Step 2)
            // For Step 1, assume it's an error if not empty/comment
             throw new AssemblyError(`Invalid or unparseable instruction format: "${trimmedLine}"`, currentLineNumber);
        } else {
             // STEP 1 CHANGE: Place instruction in Map at currentAddress
             if (currentAddress >= MEMORY_SIZE) {
                throw new AssemblyError(`Assembly address 0x${currentAddress.toString(16)} exceeds memory size (0x${(MEMORY_SIZE-1).toString(16)})`, currentLineNumber);
             }
             // Ensure the instruction word is within the valid range (optional sanity check)
             if(instructionWord < 0 || instructionWord > MAX_WORD_VALUE) {
                 console.warn(`Assembler Warning: Generated instruction word ${instructionWord} out of 16-bit range.`);
             }
             memoryMap.set(currentAddress, instructionWord & MAX_WORD_VALUE); // Ensure 16-bit

             // STEP 1 ADDITION: Increment address for next instruction
             currentAddress++;
        }
    } // End for loop over lines

    // STEP 1 CHANGE: Return the Map
    return memoryMap;
}