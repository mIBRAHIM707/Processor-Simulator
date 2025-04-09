// src/logic/assembler.js

// --- Constants (Ensure these match cpuCore.js) ---
const MEMORY_SIZE = 512;
const ADDR_MASK = 0x1FF; // 9 bits
const MAX_WORD_VALUE = 0xFFFF; // 16 bits

// Predicates (Must match cpuCore.js exactly)
const PREDICATE = {
    AL: 0b000, EQ: 0b001, NE: 0b010, CS: 0b011,
    CC: 0b100, MI: 0b101, PL: 0b110, VS: 0b111,
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
 * Helper to parse numeric values (hex or decimal)
 */
function parseNumericValue(valueStr, type, currentLineNumber) {
    let value;
    if (valueStr.startsWith('0x')) {
        value = parseInt(valueStr.substring(2), 16);
    } else {
        value = parseInt(valueStr, 10);
    }
    if (isNaN(value)) {
        throw new AssemblyError(`Invalid numeric value for ${type}: ${valueStr}`, currentLineNumber);
    }
    return value;
}


/**
 * Assembles assembly code, including .ORG and .WORD directives.
 * Returns a Map where keys are addresses and values are the words to store.
 */
export function assemble(codeString) {
    const lines = codeString.split('\n');
    const memoryMap = new Map();
    let currentLineNumber = 0;
    let currentAddress = 0; // Tracks assembly location

    // STEP 2: Regex for directives (case-insensitive for directive name)
    const orgRegex = /^\.ORG\s+(0x[0-9A-Fa-f]+|[0-9]+)$/i;
    const wordRegex = /^\.WORD\s+(0x[0-9A-Fa-f]+|[0-9]+)$/i;


    for (const line of lines) {
        currentLineNumber++;
        let trimmedLine = line.trim();

        // Comments and empty lines
        const commentIndex = trimmedLine.indexOf(';');
        if (commentIndex !== -1) trimmedLine = trimmedLine.substring(0, commentIndex).trim();
        if (!trimmedLine) continue;


        // --- STEP 2: Parse Directives First ---
        let directiveMatch = trimmedLine.match(orgRegex);
        if (directiveMatch) {
            const addressStr = directiveMatch[1];
            try {
                const newAddress = parseNumericValue(addressStr, '.ORG directive', currentLineNumber);
                if (newAddress < 0 || newAddress >= MEMORY_SIZE) {
                    throw new AssemblyError(`.ORG address ${addressStr} out of range (0-${MEMORY_SIZE - 1})`, currentLineNumber);
                }
                currentAddress = newAddress; // Update the current assembly address
                // console.log(`Assembler: Set current address to 0x${currentAddress.toString(16)}`);
                continue; // Go to next line, .ORG doesn't place data
            } catch (error) {
                 // Propagate parsing/validation errors
                 if (!(error instanceof AssemblyError)) { // Wrap generic errors
                    throw new AssemblyError(error.message, currentLineNumber);
                 }
                 throw error;
            }
        }

        directiveMatch = trimmedLine.match(wordRegex);
        if (directiveMatch) {
            const valueStr = directiveMatch[1];
             try {
                const value = parseNumericValue(valueStr, '.WORD directive', currentLineNumber);
                 if (value < 0 || value > MAX_WORD_VALUE) {
                     throw new AssemblyError(`.WORD value ${valueStr} out of 16-bit range (0-${MAX_WORD_VALUE})`, currentLineNumber);
                 }
                 // Check if current address is valid before placing
                 if (currentAddress < 0 || currentAddress >= MEMORY_SIZE) {
                      throw new AssemblyError(`Cannot place .WORD at address 0x${currentAddress.toString(16)} (out of memory range)`, currentLineNumber);
                 }

                 // Place the data word into the map
                 memoryMap.set(currentAddress, value);
                 // console.log(`Assembler: Placed .WORD ${value.toString(16)} at 0x${currentAddress.toString(16)}`);
                 currentAddress++; // Move to the next address
                 continue; // Go to next line
             } catch(error) {
                 if (!(error instanceof AssemblyError)) {
                    throw new AssemblyError(error.message, currentLineNumber);
                 }
                 throw error;
             }
        }

        // --- If not a directive, comment, or empty line, parse as instruction ---
        let instructionWord = null;
        let parsed = false;

        // 1. Try Format: (PRED) MNEMONIC OPERAND (numeric)
        let match = trimmedLine.match(/^(?:\(([^)]+)\)\s+)?([A-Z]{2,5})\s+(0x[0-9A-Fa-f]+|[0-9]+)$/i);
        if (match) {
            const predicateStr = match[1]?.toUpperCase() || 'AL';
            const mnemonic = match[2].toUpperCase();
            const operandStr = match[3];
            let operandValue = parseNumericValue(operandStr, `Operand for ${mnemonic}`, currentLineNumber); // Use helper

            if (operandValue < 0 || operandValue > ADDR_MASK) {
                 throw new AssemblyError(`Operand [${operandStr}] out of 9-bit range (0-${ADDR_MASK})`, currentLineNumber);
            }
            const predicateCode = PREDICATE[predicateStr];
            if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumber);

            let opcode = OPCODE_MEM[mnemonic] ?? OPCODE_IO[mnemonic];

            if (opcode === undefined) {
                 if (OPCODE_REG[mnemonic] !== undefined) {
                       throw new AssemblyError(`Register instruction '${mnemonic}' cannot take a direct numeric/address operand in this format`, currentLineNumber);
                 } else {
                      throw new AssemblyError(`Unknown mnemonic or mnemonic '${mnemonic}' does not take a numeric/address operand`, currentLineNumber);
                 }
            }
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
                 const opcode = OPCODE_IO[mnemonic];

                 if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumber);
                 if (opcode === undefined) throw new AssemblyError(`Internal Error: Mnemonic ${mnemonic} not found in IO Opcodes`, currentLineNumber);
                 if (OPCODE_MEM[mnemonic] !== undefined || OPCODE_REG[mnemonic] !== undefined) {
                     console.warn(`Assembler Warning: Mnemonic ${mnemonic} also exists in MEM/REG maps, but parsed as IO.`);
                 }

                 instructionWord = (opcode << 12) | (predicateCode << 9) | 0;
                 parsed = true;
             }
        }

        // 3. Try Format: (PRED) MNEMONIC R1 (LSHL ACC, LSHR ACC)
        if (!parsed) {
             match = trimmedLine.match(/^(?:\(([^)]+)\)\s+)?(LSHL|LSHR)\s+(ACC)$/i);
             if (match) {
                 const predicateStr = match[1]?.toUpperCase() || 'AL';
                 const mnemonic = match[2].toUpperCase();
                 const regStr = match[3].toUpperCase();
                 const predicateCode = PREDICATE[predicateStr];
                 const opcode = OPCODE_REG[mnemonic];

                 if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumber);
                 if (opcode === undefined) throw new AssemblyError(`Internal Error: Mnemonic ${mnemonic} not found in REG Opcodes`, currentLineNumber);
                 if (regStr !== 'ACC') throw new AssemblyError(`Only 'ACC' is supported as operand for ${mnemonic}`, currentLineNumber);

                 instructionWord = (opcode << 12) | (predicateCode << 9) | 0;
                 parsed = true;
             }
        }

        // 4. Try Format: (PRED) MNEMONIC R1, R2 (MOV ACC, DR etc.)
        if (!parsed) {
             match = trimmedLine.match(/^(?:\(([^)]+)\)\s+)?(MOV|ADD|SUB|CMP|AND|OR)\s+(ACC)\s*,?\s*(DR)$/i);
             if (match) {
                 const predicateStr = match[1]?.toUpperCase() || 'AL';
                 const mnemonic = match[2].toUpperCase();
                 const r1Str = match[3].toUpperCase();
                 const r2Str = match[4].toUpperCase();
                 const predicateCode = PREDICATE[predicateStr];
                 const opcode = OPCODE_REG[mnemonic];

                 if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumber);
                 if (opcode === undefined) throw new AssemblyError(`Internal Error: Mnemonic ${mnemonic} not found in REG Opcodes`, currentLineNumber);
                 if (r1Str !== 'ACC' || r2Str !== 'DR') throw new AssemblyError(`Only 'ACC, DR' are supported as operands for ${mnemonic}`, currentLineNumber);

                 instructionWord = (opcode << 12) | (predicateCode << 9) | 0;
                 parsed = true;
             }
        }

        // --- Final Check & Placement for Instructions ---
        if (!parsed || instructionWord === null) {
            // If it wasn't a directive, comment, empty, or valid instruction... it's an error
             throw new AssemblyError(`Invalid or unrecognised directive/instruction format: "${trimmedLine}"`, currentLineNumber);
        } else {
             // Place instruction in Map at currentAddress
             if (currentAddress < 0 || currentAddress >= MEMORY_SIZE) {
                throw new AssemblyError(`Assembly address 0x${currentAddress.toString(16)} exceeds memory size (0-${MEMORY_SIZE - 1})`, currentLineNumber);
             }
             if(instructionWord < 0 || instructionWord > MAX_WORD_VALUE) {
                 console.warn(`Assembler Warning: Generated instruction word ${instructionWord} out of 16-bit range.`);
             }
             memoryMap.set(currentAddress, instructionWord & MAX_WORD_VALUE);

             // Increment address for next instruction/data word
             currentAddress++;
        }
    } // End for loop over lines

    return memoryMap;
}