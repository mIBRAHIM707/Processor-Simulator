// src/logic/assembler.js

// --- Constants & Maps (MUST MATCH cpuCore.js and your ISA) ---
const PREDICATE = {
    AL: 0b000, EQ: 0b001, NE: 0b010, CS: 0b011,
    CC: 0b100, MI: 0b101, PL: 0b110, VS: 0b111,
};
const OPCODE_MEM = {
    LDA: 0b0000, STA: 0b0001, ADD: 0b0010, SUB: 0b0011,
    AND: 0b0100, OR:  0b0101, XOR: 0b0110, JMP: 0b0111,
};
// Add maps for Register Ref, IO opcodes as needed

// Basic error class
class AssemblyError extends Error {
    constructor(message, lineNumber) {
        super(`${message} (Line ${lineNumber})`);
        this.name = "AssemblyError";
        this.lineNumber = lineNumber;
    }
}

/**
 * Assembles simple assembly code into machine code.
 * VERY basic - needs significant enhancement for labels, directives, register operands etc.
 * @param {string} codeString The assembly code text
 * @returns {Array<number>} Array of 16-bit machine code words
 * @throws {AssemblyError} If syntax is invalid
 */
export function assemble(codeString) {
    const lines = codeString.split('\n');
    const machineCode = [];
    let currentLineNumber = 0;

    for (const line of lines) {
        currentLineNumber++;
        let trimmedLine = line.trim();

        // Ignore comments (starting with ;) and empty lines
        const commentIndex = trimmedLine.indexOf(';');
        if (commentIndex !== -1) {
            trimmedLine = trimmedLine.substring(0, commentIndex).trim();
        }
        if (!trimmedLine) {
            continue;
        }

        // Very basic parsing (Example: "(EQ) LDA 0x1F" or "ADD 100")
        const parts = trimmedLine.match(/^(?:\(([^)]+)\)\s+)?([A-Z]{2,5})\s+(?:0x([0-9A-Fa-f]+)|([0-9]+))$/);
        //                  Optional Predicate  ^      Mnemonic ^     Hex Operand ^   Decimal Operand ^

        if (!parts) {
            // Handle HALT or other zero-operand instructions? Needs specific check
            if (trimmedLine.toUpperCase() === 'HALT') { // Example HALT
               // Lookup HALT opcode and predicate (e.g., (PL) HALT)
               const haltOpcode = 0b1101; // Replace with actual HALT opcode
               const haltPred = PREDICATE.PL; // Replace with actual predicate
               machineCode.push((haltOpcode << 12) | (haltPred << 9) | 0); // Assuming 0 for address field
               continue;
            }
            throw new AssemblyError(`Invalid instruction format`, currentLineNumber);
        }

        const predicateStr = parts[1]?.toUpperCase() || 'AL'; // Default to Always
        const mnemonic = parts[2].toUpperCase();
        const operandHex = parts[3];
        const operandDec = parts[4];

        let operandValue = 0;
        if (operandHex !== undefined) {
            operandValue = parseInt(operandHex, 16);
        } else if (operandDec !== undefined) {
            operandValue = parseInt(operandDec, 10);
        } else {
             throw new AssemblyError(`Missing or invalid operand`, currentLineNumber);
        }

        if (isNaN(operandValue) || operandValue < 0 || operandValue > 0x1FF) { // Validate address range (9 bits)
             throw new AssemblyError(`Operand out of 9-bit range (0-511)`, currentLineNumber);
        }

        const predicateCode = PREDICATE[predicateStr];
        if (predicateCode === undefined) {
            throw new AssemblyError(`Unknown predicate: ${predicateStr}`, currentLineNumber);
        }

        // --- Lookup Opcode (Needs expansion for different types) ---
        let opcode = OPCODE_MEM[mnemonic]; // Check memory instructions first
        let instructionType = 'MEMORY'; // Assume memory ref for now

        // TODO: Add checks for Register Ref mnemonics (e.g., MOV, LSHL)
        // if (REGISTER_OPCODES[mnemonic] !== undefined) { opcode = ...; instructionType = 'REGISTER'; }
        // TODO: Add checks for I/O mnemonics (e.g., IN, OUT)
        // if (IO_OPCODES[mnemonic] !== undefined) { opcode = ...; instructionType = 'IO'; }

        if (opcode === undefined) {
            throw new AssemblyError(`Unknown mnemonic: ${mnemonic}`, currentLineNumber);
        }
        // ------------------------------------------------------------

        // Construct the 16-bit instruction word
        // Format assumed: Opcode (4b) | Predicate (3b) | Address/Operand (9b)
        // ** Adjust format based on instructionType if necessary **
        const instructionWord = (opcode << 12) | (predicateCode << 9) | operandValue;
        machineCode.push(instructionWord);
    }

    return machineCode;
}