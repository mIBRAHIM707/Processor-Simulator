// --- Assembler Logic ---

const MASK_10BIT_ASSEMBLER = 0x3FF;
const MASK_16BIT_ASSEMBLER = 0xFFFF;

// Maps mnemonics to their base opcode (bits 14-12)
const memoryRefOpcodes = {
    'AND': 0b000, 'ADD': 0b001, 'LDA': 0b010,
    'STA': 0b011, 'BUN': 0b100, 'BSA': 0b101, 'ISZ': 0b110
};

// Maps register reference mnemonics to their bit pattern (bits 9-0, assuming I=0, Op=111)
// Note: Predicate bits (11-10) are handled separately for predicated instructions
const registerRefOpcodes = {
    'CLA': 0x0800, 'CLE': 0x0400, 'CMA': 0x0200, 'CME': 0x0100,
    'CIR': 0x0080, 'CIL': 0x0040, 'INC': 0x0020,
    'SPA': 0x0010, 'SNA': 0x0008, 'SZA': 0x0004, 'SZE': 0x0002,
    'HLT': 0x0001, 'NOP': 0x0000 // Add NOP
};
const predicatedRegRef = ['CLA', 'CLE', 'CMA', 'CME', 'CIR', 'CIL', 'INC'];

// Maps I/O mnemonics to their bit pattern (bits 9-0, assuming I=1, Op=111)
// Note: Predicate bits (11-10) are handled separately for predicated instructions
const ioOpcodes = {
    'INP': 0x0800, 'OUT': 0x0400,
    'SKI': 0x0200, 'SKO': 0x0100
    // ION and IOF removed
};
const predicatedIO = ['INP', 'OUT'];

// Maps SETP conditions to their bit pattern (bits 7-6)
const setpConditions = {
    'AC>0': 0b00, 'AC<0': 0b01, 'AC=0': 0b10, 'E=0': 0b11
};

// Maps predicate registers (P1-P3) to their destination bit pattern (bits 5-4) for SETP
const setpDestinations = {
    'P1': 0b01, 'P2': 0b10, 'P3': 0b11
};

// Maps predicate registers (P0-P3) to their selection bit pattern (bits 11-10)
const predicateSelectors = {
    'P0': 0b00, 'P1': 0b01, 'P2': 0b10, 'P3': 0b11
};

// Helper function to format numbers as hexadecimal
function formatHex(value, bits) {
    return value.toString(16).toUpperCase().padStart(bits / 4, '0');
}

// Simple two-pass assembler
function assemble(code) {
    const lines = code.trim().split('\n');
    const symbolTable = {};
    const intermediateCode = []; // Store parsed info before generating machine code
    let currentAddress = 0;
    let errors = [];
    let hasHalt = false; // Track if HLT instruction is present
    console.log("Starting Assembly Pass 1..."); // Log start

    // --- Pass 1: Build Symbol Table and Basic Validation ---
    lines.forEach((line, index) => {
        const sourceLineNumber = index + 1;
        const originalLine = line;
        line = line.replace(/[/;].*$/, '').trim(); // Remove comments (supports / and ;)
        if (line === '') return;

        let label = null;
        let instructionPart = line;

        // Match "LABEL," format
        const labelMatch = line.match(/^([a-zA-Z][a-zA-Z0-9]*)\s*,\s*(.*)/);
        if (labelMatch) {
            label = labelMatch[1].toUpperCase();
            instructionPart = labelMatch[2].trim();
            if (symbolTable.hasOwnProperty(label)) {
                errors.push(`Error line ${sourceLineNumber}: Label '${label}' redefined.`);
            } else if (/^(P0|P1|P2|P3)$/i.test(label)) {
                errors.push(`Error line ${sourceLineNumber}: Label '${label}' cannot be a predicate register name.`);
            } else {
                symbolTable[label] = currentAddress;
                console.log(`  Symbol Found: ${label} at ${formatHex(currentAddress, 10)}`); // Log symbol
            }
        } else if (line.includes(',')) {
            // Check for misplaced comma without proper label format
            const firstWord = line.split(/\s+/)[0];
            if (!/^(ORG|DEC|HEX|SETP)$/i.test(firstWord) && !firstWord.includes(',')) {
                errors.push(`Error line ${sourceLineNumber}: Possible missing label before comma or invalid instruction format.`);
            }
        }

        // Handle ORG pseudo-instruction
        const orgMatch = instructionPart.match(/^ORG\s+([0-9A-Fa-f]+)H?$/i);
        if (orgMatch) {
            const newAddress = parseInt(orgMatch[1], 16);
            if (isNaN(newAddress) || newAddress < 0 || newAddress >= 1024) {
                errors.push(`Error line ${sourceLineNumber}: Invalid ORG address '${orgMatch[1]}'. Must be 0-3FF.`);
                // Don't change currentAddress on error
            } else {
                currentAddress = newAddress;
                console.log(`  ORG directive set address to ${formatHex(currentAddress, 10)}`); // Log ORG
            }
            // Store ORG info for pass 2 if needed, or just process address change
            intermediateCode.push({ address: -1, type: 'directive', original: instructionPart, sourceLineNumber: sourceLineNumber, label: label }); // Address -1 indicates directive
            return; // ORG doesn't generate code itself or take space in this pass
        }

        // Handle DEC/HEX pseudo-instructions for data definition
        const dataMatch = instructionPart.match(/^(DEC|HEX)\s+(-?\d+|[0-9A-Fa-f]+H?)$/i);
        if (dataMatch) {
            intermediateCode.push({ address: currentAddress, type: 'data', original: instructionPart, sourceLineNumber: sourceLineNumber, label: label });
            console.log(`  Data directive found at ${formatHex(currentAddress, 10)}: ${instructionPart}`); // Log data directive
            currentAddress++;
            return;
        }

        // Handle END pseudo-instruction
        const endMatch = instructionPart.match(/^END$/i);
        if (endMatch) {
            intermediateCode.push({ address: -1, type: 'directive', original: instructionPart, sourceLineNumber: sourceLineNumber, label: label });
            // We can stop pass 1 here if desired, or just note it.
            return;
        }

        // If it's not a label-only line, directive or data, it's an instruction
        if (instructionPart !== '') {
            intermediateCode.push({ address: currentAddress, type: 'instruction', original: instructionPart, sourceLineNumber: sourceLineNumber, label: label });
            console.log(`  Instruction found at ${formatHex(currentAddress, 10)}: ${instructionPart}`); // Log instruction directive
            if (/^HLT$/i.test(instructionPart.trim())) {
                hasHalt = true;
            }
            currentAddress++;
        } else if (label && instructionPart === '') {
            // Label on an empty line - points to the *next* instruction's address
            // Handled by symbolTable pointing to currentAddress which will be used by the next item.
        }
    });
    console.log("Assembly Pass 1 Complete. Symbol Table:", symbolTable); // Log symbol table

    // --- Pass 2: Generate Machine Code ---
    const machineCode = []; // Array of { address: number, instruction: number, sourceLineNumber: number }
    console.log("Starting Assembly Pass 2..."); // Log start

    intermediateCode.forEach((entry) => {
        if (entry.type === 'directive') {
            // Handle ORG address setting if needed again, or just ignore END
            return;
        }

        let instruction = 0;

        if (entry.type === 'data') {
            const dataMatch = entry.original.match(/^(DEC|HEX)\s+(-?\d+|[0-9A-Fa-f]+H?)$/i);
            if (dataMatch) {
                const type = dataMatch[1].toUpperCase();
                const valueStr = dataMatch[2];
                let value = 0;
                try {
                    if (type === 'DEC') {
                        value = parseInt(valueStr, 10);
                    } else { // HEX
                        value = parseInt(valueStr.replace(/H$/i, ''), 16);
                    }
                    if (isNaN(value)) throw new Error("Invalid number format");

                    // Handle 16-bit range and two's complement
                    if (value >= -32768 && value <= 65535) {
                        instruction = value & MASK_16BIT_ASSEMBLER;
                    } else {
                        throw new Error("Value out of 16-bit range");
                    }

                } catch (e) {
                    errors.push(`Error line ${entry.sourceLineNumber}: Invalid data value '${valueStr}'. ${e.message}.`);
                }
            } else {
                errors.push(`Error line ${entry.sourceLineNumber}: Internal error parsing data definition.`); // Should have been caught earlier
            }
            machineCode.push({ address: entry.address, instruction: instruction, sourceLineNumber: entry.sourceLineNumber });
            console.log(`  Generated Data at ${formatHex(entry.address, 10)}: ${formatHex(instruction, 16)}`); // Log generated data
            return; // Move to next entry
        }

        // Process instruction line
        let line = entry.original;
        let predicate = 0b00; // Default P0
        let indirect = 0;

        // Check for predicate (Px) prefix
        const predMatch = line.match(/^\(\s*(P[0-3])\s*\)\s*(.*)/i);
        if (predMatch) {
            const predReg = predMatch[1].toUpperCase();
            // predicateSelectors defined earlier maps P0->00, P1->01, etc.
            predicate = predicateSelectors[predReg]; // Assume P0-P3 are valid keys
            line = predMatch[2].trim();
        }

        // Split mnemonic and operand(s)
        const parts = line.split(/[\s,]+/); // Split by space or comma, allows "SETP P1, AC>0"
        const mnemonic = parts[0].toUpperCase();
        let operand1 = null;
        let operand2 = null;

        if (mnemonic === 'SETP') {
            // SETP Px, Condition format
            if (parts.length === 3) {
                operand1 = parts[1].toUpperCase(); // Destination Px
                operand2 = parts[2].toUpperCase(); // Condition
            } else {
                errors.push(`Error line ${entry.sourceLineNumber}: Invalid SETP format. Use 'SETP Px, Condition' (e.g., SETP P1, AC>0).`);
                return;
            }
        } else {
            // Other instructions: Mnemonic Operand [I]
            if (parts.length > 1) operand1 = parts[1]; // Address/Label/Value
            if (parts.length > 2 && parts[2].toUpperCase() === 'I') {
                indirect = 1;
            } else if (parts.length > 2 && parts[2].toUpperCase() !== 'I') {
                // Check if it's just extra whitespace vs invalid token
                if (parts[2].trim() !== '') {
                    errors.push(`Error line ${entry.sourceLineNumber}: Unexpected token '${parts[2]}' after operand.`);
                }
            }
            // Handle case where operand might contain spaces if not SETP - currently split won't allow this easily.
            // Assume single word operand for now.
        }

        // --- Instruction Encoding ---
        if (memoryRefOpcodes.hasOwnProperty(mnemonic)) {
            // Memory Reference Instruction
            if (!operand1) {
                errors.push(`Error line ${entry.sourceLineNumber}: Memory reference instruction '${mnemonic}' requires an address operand.`);
                return;
            }
            let addressVal = 0;
            const operandUpper = operand1.toUpperCase();
            if (symbolTable.hasOwnProperty(operandUpper)) {
                addressVal = symbolTable[operandUpper];
            } else {
                try {
                    // Try parsing as Hex (e.g., 100H) or Decimal
                    if (operandUpper.endsWith('H')) {
                        addressVal = parseInt(operandUpper.slice(0, -1), 16);
                    } else if (/^[0-9A-Fa-f]+$/.test(operandUpper)) { // Treat plain hex number as hex
                        addressVal = parseInt(operandUpper, 16);
                    } else {
                        addressVal = parseInt(operandUpper, 10); // Try decimal last
                    }
                    if (isNaN(addressVal)) throw new Error();
                } catch (e) {
                    errors.push(`Error line ${entry.sourceLineNumber}: Undefined label or invalid address operand '${operand1}'.`);
                    return;
                }
            }

            if (addressVal < 0 || addressVal > MASK_10BIT_ASSEMBLER) {
                errors.push(`Error line ${entry.sourceLineNumber}: Address '${operand1}' (${addressVal}) out of range (0-${MASK_10BIT_ASSEMBLER}).`);
                return;
            }

            instruction |= (indirect << 15);
            instruction |= (memoryRefOpcodes[mnemonic] << 12);
            instruction |= (predicate << 10);
            instruction |= (addressVal & MASK_10BIT_ASSEMBLER);

        } else if (registerRefOpcodes.hasOwnProperty(mnemonic)) {
            // Register Reference Instruction
            if (operand1 || indirect) { // Should not have operand or 'I'
                errors.push(`Error line ${entry.sourceLineNumber}: Register reference instruction '${mnemonic}' cannot have an operand or be indirect.`);
                return;
            }
            const isPred = predicatedRegRef.includes(mnemonic);
            if (!isPred && predMatch) { // Predicate specified for non-predicatable instruction
                errors.push(`Error line ${entry.sourceLineNumber}: Instruction '${mnemonic}' cannot be predicated.`);
                return;
            }

            instruction = 0x7000; // Opcode 111, I=0
            instruction |= registerRefOpcodes[mnemonic];
            if (isPred) {
                instruction |= (predicate << 10); // Add predicate if applicable
            }

        } else if (ioOpcodes.hasOwnProperty(mnemonic)) {
            // I/O Instruction
            if (operand1 || indirect) { // Should not have operand or 'I'
                errors.push(`Error line ${entry.sourceLineNumber}: I/O instruction '${mnemonic}' cannot have an operand or be indirect.`);
                return;
            }
            const isPred = predicatedIO.includes(mnemonic);
            if (!isPred && predMatch) { // Predicate specified for non-predicatable instruction
                errors.push(`Error line ${entry.sourceLineNumber}: Instruction '${mnemonic}' cannot be predicated.`);
                return;
            }

            instruction = 0xF000; // Opcode 111, I=1
            instruction |= ioOpcodes[mnemonic];
            if (isPred) {
                instruction |= (predicate << 10); // Add predicate if applicable
            }

        } else if (mnemonic === 'SETP') {
            // SETP Instruction (already parsed operands)
            if (predMatch || indirect) { // SETP cannot be predicated itself or indirect
                errors.push(`Error line ${entry.sourceLineNumber}: SETP instruction cannot be predicated or indirect.`);
                return;
            }
            if (!setpDestinations.hasOwnProperty(operand1)) { // Check P1-P3
                errors.push(`Error line ${entry.sourceLineNumber}: Invalid SETP destination register '${operand1}'. Must be P1, P2, or P3.`);
                return;
            }
            if (!setpConditions.hasOwnProperty(operand2)) { // Check AC>0 etc.
                errors.push(`Error line ${entry.sourceLineNumber}: Invalid SETP condition '${operand2}'.`);
                return;
            }

            instruction = 0x7300; // Base SETP opcode 0111 0011
            instruction |= (setpConditions[operand2] << 6);
            instruction |= (setpDestinations[operand1] << 4);
            // Bits 11-10 and 3-0 are unused/zero for SETP

        } else {
            errors.push(`Error line ${entry.sourceLineNumber}: Unknown mnemonic or invalid instruction format '${mnemonic}'.`);
            return;
        }

        machineCode.push({ address: entry.address, instruction: instruction, sourceLineNumber: entry.sourceLineNumber });
        console.log(`  Generated Code at ${formatHex(entry.address, 10)}: ${formatHex(instruction, 16)}`); // Log generated code
    });

    if (!hasHalt && errors.length === 0) {
        // Add a warning instead of an error if no HLT is found
        console.warn("Assembler Warning: No HLT instruction found in the program.");
    }

    if (errors.length > 0) {
        // Sort errors by line number
        errors.sort((a, b) => {
            const lineA = parseInt(a.match(/line (\d+)/)?.[1] || 0);
            const lineB = parseInt(b.match(/line (\d+)/)?.[1] || 0);
            return lineA - lineB;
        });
        return { success: false, errors: errors, machineCode: [], symbolTable: {} };
    }

    // Filter out entries with address -1 (directives) before returning final code
    const finalMachineCode = machineCode.filter(entry => entry.address !== -1);

    console.log("Assembly Pass 2 Complete."); // Log end

    return { success: true, errors: [], machineCode: finalMachineCode, symbolTable: symbolTable };
}
