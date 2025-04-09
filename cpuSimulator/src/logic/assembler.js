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

// --- Helper Functions ---
function parseNumericValue(valueStr, context, currentLineNumber) {
    let value;
    if (valueStr.startsWith('0x')) {
        value = parseInt(valueStr.substring(2), 16);
    } else {
        value = parseInt(valueStr, 10);
    }
    if (isNaN(value)) {
        throw new AssemblyError(`Invalid numeric value for ${context}: ${valueStr}`, currentLineNumber);
    }
    return value;
}

// --- Regex Definitions ---
// Match label definitions (e.g., "LOOP:", "DATA_A:") case-sensitive? Let's make label case-sensitive.
const labelDefRegex = /^([a-zA-Z_][a-zA-Z0-9_]*):/;
// Match directives (case-insensitive for directive name)
const orgRegex = /^\.ORG\s+(0x[0-9A-Fa-f]+|[0-9]+)$/i;
const wordRegex = /^\.WORD\s+(0x[0-9A-Fa-f]+|[0-9]+)$/i;
// Match instructions that can take a label or number as operand
const memIoLabelNumRegex = /^(?:\(([^)]+)\)\s+)?(LDA|STA|ADD|SUB|AND|OR|XOR|JMP|IN|OUT|INOUT|OUTIN)\s+([a-zA-Z_][a-zA-Z0-9_]*|0x[0-9A-Fa-f]+|[0-9]+)$/i;
// Match zero-operand instructions
const zeroOpRegex = /^(?:\(([^)]+)\)\s+)?(HALT|WAIT)$/i;
// Match single-register instructions (ACC only)
const singleRegRegex = /^(?:\(([^)]+)\)\s+)?(LSHL|LSHR)\s+(ACC)$/i;
// Match two-register instructions (ACC, DR only)
const twoRegRegex = /^(?:\(([^)]+)\)\s+)?(MOV|ADD|SUB|CMP|AND|OR)\s+(ACC)\s*,?\s*(DR)$/i;


/**
 * Assembles assembly code using a two-pass approach with labels.
 * Handles .ORG and .WORD directives.
 * Returns a Map where keys are addresses and values are the words to store.
 */
export function assemble(codeString) {
    const lines = codeString.split('\n');
    const symbolTable = new Map(); // Stores { labelName: address }

    // --- Pass 1: Build Symbol Table ---
    let currentAddressPass1 = 0;
    let currentLineNumberPass1 = 0;
    // console.log("--- Starting Assembler Pass 1 ---");

    for (const line of lines) {
        currentLineNumberPass1++;
        let processedLine = line;
        let label = null;

        // Handle comments first
        const commentIndex = processedLine.indexOf(';');
        if (commentIndex !== -1) {
            processedLine = processedLine.substring(0, commentIndex);
        }
        processedLine = processedLine.trim();

        // Check for label definition
        const labelMatch = processedLine.match(labelDefRegex);
        if (labelMatch) {
            label = labelMatch[1]; // Extract label name
            processedLine = processedLine.substring(labelMatch[0].length).trim(); // Remove label def from line

            if (symbolTable.has(label)) {
                 throw new AssemblyError(`Label '${label}' redefined`, currentLineNumberPass1);
            }
            symbolTable.set(label, currentAddressPass1); // Store label and its address
            // console.log(`Pass 1: Found label '${label}' at 0x${currentAddressPass1.toString(16)}`);
        }

        // If line (after removing label/comment) is empty, skip
        if (!processedLine) {
            continue;
        }

        // Process directives or instructions to calculate size and advance address
        let orgMatch = processedLine.match(orgRegex);
        let wordMatch = processedLine.match(wordRegex);
        let memIoMatch = processedLine.match(memIoLabelNumRegex);
        let zeroOpMatch = processedLine.match(zeroOpRegex);
        let singleRegMatch = processedLine.match(singleRegRegex);
        let twoRegMatch = processedLine.match(twoRegRegex);

        if (orgMatch) {
            const addressStr = orgMatch[1];
            try {
                 const newAddress = parseNumericValue(addressStr, '.ORG', currentLineNumberPass1);
                if (newAddress < 0 || newAddress >= MEMORY_SIZE) {
                    throw new AssemblyError(`.ORG address out of range`, currentLineNumberPass1);
                }
                currentAddressPass1 = newAddress; // Update address for subsequent lines
                 // console.log(`Pass 1: .ORG set address to 0x${currentAddressPass1.toString(16)}`);
            } catch (error) {
                if (!(error instanceof AssemblyError)) throw new AssemblyError(error.message, currentLineNumberPass1);
                throw error;
            }
        } else if (wordMatch) {
             // .WORD takes up one memory location
             currentAddressPass1++;
             // console.log(`Pass 1: .WORD found, incrementing address to 0x${currentAddressPass1.toString(16)}`);
        } else if (memIoMatch || zeroOpMatch || singleRegMatch || twoRegMatch) {
             // All instructions take up one memory location in this ISA
             currentAddressPass1++;
             // console.log(`Pass 1: Instruction found, incrementing address to 0x${currentAddressPass1.toString(16)}`);
        } else {
            // If it wasn't a label, comment, empty, directive, or known instruction format
             throw new AssemblyError(`Unrecognised syntax or invalid instruction format: "${processedLine}"`, currentLineNumberPass1);
        }

        // Check address bounds after potential increment
        if (currentAddressPass1 > MEMORY_SIZE) { // Note: Check > not >= because address can be == MEMORY_SIZE after last word
            throw new AssemblyError(`Assembly address 0x${currentAddressPass1.toString(16)} exceeds memory size`, currentLineNumberPass1);
        }

    } // End Pass 1 Loop

    // console.log("--- Finished Pass 1, Symbol Table: ---", symbolTable);


    // --- Pass 2: Generate Machine Code ---
    const memoryMap = new Map();
    let currentAddressPass2 = 0;
    let currentLineNumberPass2 = 0;
    // console.log("--- Starting Assembler Pass 2 ---");

    for (const line of lines) {
         currentLineNumberPass2++;
         let processedLine = line;
         let instructionWord = null;
         let parsedThisLine = false; // Flag to track if line generated output/action

        // Handle comments
        const commentIndex = processedLine.indexOf(';');
        if (commentIndex !== -1) {
            processedLine = processedLine.substring(0, commentIndex);
        }
        processedLine = processedLine.trim();

         // Strip label definitions (don't process them again, just remove)
         const labelMatch = processedLine.match(labelDefRegex);
         if (labelMatch) {
             processedLine = processedLine.substring(labelMatch[0].length).trim();
         }

         // Skip empty lines
         if (!processedLine) {
             continue;
         }

        // Process Directives (.ORG, .WORD)
        let orgMatch = processedLine.match(orgRegex);
        let wordMatch = processedLine.match(wordRegex);

        if (orgMatch) {
            const addressStr = orgMatch[1];
             try {
                const newAddress = parseNumericValue(addressStr, '.ORG', currentLineNumberPass2);
                // Range already checked in Pass 1, but good practice:
                if (newAddress < 0 || newAddress >= MEMORY_SIZE) {
                   throw new Error(); // Should not happen if Pass 1 worked
                }
                currentAddressPass2 = newAddress;
                parsedThisLine = true;
                // console.log(`Pass 2: .ORG set address to 0x${currentAddressPass2.toString(16)}`);
            } catch { // Simplified error handling as it should be caught in Pass 1
                 throw new AssemblyError(`Internal Error processing .ORG`, currentLineNumberPass2);
            }
        } else if (wordMatch) {
            const valueStr = wordMatch[1];
            try {
                const value = parseNumericValue(valueStr, '.WORD', currentLineNumberPass2);
                if (value < 0 || value > MAX_WORD_VALUE) {
                     throw new AssemblyError(`.WORD value out of 16-bit range`, currentLineNumberPass2);
                }
                if (currentAddressPass2 >= MEMORY_SIZE) {
                    throw new AssemblyError(`Memory address out of bounds for .WORD`, currentLineNumberPass2);
                }
                memoryMap.set(currentAddressPass2, value);
                currentAddressPass2++;
                parsedThisLine = true;
                // console.log(`Pass 2: Placed .WORD ${value.toString(16)} at 0x${(currentAddressPass2-1).toString(16)}`);
            } catch (error) {
                 if (!(error instanceof AssemblyError)) throw new AssemblyError(error.message, currentLineNumberPass2);
                 throw error;
            }
        } else {
            // --- If not a directive, parse as Instruction ---
            let match; // Reuse match variable

            // 1. Try Mem/IO with Label or Number Operand
            match = processedLine.match(memIoLabelNumRegex);
            if (match) {
                const predicateStr = match[1]?.toUpperCase() || 'AL';
                const mnemonic = match[2].toUpperCase();
                const operandStr = match[3];
                let operandValue = 0;

                // Resolve operand: Check if it's a label or number
                if (symbolTable.has(operandStr)) {
                    operandValue = symbolTable.get(operandStr);
                    // console.log(`Pass 2: Resolved label '${operandStr}' to 0x${operandValue.toString(16)}`);
                } else {
                    try {
                         operandValue = parseNumericValue(operandStr, `Operand for ${mnemonic}`, currentLineNumberPass2);
                         // console.log(`Pass 2: Parsed numeric operand ${operandStr} to ${operandValue}`);
                    } catch (e) {
                         // If it's not in symbol table and not a valid number -> Undefined label
                         throw new AssemblyError(`Undefined label or invalid numeric operand: '${operandStr}'`, currentLineNumberPass2);
                    }
                }

                // Validate operand range (resolved address/port)
                if (operandValue < 0 || operandValue > ADDR_MASK) {
                     throw new AssemblyError(`Resolved operand value [0x${operandValue.toString(16)}] out of 9-bit range (0-${ADDR_MASK})`, currentLineNumberPass2);
                }
                const predicateCode = PREDICATE[predicateStr];
                if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumberPass2);

                let opcode = OPCODE_MEM[mnemonic] ?? OPCODE_IO[mnemonic];
                if (opcode === undefined) { // Should not happen if Pass 1 worked, but check anyway
                     throw new AssemblyError(`Internal error: Unknown mnemonic '${mnemonic}' in Pass 2`, currentLineNumberPass2);
                }
                 // No need to re-check for HALT/WAIT with operand here, format won't match

                instructionWord = (opcode << 12) | (predicateCode << 9) | operandValue;
                parsedThisLine = true;
            }

            // 2. Try Zero Operand Instructions
            if (!parsedThisLine) {
                match = processedLine.match(zeroOpRegex);
                if (match) {
                    const predicateStr = match[1]?.toUpperCase() || 'AL';
                    const mnemonic = match[2].toUpperCase();
                    const predicateCode = PREDICATE[predicateStr];
                    const opcode = OPCODE_IO[mnemonic];

                    if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumberPass2);
                    if (opcode === undefined) throw new AssemblyError(`Internal Error: Mnemonic ${mnemonic} not found`, currentLineNumberPass2);

                    instructionWord = (opcode << 12) | (predicateCode << 9) | 0;
                    parsedThisLine = true;
                }
            }

            // 3. Try Single Register Instructions
            if (!parsedThisLine) {
                 match = processedLine.match(singleRegRegex);
                 if (match) {
                     const predicateStr = match[1]?.toUpperCase() || 'AL';
                     const mnemonic = match[2].toUpperCase();
                     const predicateCode = PREDICATE[predicateStr];
                     const opcode = OPCODE_REG[mnemonic];

                     if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumberPass2);
                     if (opcode === undefined) throw new AssemblyError(`Internal Error: Mnemonic ${mnemonic} not found`, currentLineNumberPass2);

                     instructionWord = (opcode << 12) | (predicateCode << 9) | 0;
                     parsedThisLine = true;
                 }
            }

             // 4. Try Two Register Instructions
             if (!parsedThisLine) {
                 match = processedLine.match(twoRegRegex);
                 if (match) {
                     const predicateStr = match[1]?.toUpperCase() || 'AL';
                     const mnemonic = match[2].toUpperCase();
                     const predicateCode = PREDICATE[predicateStr];
                     const opcode = OPCODE_REG[mnemonic];

                     if (predicateCode === undefined) throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumberPass2);
                     if (opcode === undefined) throw new AssemblyError(`Internal Error: Mnemonic ${mnemonic} not found`, currentLineNumberPass2);
                     // ACC, DR already checked by regex

                     instructionWord = (opcode << 12) | (predicateCode << 9) | 0;
                     parsedThisLine = true;
                 }
             }

             // --- Place Instruction Word ---
             if(parsedThisLine && instructionWord !== null) {
                if (currentAddressPass2 >= MEMORY_SIZE) {
                    throw new AssemblyError(`Memory address out of bounds for instruction`, currentLineNumberPass2);
                }
                 memoryMap.set(currentAddressPass2, instructionWord & MAX_WORD_VALUE);
                 currentAddressPass2++;
                 // console.log(`Pass 2: Placed instruction ${instructionWord.toString(16)} at 0x${(currentAddressPass2-1).toString(16)}`);
             } else if (!parsedThisLine) {
                 // If it wasn't a directive and didn't match any instruction format
                 throw new AssemblyError(`Unrecognised syntax or invalid instruction format: "${processedLine}"`, currentLineNumberPass2);
             }
        } // End else (parse as instruction)
    } // End Pass 2 Loop

    // console.log("--- Finished Pass 2 ---");
    return memoryMap;
}